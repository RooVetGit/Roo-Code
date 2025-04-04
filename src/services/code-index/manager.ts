import * as vscode from "vscode"
import { scanDirectoryForCodeBlocks } from "./scanner"
import { CodeIndexFileWatcher } from "./file-watcher"
import { ApiHandlerOptions } from "../../shared/api"
import { getWorkspacePath } from "../../utils/path"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

// Define the structure for progress updates
export interface IndexProgressUpdate {
	state: IndexingState
	message?: string // For details like error messages or current activity
}

export class CodeIndexManager {
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

	private _state: IndexingState = "Standby"
	private _progressEmitter = new vscode.EventEmitter<IndexProgressUpdate>()
	private _fileWatcher: CodeIndexFileWatcher | null = null
	private _isProcessing: boolean = false // Flag to track active work (scan or watch event)
	private _fileWatcherSubscriptions: vscode.Disposable[] = []

	// Dependencies
	private readonly workspacePath: string
	private readonly context: vscode.ExtensionContext
	private openAiOptions?: ApiHandlerOptions // Configurable
	private qdrantUrl?: string // Configurable

	// Private constructor for singleton pattern
	private constructor(workspacePath: string, context: vscode.ExtensionContext) {
		this.workspacePath = workspacePath
		this.context = context
		this.updateState("Standby", "Awaiting configuration and start signal.")
	}

	// --- Public API ---

	public readonly onProgressUpdate = this._progressEmitter.event

	public get state(): IndexingState {
		return this._state
	}

	/**
	 * Updates the configuration required for indexing.
	 * If the service is in 'Standby' and configuration becomes valid,
	 * it might automatically attempt to start (or require a manual start).
	 */
	public updateConfiguration(config: { openAiOptions?: ApiHandlerOptions; qdrantUrl?: string }): void {
		let configChanged = false
		// Check if openAiOptions exists before accessing its properties
		if (
			config.openAiOptions &&
			(!this.openAiOptions || config.openAiOptions.openAiNativeApiKey !== this.openAiOptions.openAiNativeApiKey)
		) {
			this.openAiOptions = config.openAiOptions
			configChanged = true
		}
		if (config.qdrantUrl && config.qdrantUrl !== this.qdrantUrl) {
			this.qdrantUrl = config.qdrantUrl
			configChanged = true
		}

		if (configChanged) {
			console.log("[CodeIndexManager] Configuration updated.")
			// If we were waiting for config, check if we can proceed
			if (this._state === "Standby" && this.isConfigured()) {
				// Option 1: Automatically start
				// this.startIndexing();
				// Option 2: Signal readiness, require manual start
				this.updateState("Standby", "Configuration ready. Ready to index.")
			} else if (this._state !== "Standby") {
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
			this.updateState("Standby", "Cannot start: Missing OpenAI or Qdrant configuration.")
			console.warn("[CodeIndexManager] Start rejected: Missing configuration.")
			return
		}

		if (this._isProcessing || (this._state !== "Standby" && this._state !== "Error" && this._state !== "Indexed")) {
			console.warn(`[CodeIndexManager] Start rejected: Already processing or in state ${this._state}.`)
			return
		}

		this._isProcessing = true
		this.updateState("Indexing", "Starting initial scan...")

		try {
			// --- Initial Scan ---
			const { stats } = await scanDirectoryForCodeBlocks(
				this.workspacePath,
				undefined, // Let scanner create its own ignore controller
				this.openAiOptions,
				this.qdrantUrl,
				this.context,
				// TODO: Add callback/emitter here to report progress *during* scan if needed later
			)
			console.log(
				`[CodeIndexManager] Initial scan complete. Processed: ${stats.processed}, Skipped: ${stats.skipped}`,
			)

			// --- Start Watcher ---
			if (!this._fileWatcher) {
				this.updateState("Indexing", "Initializing file watcher...") // Still indexing phase
				this._fileWatcher = new CodeIndexFileWatcher(
					this.workspacePath,
					this.context,
					this.openAiOptions,
					this.qdrantUrl,
				)
				await this._fileWatcher.initialize()

				// Subscribe to file watcher events
				this._fileWatcherSubscriptions = [
					this._fileWatcher.onDidStartProcessing((filePath) => {
						this.updateState("Indexing", `Processing file: ${filePath}`)
					}),
					this._fileWatcher.onDidFinishProcessing((event) => {
						if (event.error) {
							this.updateState("Error", `Error processing ${event.path}: ${event.error.message}`)
						} else {
							this.updateState("Indexed", `Finished processing ${event.path}. Index up-to-date.`)
						}
					}),
					this._fileWatcher.onError((error) => {
						this.updateState("Error", `File watcher error: ${error.message}`)
					}),
				]
				console.log("[CodeIndexManager] File watcher started.")
			}

			this.updateState("Indexed", "Initial scan complete and watching for changes.") // Final state after successful start
		} catch (error: any) {
			console.error("[CodeIndexManager] Error during indexing startup:", error)
			this.updateState("Error", `Failed during startup: ${error.message || "Unknown error"}`)
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
			// Transition state appropriately
			if (this.state !== "Error") {
				this.updateState("Standby", "File watcher stopped.") // Return to standby if stopped manually
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

	// --- Private Helpers ---

	private updateState(newState: IndexingState, message?: string): void {
		const oldState = this._state
		if (oldState !== newState) {
			this._state = newState
			console.log(`[CodeIndexManager] State Change: ${oldState} -> ${newState} ${message ? `(${message})` : ""}`)
			this._progressEmitter.fire({ state: newState, message })
		} else if (message) {
			// Allow firing event with message even if state is the same (e.g., progress within 'Indexing')
			this._progressEmitter.fire({ state: newState, message })
		}
	}

	private isConfigured(): boolean {
		// Ensure openAiOptions itself exists before checking the key
		return !!(this.openAiOptions?.openAiNativeApiKey && this.qdrantUrl)
	}
}
