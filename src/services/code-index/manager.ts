import * as vscode from "vscode"
import * as path from "path"
import { createHash } from "crypto"
import { DirectoryScanner, CodeParser } from "./processors"
import { ApiHandlerOptions } from "../../shared/api"
import { getWorkspacePath } from "../../utils/path"
import { OpenAiEmbedder } from "./embedders/openai"
import { QdrantVectorStore } from "./vector-store/qdrant-client"
import { VectorStoreSearchResult } from "./interfaces"
import { ContextProxy } from "../../core/config/ContextProxy"
import { FileProcessingResult, ICodeParser, IEmbedder, IFileWatcher, IVectorStore } from "./interfaces"
import { FileWatcher } from "./processors"
import { EmbedderType } from "./interfaces/manager" // Corrected import path
import { CodeIndexOllamaEmbedder } from "./embedders/ollama" // Corrected import path

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

// Define the structure for progress updates
export interface IndexProgressUpdate {
	systemStatus: IndexingState
	message?: string // For details like error messages or current activity
}
/**
 * Snapshot of previous configuration used to determine if a restart is required
 */
type PreviousConfigSnapshot = {
	enabled: boolean
	configured: boolean
	embedderType: EmbedderType
	openAiKey?: string
	ollamaBaseUrl?: string
	ollamaModelId?: string
	qdrantUrl?: string
	qdrantApiKey?: string
}

export class CodeIndexManager {
	private _statusMessage: string = ""
	// --- Singleton Implementation ---
	private static instances = new Map<string, CodeIndexManager>() // Map workspace path to instance

	public static getInstance(context: vscode.ExtensionContext, contextProxy?: ContextProxy): CodeIndexManager {
		const workspacePath = getWorkspacePath() // Assumes single workspace for now
		if (!workspacePath) {
			throw new Error("Cannot get CodeIndexManager instance without an active workspace.")
		}

		if (!CodeIndexManager.instances.has(workspacePath) && contextProxy) {
			CodeIndexManager.instances.set(workspacePath, new CodeIndexManager(workspacePath, context, contextProxy))
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
	private _fileWatcher?: IFileWatcher
	private _fileWatcherSubscriptions: vscode.Disposable[] = []
	private _isProcessing: boolean = false

	// Dependencies
	private readonly workspacePath: string
	private readonly context: vscode.ExtensionContext
	private readonly contextProxy: ContextProxy | undefined
	private openAiOptions?: ApiHandlerOptions // Configurable
	private qdrantUrl?: string // Configurable
	private qdrantApiKey?: string // Configurable
	private isEnabled: boolean = false // New: enabled flag
	private embedderType: EmbedderType = "openai" // Added property
	private ollamaOptions?: ApiHandlerOptions // Added property

	private _embedder?: IEmbedder
	private _scanner?: DirectoryScanner
	private _vectorStore?: IVectorStore
	private _parser?: ICodeParser

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
	private constructor(workspacePath: string, context: vscode.ExtensionContext, contextProxy: ContextProxy) {
		this.workspacePath = workspacePath
		this.context = context
		this.contextProxy = contextProxy
		// Initial state is set implicitly or via loadConfiguration
	}

	private _initDependencies() {
		console.log("[CodeIndexManager] Recreating clients...")

		if (this.isConfigured() && this.isEnabled && this.openAiOptions) {
			this._parser = new CodeParser()
			this._vectorStore = new QdrantVectorStore(this.workspacePath, this.qdrantUrl, this.qdrantApiKey)
			// Initialize embedder based on configuration
			if (this.embedderType === "openai") {
				if (!this.openAiOptions) {
					throw new Error("OpenAI configuration missing in _initDependencies despite being configured.")
				}
				this._embedder = new OpenAiEmbedder(this.openAiOptions)
				console.log("[CodeIndexManager] Initialized OpenAI Embedder.")
			} else if (this.embedderType === "ollama") {
				if (!this.ollamaOptions) {
					throw new Error("Ollama configuration missing in _initDependencies despite being configured.")
				}
				this._embedder = new CodeIndexOllamaEmbedder(this.ollamaOptions)
				console.log("[CodeIndexManager] Initialized Ollama Embedder.")
			} else {
				// This case should ideally not be reached if loadConfiguration sets defaults correctly
				console.error(`[CodeIndexManager] Invalid embedder type configured: ${this.embedderType}`)
				throw new Error(`Invalid embedder type: ${this.embedderType}`)
			}
			this._scanner = new DirectoryScanner(this._embedder, this._vectorStore, this._parser)
			this.startIndexing()
		}
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

		const previousConfigSnapshot: PreviousConfigSnapshot = {
			enabled: this.isEnabled,
			configured: this.isConfigured?.() ?? false,
			embedderType: this.embedderType,
			openAiKey: this.openAiOptions?.openAiNativeApiKey,
			ollamaBaseUrl: this.ollamaOptions?.ollamaBaseUrl,
			ollamaModelId: this.ollamaOptions?.ollamaModelId,
			qdrantUrl: this.qdrantUrl,
			qdrantApiKey: this.qdrantApiKey,
		}

		const codebaseIndexConfig = this.contextProxy?.getGlobalState("codebaseIndexConfig")

		if (!codebaseIndexConfig) {
			throw new Error("Codebase Indexing configuration not found in global state")
		}

		const {
			codebaseIndexEnabled,
			codebaseIndexQdrantUrl,
			codebaseIndexEmbedderType,
			codebaseIndexEmbedderBaseUrl,
			codebaseIndexEmbedderModelId,
		} = codebaseIndexConfig

		const openAiKey = this.contextProxy?.getSecret("codeIndexOpenAiKey") ?? ""
		const qdrantApiKey = this.contextProxy?.getSecret("codeIndexQdrantApiKey") ?? ""

		this.isEnabled = codebaseIndexEnabled || false
		this.qdrantUrl = codebaseIndexQdrantUrl
		this.qdrantApiKey = qdrantApiKey ?? ""
		this.openAiOptions = { openAiNativeApiKey: openAiKey }

		this.embedderType = codebaseIndexEmbedderType === "ollama" ? "ollama" : "openai"

		this.ollamaOptions = {
			ollamaBaseUrl: codebaseIndexEmbedderBaseUrl,
			ollamaModelId: codebaseIndexEmbedderModelId,
		}

		const nowConfigured = this.isConfigured()

		if (!this.isEnabled) {
			this.stopWatcher()
			this._embedder = undefined
			this._vectorStore = undefined
			console.log("[CodeIndexManager] Code Indexing Disabled.")
			this._setSystemState("Standby", "Code Indexing Disabled.")
			return
		}

		if (!nowConfigured) {
			this.stopWatcher()
			this._embedder = undefined
			this._vectorStore = undefined
			console.log("[CodeIndexManager] Missing configuration.")
			this._setSystemState("Standby", "Missing configuration.")
			return
		}

		// Only recreate embedder/client and restart indexing if transitioning from disabled/unconfigured to enabled+configured or if settings change
		const shouldRestart = this._didConfigChangeRequireRestart(previousConfigSnapshot)

		if (shouldRestart && nowConfigured) {
			await this._initDependencies()
		} else {
			console.log("[CodeIndexManager] Configuration loaded. No restart needed.")
			// If already configured and enabled, ensure state reflects readiness if standby
			if (this._systemStatus === "Standby") {
				this._setSystemState("Standby", "Configuration ready. Ready to index.")
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
			if (!this._vectorStore) {
				throw new Error(
					"Cannot initialize collection: Qdrant client cannot be initialized - configuration missing.",
				)
			}
			const collectionCreated = await this._vectorStore.initialize() // Call the existing initialize method

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
			const result = await this._scanner?.scanDirectory(this.workspacePath, this.context, (batchError: Error) => {
				this._setSystemState("Error", `Failed during initial scan batch: ${batchError.message}`)
			})

			if (!result) {
				throw new Error("Scan failed, is scanner initialized?")
			}

			const { stats } = result

			console.log(
				`[CodeIndexManager] Initial scan complete. Processed: ${stats.processed}, Skipped: ${stats.skipped}`,
			)

			await this._startWatcher()

			this._setSystemState("Indexed", "Workspace scan and watcher started.")
		} catch (error: any) {
			console.error("[CodeIndexManager] Error during indexing:", error)
			try {
				await this._vectorStore?.clearCollection()
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
			this._fileWatcher = undefined
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
				if (this.isConfigured()) {
					if (!this._vectorStore) {
						throw new Error("Vector store not initialized, is configuration correct?")
					}

					await this._vectorStore?.clearCollection()
					console.log("[CodeIndexManager] Vector collection cleared.")
					return
				}

				console.warn("[CodeIndexManager] Service not configured, skipping vector collection clear.")
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
		if (this.embedderType === "openai") {
			return !!(this.openAiOptions?.openAiNativeApiKey && this.qdrantUrl)
		} else if (this.embedderType === "ollama") {
			// Ollama model ID has a default, so only base URL is strictly required for config
			return !!(this.ollamaOptions?.ollamaBaseUrl && this.qdrantUrl)
		}
		return false // Should not happen if embedderType is always set correctly
	}

	/**
	 * Determines if a configuration change requires restarting the indexing process.
	 * @param prev The previous configuration snapshot
	 * @returns boolean indicating whether a restart is needed
	 */
	private _didConfigChangeRequireRestart(prev: PreviousConfigSnapshot): boolean {
		const nowConfigured = this.isConfigured() // Recalculate based on current state

		// Check for transition from disabled/unconfigured to enabled+configured
		const transitionedToReady = (!prev.enabled || !prev.configured) && this.isEnabled && nowConfigured
		if (transitionedToReady) return true

		// If wasn't ready before and isn't ready now, no restart needed for config change itself
		if (!prev.configured && !nowConfigured) return false
		// If was disabled and still is, no restart needed
		if (!prev.enabled && !this.isEnabled) return false

		// Check for changes in relevant settings if the feature is enabled (or was enabled)
		if (this.isEnabled || prev.enabled) {
			if (prev.embedderType !== this.embedderType) return true
			if (prev.openAiKey !== this.openAiOptions?.openAiNativeApiKey) return true
			if (
				this.embedderType === "ollama" &&
				(prev.ollamaBaseUrl !== this.ollamaOptions?.ollamaBaseUrl ||
					prev.ollamaModelId !== this.ollamaOptions?.ollamaModelId)
			) {
				return true
			}
			if (prev.qdrantApiKey !== this.qdrantApiKey) return true
			if (prev.qdrantUrl !== this.qdrantUrl) return true
		}

		return false // No change detected that requires restart
	}

	private async _startWatcher(): Promise<void> {
		if (this._fileWatcher) {
			console.log("[CodeIndexManager] File watcher already running.")
			return
		}

		// Ensure embedder and client are initialized before starting watcher
		if (!this._embedder || !this._vectorStore) {
			throw new Error("Cannot start watcher: Clients not initialized.")
		}

		this._setSystemState("Indexing", "Initializing file watcher...")

		this._fileWatcher = new FileWatcher(
			this.workspacePath,
			this.context,
			this._embedder, // Pass initialized embedder
			this._vectorStore, // Pass initialized client
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
		]

		console.log("[CodeIndexManager] File watcher started.")
	}

	public async searchIndex(query: string, limit: number): Promise<VectorStoreSearchResult[]> {
		if (!this.isEnabled || !this.isConfigured()) {
			throw new Error("Code index feature is disabled or not configured.")
		}
		if (this._systemStatus !== "Indexed" && this._systemStatus !== "Indexing") {
			// Allow search during Indexing too
			throw new Error(`Code index is not ready for search. Current state: ${this._systemStatus}`)
		}
		if (!this._embedder || !this._vectorStore) {
			// Attempt to initialize if needed
			if (this.isConfigured()) {
				this._initDependencies()
			} else {
				throw new Error("Code index components could not be initialized - configuration missing.")
			}
		}

		try {
			const embeddingResponse = await this._embedder?.createEmbeddings([query])
			const vector = embeddingResponse?.embeddings[0]
			if (!vector) {
				throw new Error("Failed to generate embedding for query.")
			}

			if (typeof this._vectorStore?.search !== "function") {
				// This check might be redundant if the client is always correctly initialized
				throw new Error("Qdrant client does not support search operation.")
			}

			const results = await this._vectorStore.search(vector, limit)
			return results
		} catch (error) {
			console.error("[CodeIndexManager] Error during search:", error)
			this._setSystemState("Error", `Search failed: ${(error as Error).message}`)
			throw error // Re-throw the error after setting state
		}
	}
}
