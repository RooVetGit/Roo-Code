import * as vscode from "vscode"
import * as path from "path"
import { createHash } from "crypto"
import { scanDirectoryForCodeBlocks } from "./scanner"
import { CodeIndexFileWatcher, FileProcessingResult } from "./file-watcher"
import { ApiHandlerOptions } from "../../shared/api"
import { getWorkspacePath } from "../../utils/path"
import { CodeIndexOpenAiEmbedder } from "./openai-embedder"
import { CodeIndexQdrantClient } from "./qdrant-client"
import { QdrantSearchResult } from "./types"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

// Define the structure for progress updates
export interface IndexProgressUpdate {
	systemStatus: IndexingState
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

	// --- State Management ---
	private _setSystemState(newState: IndexingState, message?: string): void {
		const stateChanged =
			newState !== this._systemStatus || (message !== undefined && message !== this._statusMessage)

		if (stateChanged) {
			this._systemStatus = newState
			if (message !== undefined) {
				this._statusMessage = message
			}
			this.postStatusUpdate()
			this._progressEmitter.fire({
				systemStatus: this._systemStatus,
				fileStatuses: this._fileStatuses,
				message: this._statusMessage,
			})
			console.log(
				`[CodeIndexManager] System state changed to: ${this._systemStatus}${message ? ` (${message})` : ""}`,
			)
		}
	}

	// Private constructor for singleton pattern
	private constructor(workspacePath: string, context: vscode.ExtensionContext) {
		this.workspacePath = workspacePath
		this.context = context
		// Initial state is set implicitly or via loadConfiguration
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
			this._setSystemState("Standby", "Code Indexing Disabled.")
			return
		}

		if (!nowConfigured) {
			this.stopWatcher()
			this._embedder = undefined
			this._qdrantClient = undefined
			console.log("[CodeIndexManager] Missing configuration.")
			this._setSystemState("Standby", "Missing configuration.")
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
			// If already configured and enabled, ensure state reflects readiness if standby
			if (this._systemStatus === "Standby") {
				this._setSystemState("Standby", "Configuration ready. Ready to index.")
			}
		}
	}

	/**
	 * Updates the configuration required for indexing.
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
				this._setSystemState("Standby", "Configuration ready. Ready to index.")
			} else if (this._systemStatus !== "Standby") {
				// Configuration changed while running - might need restart logic later
				console.warn("[CodeIndexManager] Configuration updated while active. A restart might be needed.")
				// Potentially stop and update internal components if feasible
			}
		}
	}

	private async _resetCacheFile(): Promise<void> {
		try {
			const cacheFileName = `roo-index-cache-${createHash("sha256").update(this.workspacePath).digest("hex")}.json`
			const cachePath = vscode.Uri.joinPath(this.context.globalStorageUri, cacheFileName)

			try {
				await vscode.workspace.fs.writeFile(cachePath, Buffer.from("{}", "utf-8"))
				console.log(`[CodeIndexManager] Cache file reset (emptied) at ${cachePath.fsPath}`)
			} catch (error) {
				console.error("[CodeIndexManager] Failed to reset (empty) cache file:", error)
			}
		} catch (error) {
			console.error("[CodeIndexManager] Unexpected error during cache file reset:", error)
		}
	}

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */

	public async startIndexing(): Promise<void> {
		if (!this.isConfigured()) {
			this._setSystemState("Standby", "Cannot start: Missing OpenAI or Qdrant configuration.")
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
		this._setSystemState("Indexing", "Initializing Qdrant connection and collection...")

		try {
			// Ensure client is initialized before calling initialize
			if (!this._qdrantClient) {
				if (this.isConfigured()) {
					this._qdrantClient = new CodeIndexQdrantClient(this.workspacePath, this.qdrantUrl)
				} else {
					throw new Error(
						"Cannot initialize collection: Qdrant client cannot be initialized - configuration missing.",
					)
				}
			}
			const collectionCreated = await this._qdrantClient.initialize() // Call the existing initialize method

			if (collectionCreated) {
				await this._resetCacheFile()
				console.log("[CodeIndexManager] Qdrant collection created; cache file emptied.")
			}

			this._setSystemState("Indexing", "Qdrant ready. Starting workspace scan...")
		} catch (initError: any) {
			console.error("[CodeIndexManager] Failed to initialize Qdrant client or collection:", initError)
			this._setSystemState("Error", `Failed to initialize Qdrant: ${initError.message || "Unknown error"}`)
			this._isProcessing = false // Stop processing on critical error
			return // Exit if initialization fails
		}

		try {
			const { stats } = await scanDirectoryForCodeBlocks(
				this.workspacePath,
				undefined, // Let scanner create its own ignore controller
				this.openAiOptions,
				this.qdrantUrl,
				this.context,
				(batchError: Error) => {
					this._setSystemState("Error", `Failed during initial scan batch: ${batchError.message}`)
				},
			)

			console.log(
				`[CodeIndexManager] Initial scan complete. Processed: ${stats.processed}, Skipped: ${stats.skipped}`,
			)

			await this._startWatcher()

			this._setSystemState("Indexed", "Workspace scan and watcher started.")
		} catch (error: any) {
			console.error("[CodeIndexManager] Error during indexing:", error)
			try {
				await this._qdrantClient?.clearCollection()
			} catch (cleanupError) {
				console.error("[CodeIndexManager] Failed to clean up after error:", cleanupError)
			}

			// Attempt to clear cache file after scan error
			await this._resetCacheFile()
			console.log("[CodeIndexManager] Cleared cache file due to scan error.")

			this._setSystemState("Error", `Failed during initial scan: ${error.message || "Unknown error"}`)
			this.stopWatcher() // Clean up watcher if it started
		} finally {
			this._isProcessing = false
		}
	}

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
			// Transition state appropriately only if not already in Error state
			if (this.state !== "Error") {
				this._setSystemState("Standby", "File watcher stopped.") // Return to standby if stopped manually
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
			await this.stopWatcher() // stopWatcher already sets state to Standby if not Error

			// Clear Qdrant collection
			try {
				// Re-initialize client if needed (might have been cleared by stopWatcher)
				if (!this._qdrantClient && this.isConfigured()) {
					this._qdrantClient = new CodeIndexQdrantClient(this.workspacePath, this.qdrantUrl)
				}
				if (this._qdrantClient) {
					await this._qdrantClient.clearCollection()
					console.log("[CodeIndexManager] Vector collection cleared.")
				} else {
					console.warn("[CodeIndexManager] Qdrant client not available, skipping vector collection clear.")
				}
			} catch (error: any) {
				console.error("[CodeIndexManager] Failed to clear vector collection:", error)
				this._setSystemState("Error", `Failed to clear vector collection: ${error.message}`)
				// Don't re-throw, attempt cache deletion
			}

			// Delete cache file
			await this._resetCacheFile()
			console.log("[CodeIndexManager] Cache file emptied.")

			// If no errors occurred during clearing, confirm success
			if (this._systemStatus !== "Error") {
				this._setSystemState("Standby", "Index data cleared successfully.")
				console.log("[CodeIndexManager] Code index data cleared successfully.")
			}
		} finally {
			this._isProcessing = false
		}
	}

	// --- Private Helpers ---

	// File status update helper
	private _updateFileStatus(filePath: string, fileStatus: string, message?: string): void {
		if (!this.isConfigured()) {
			console.warn("[CodeIndexManager] Ignoring file status update because system is not properly configured.")
			return
		}

		let stateChanged = false

		if (this._fileStatuses[filePath] !== fileStatus) {
			this._fileStatuses[filePath] = fileStatus
			stateChanged = true
		}

		// Update overall message ONLY if indexing and message is provided
		if (message && this._systemStatus === "Indexing" && message !== this._statusMessage) {
			this._statusMessage = message
			stateChanged = true
			console.log(`[CodeIndexManager] Status message updated during indexing: ${this._statusMessage}`)
		}

		if (stateChanged) {
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
					// Optionally include fileStatuses if the webview needs it
					// fileStatuses: this._fileStatuses
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

		// Ensure embedder and client are initialized before starting watcher
		if (!this._embedder || !this._qdrantClient) {
			if (this.isConfigured()) {
				this._embedder = new CodeIndexOpenAiEmbedder(this.openAiOptions!)
				this._qdrantClient = new CodeIndexQdrantClient(this.workspacePath, this.qdrantUrl)
			} else {
				this._setSystemState("Error", "Cannot start watcher: Configuration missing.")
				return
			}
		}

		this._setSystemState("Indexing", "Initializing file watcher...")

		this._fileWatcher = new CodeIndexFileWatcher(
			this.workspacePath,
			this.context,
			this._embedder, // Pass initialized embedder
			this._qdrantClient, // Pass initialized client
		)
		await this._fileWatcher.initialize()

		this._fileWatcherSubscriptions = [
			this._fileWatcher.onDidStartProcessing((filePath: string) => {
				this._updateFileStatus(filePath, "Processing", `Processing file: ${path.basename(filePath)}`)
			}),
			this._fileWatcher.onDidFinishProcessing((event: FileProcessingResult) => {
				if (event.error) {
					this._updateFileStatus(event.path, "Error")
					console.error(`[CodeIndexManager] Error processing file ${event.path}:`, event.error)
				} else {
					this._updateFileStatus(
						event.path,
						"Indexed",
						`Finished processing ${path.basename(event.path)}. Index up-to-date.`,
					)
				}

				if (this._systemStatus === "Indexing") {
					this._setSystemState("Indexed", "Index up-to-date.")
				}
			}),
			this._fileWatcher.onError((error: Error) => {
				console.error("[CodeIndexManager] File watcher encountered an error:", error)
				this._setSystemState("Error", `File watcher error: ${error.message}`)
			}),
		]

		console.log("[CodeIndexManager] File watcher started.")
	}

	public async searchIndex(query: string, limit: number): Promise<QdrantSearchResult[]> {
		if (!this.isEnabled || !this.isConfigured()) {
			throw new Error("Code index feature is disabled or not configured.")
		}
		if (this._systemStatus !== "Indexed" && this._systemStatus !== "Indexing") {
			// Allow search during Indexing too
			throw new Error(`Code index is not ready for search. Current state: ${this._systemStatus}`)
		}
		if (!this._embedder || !this._qdrantClient) {
			// Attempt to initialize if needed
			if (this.isConfigured()) {
				this._embedder = new CodeIndexOpenAiEmbedder(this.openAiOptions!)
				this._qdrantClient = new CodeIndexQdrantClient(this.workspacePath, this.qdrantUrl)
			} else {
				throw new Error("Code index components could not be initialized - configuration missing.")
			}
		}

		try {
			const embeddingResponse = await this._embedder.createEmbeddings([query])
			const vector = embeddingResponse.embeddings[0]
			if (!vector) {
				throw new Error("Failed to generate embedding for query.")
			}

			if (typeof this._qdrantClient.search !== "function") {
				// This check might be redundant if the client is always correctly initialized
				throw new Error("Qdrant client does not support search operation.")
			}

			const results = await this._qdrantClient.search(vector, limit)
			return results
		} catch (error) {
			console.error("[CodeIndexManager] Error during search:", error)
			this._setSystemState("Error", `Search failed: ${(error as Error).message}`)
			throw error // Re-throw the error after setting state
		}
	}
}
