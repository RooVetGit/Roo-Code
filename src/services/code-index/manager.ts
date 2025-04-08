import * as vscode from "vscode"
import { scanDirectoryForCodeBlocks } from "./scanner"
import { CodeIndexFileWatcher } from "./file-watcher"
import { ApiHandlerOptions } from "../../shared/api"
import { getWorkspacePath } from "../../utils/path"
import { CodeIndexOpenAiEmbedder } from "./openai-embedder"
import { CodeIndexQdrantClient } from "./qdrant-client"
import { QdrantSearchResult } from "./types"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

// Define the structure for progress updates
export interface IndexProgressUpdate {
	state: IndexingState
	message?: string // For details like error messages or current activity
}

export class CodeIndexManager {
	private _statusMessage: string = ""
	// --- Singleton Implementation ---
	private static instances = new Map<string, CodeIndexManager>() // Map workspace path to instance

	public static getInstance(context: vscode.ExtensionContext): CodeIndexManager {
		const workspacePath = getWorkspacePath() // Assumes single workspace for now
		if (!workspacePath) {
			throw new Error("Cannot get CodeIndexManager instance without an active workspace.")
		}

		if (!CodeIndexManager.instances.has(workspacePath)) {
			CodeIndexManager.instances.set(workspacePath, new CodeIndexManager(workspacePath, context))
		}
		return CodeIndexManager.instances.get(workspacePath)!
	}

	public static disposeAll(): void {
		CodeIndexManager.instances.forEach((instance) => instance.dispose())
		CodeIndexManager.instances.clear()
	}

	private _systemStatus: IndexingState = "Standby"
	private _fileStatuses: Record<string, string> = {}
	private _progressEmitter = new vscode.EventEmitter<{
		systemStatus: IndexingState
		fileStatuses: Record<string, string>
		message?: string
	}>()
	private _fileWatcher: CodeIndexFileWatcher | null = null
	private _isProcessing: boolean = false // Flag to track active work (scan or watch event)
	private _fileWatcherSubscriptions: vscode.Disposable[] = []

	// Dependencies
	private readonly workspacePath: string
	private readonly context: vscode.ExtensionContext
	private openAiOptions?: ApiHandlerOptions // Configurable
	private qdrantUrl?: string // Configurable
	private isEnabled: boolean = false // New: enabled flag

	private _embedder?: CodeIndexOpenAiEmbedder
	private _qdrantClient?: CodeIndexQdrantClient

	// Webview provider reference for status updates
	private webviewProvider?: { postMessage: (msg: any) => void }

	// Private constructor for singleton pattern
	private constructor(workspacePath: string, context: vscode.ExtensionContext) {
		this.workspacePath = workspacePath
		this.context = context
		// this.updateState("Standby", "Awaiting configuration and start signal.")
	}

	// --- Public API ---

	public readonly onProgressUpdate = this._progressEmitter.event

	public get state(): IndexingState {
		return this._systemStatus
	}

	public get isFeatureEnabled(): boolean {
		return this.isEnabled
	}

	public get isFeatureConfigured(): boolean {
		return this.isConfigured()
	}

	/**
	 * Loads persisted configuration from globalState.
	 */
	public async loadConfiguration(): Promise<void> {
		console.log("[CodeIndexManager] Loading configuration...")

		const prevEnabled = this.isEnabled
		const prevConfigured = this.isConfigured?.() ?? false

		const enabled = this.context.globalState.get<boolean>("codeIndexEnabled", false)
		const openAiKey = this.context.globalState.get<string>("codeIndexOpenAiKey", "")
		const qdrantUrl = this.context.globalState.get<string>("codeIndexQdrantUrl", "")

		this.isEnabled = enabled
		this.openAiOptions = { openAiNativeApiKey: openAiKey }
		this.qdrantUrl = qdrantUrl

		const nowConfigured = this.isConfigured()

		if (!this.isEnabled) {
			this.stopWatcher()
			this._embedder = undefined
			this._qdrantClient = undefined
			console.log("[CodeIndexManager] Code Indexing Disabled.")
			this.updateState({ systemStatus: "Standby", message: "Code Indexing Disabled." })
			return
		}

		if (!nowConfigured) {
			this.stopWatcher()
			this._embedder = undefined
			this._qdrantClient = undefined
			console.log("[CodeIndexManager] Missing configuration.")
			this.updateState({ systemStatus: "Standby", message: "Missing configuration." })
			return
		}

		// Only recreate embedder/client and restart indexing if transitioning from disabled/unconfigured to enabled+configured
		const shouldRestart = (!prevEnabled || !prevConfigured) && enabled && nowConfigured

		if (shouldRestart) {
			this._embedder = new CodeIndexOpenAiEmbedder(this.openAiOptions!)
			this._qdrantClient = new CodeIndexQdrantClient(this.workspacePath, this.qdrantUrl)
			console.log("[CodeIndexManager] Configuration loaded. Starting indexing...")
			await this.startIndexing()
		} else {
			console.log("[CodeIndexManager] Configuration loaded. No restart needed.")
		}
	}

	/**
	 * Updates the configuration required for indexing.
	 * If the service is in 'Standby' and configuration becomes valid,
	 * it might automatically attempt to start (or require a manual start).
	 */
	public updateConfiguration(config: { openAiOptions?: ApiHandlerOptions; qdrantUrl?: string }): void {
		let configChanged = false

		// Handle OpenAI options update if present
		if (config.openAiOptions) {
			const newKey = config.openAiOptions.openAiNativeApiKey
			if (!this.openAiOptions || newKey !== this.openAiOptions.openAiNativeApiKey) {
				this.openAiOptions = config.openAiOptions
				configChanged = true
			}
		}

		// Handle Qdrant URL update if present
		if (config.qdrantUrl) {
			const newUrl = config.qdrantUrl
			if (newUrl !== this.qdrantUrl) {
				this.qdrantUrl = newUrl
				configChanged = true
			}
		}

		if (configChanged) {
			console.log("[CodeIndexManager] Configuration updated.")
			// If we were waiting for config, check if we can proceed
			if (this._systemStatus === "Standby" && this.isConfigured()) {
				// Option 1: Automatically start
				// this.startIndexing();
				// Option 2: Signal readiness, require manual start
				this.updateState({ systemStatus: "Standby", message: "Configuration ready. Ready to index." })
			} else if (this._systemStatus !== "Standby") {
				// Configuration changed while running - might need restart logic later
				console.warn("[CodeIndexManager] Configuration updated while active. A restart might be needed.")
				// Potentially stop and update internal components if feasible
			}
		}
	}

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */
	public async startIndexing(): Promise<void> {
		if (!this.isConfigured()) {
			this.updateState({
				systemStatus: "Standby",
				message: "Cannot start: Missing OpenAI or Qdrant configuration.",
			})
			console.warn("[CodeIndexManager] Start rejected: Missing configuration.")
			return
		}

		if (
			this._isProcessing ||
			(this._systemStatus !== "Standby" && this._systemStatus !== "Error" && this._systemStatus !== "Indexed")
		) {
			console.warn(`[CodeIndexManager] Start rejected: Already processing or in state ${this._systemStatus}.`)
			return
		}

		this._isProcessing = true
		this.updateState({ systemStatus: "Indexing", message: "Starting initial scan..." })

		try {
			this.updateState({ systemStatus: "Indexing", message: "Checking for existing collection..." })
			const collectionExists = await this._checkCollectionExists()

			if (collectionExists) {
				this.updateState({ systemStatus: "Indexing", message: "Collection exists. Starting file watcher..." })
				await this._startWatcher()
			} else {
				this.updateState({
					systemStatus: "Indexing",
					message: "Collection does not exist. Starting full scan...",
				})
				// Start watcher first to capture changes during scan
				await this._startWatcher()
				// Perform the initial scan using scanDirectoryForCodeBlocks
				const { stats } = await scanDirectoryForCodeBlocks(
					this.workspacePath,
					undefined, // Let scanner create its own ignore controller
					this.openAiOptions,
					this.qdrantUrl,
					this.context,
					(batchError) => {
						this.updateState({
							systemStatus: "Error",
							message: `Failed during initial scan batch: ${batchError.message}`,
						})
					},
				)
				console.log(
					`[CodeIndexManager] Initial scan complete. Processed: ${stats.processed}, Skipped: ${stats.skipped}`,
				)
			}
			this.updateState({ systemStatus: "Indexed", message: "Initial indexing process complete." }) // Or appropriate state
		} catch (error: any) {
			console.error("[CodeIndexManager] Error during indexing startup:", error)
			this.updateState({
				systemStatus: "Error",
				message: `Failed during startup: ${error.message || "Unknown error"}`,
			})
			this.stopWatcher() // Clean up watcher if it started
		} finally {
			this._isProcessing = false
		}
	}

	/**
	 * Starts the indexing process. Checks for existing collection and starts file watcher.
	 */

	/**
	 * Stops the file watcher and potentially cleans up resources.
	 */
	public stopWatcher(): void {
		if (this._fileWatcher) {
			this._fileWatcher.dispose()
			this._fileWatcher = null
			this._fileWatcherSubscriptions.forEach((sub) => sub.dispose())
			this._fileWatcherSubscriptions = []
			console.log("[CodeIndexManager] File watcher stopped.")
			// Transition state appropriately
			if (this.state !== "Error") {
				this.updateState({ systemStatus: "Standby", message: "File watcher stopped." }) // Return to standby if stopped manually
			}
		}
		this._isProcessing = false // Ensure processing flag is reset
	}

	/**
	 * Cleans up the manager instance.
	 */
	public dispose(): void {
		this.stopWatcher()
		this._progressEmitter.dispose()
		console.log(`[CodeIndexManager] Disposed for workspace: ${this.workspacePath}`)
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the Qdrant collection,
	 * and deleting the cache file.
	 */
	public async clearIndexData(): Promise<void> {
		console.log("[CodeIndexManager] Clearing code index data...")
		this._isProcessing = true

		try {
			// Stop the watcher if running
			await this.stopWatcher()

			// Clear Qdrant collection
			try {
				if (!this._fileWatcher) {
					console.warn("[CodeIndexManager] No file watcher initialized, skipping vector collection clear.")
				} else {
					await this._fileWatcher.clearCollection()
				}
			} catch (error: any) {
				console.error("[CodeIndexManager] Failed to clear vector collection:", error)
				this.updateState({
					systemStatus: "Error",
					message: `Failed to clear vector collection: ${error.message}`,
				})
				throw error
			}

			// Delete cache file
			try {
				await this._fileWatcher?.deleteCacheFile()
			} catch (error: any) {
				console.error("[CodeIndexManager] Failed to delete cache file:", error)
				this.updateState({ systemStatus: "Error", message: `Failed to delete cache file: ${error.message}` })
				throw error
			}

			// If we get here, both operations succeeded
			this.updateState({ systemStatus: "Standby", message: "Index data cleared successfully." })
			console.log("[CodeIndexManager] Code index data cleared successfully.")
		} finally {
			this._isProcessing = false
		}
	}

	// --- Private Helpers ---

	private updateState(params: {
		systemStatus?: IndexingState
		fileStatusUpdates?: Record<string, string>
		message?: string
	}): void {
		const { systemStatus, fileStatusUpdates, message } = params
		this._statusMessage = message ?? this._statusMessage

		let systemStatusChanged = false
		if (systemStatus && this._systemStatus !== systemStatus) {
			this._systemStatus = systemStatus
			systemStatusChanged = true
		}

		if (fileStatusUpdates) {
			if (!this.isConfigured()) {
				console.warn("Ignoring file status updates because system is not properly configured.")
			} else {
				for (const [file, status] of Object.entries(fileStatusUpdates)) {
					this._fileStatuses[file] = status
				}
			}
		}

		if (systemStatusChanged || fileStatusUpdates || message) {
			this.postStatusUpdate()
			this._progressEmitter.fire({
				systemStatus: this._systemStatus,
				fileStatuses: this._fileStatuses,
				message: this._statusMessage,
			})
		}
	}

	public getCurrentStatus() {
		return {
			systemStatus: this._systemStatus,
			fileStatuses: this._fileStatuses,
			message: this._statusMessage,
		}
	}

	/**
	 * Posts the current status update to the webview if available.
	 */
	private postStatusUpdate() {
		if (this.webviewProvider) {
			this.webviewProvider.postMessage({
				type: "indexingStatusUpdate",
				values: {
					systemStatus: this._systemStatus,
					message: this._statusMessage,
				},
			})
		}
	}

	private isConfigured(): boolean {
		// Ensure openAiOptions itself exists before checking the key
		return !!(this.openAiOptions?.openAiNativeApiKey && this.qdrantUrl)
	}
	private async _startWatcher(): Promise<void> {
		if (this._fileWatcher) {
			console.log("[CodeIndexManager] File watcher already running.")
			return
		}

		this.updateState({ systemStatus: "Indexing", message: "Initializing file watcher..." })

		this._fileWatcher = new CodeIndexFileWatcher(
			this.workspacePath,
			this.context,
			this._embedder,
			this._qdrantClient,
		)
		await this._fileWatcher.initialize()

		this._fileWatcherSubscriptions = [
			this._fileWatcher.onDidStartProcessing((filePath) => {
				this.updateState({
					fileStatusUpdates: { [filePath]: "Processing" },
					message: `Processing file: ${filePath}`,
				})
			}),
			this._fileWatcher.onDidFinishProcessing((event) => {
				if (event.error) {
					this.updateState({
						fileStatusUpdates: { [event.path]: "Error" },
						message: `Error processing ${event.path}: ${event.error.message}`,
					})
				} else {
					this.updateState({
						fileStatusUpdates: { [event.path]: "Indexed" },
						message: `Finished processing ${event.path}. Index up-to-date.`,
					})
				}
			}),
			this._fileWatcher.onError((error) => {
				this.updateState({ systemStatus: "Error", message: `File watcher error: ${error.message}` })
			}),
		]

		console.log("[CodeIndexManager] File watcher started.")
	}

	private async _checkCollectionExists(): Promise<boolean> {
		try {
			if (!this._qdrantClient) {
				throw new Error("[CodeIndexManager] Qdrant client is not initialized")
			}
			return await this._qdrantClient.collectionExists()
		} catch (error) {
			console.warn("[CodeIndexManager] Error checking collection existence:", error)
			return false
		}
	}
	public async searchIndex(query: string, limit: number): Promise<QdrantSearchResult[]> {
		if (!this._embedder || !this._qdrantClient) {
			throw new Error("Code index is not properly configured or initialized.")
		}

		const embeddingResponse = await this._embedder.createEmbeddings([query])
		const vector = embeddingResponse.embeddings[0]
		if (!vector) {
			throw new Error("Failed to generate embedding for query.")
		}

		if (typeof this._qdrantClient.search !== "function") {
			throw new Error("Qdrant client does not support search operation.")
		}

		const results = await this._qdrantClient.search(vector, limit)
		return results
	}
}
