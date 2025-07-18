import * as vscode from "vscode"
import * as path from "path"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager, IndexingState } from "./state-manager"
import { IFileWatcher, IVectorStore, BatchProcessingSummary } from "./interfaces"
import { DirectoryScanner } from "./processors"
import { CacheManager } from "./cache-manager"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

/**
 * Manages the code indexing workflow, coordinating between different services and managers.
 */
export class CodeIndexOrchestrator {
	private _fileWatcherSubscriptions: vscode.Disposable[] = []
	private _isProcessing: boolean = false

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly stateManager: CodeIndexStateManager,
		private readonly workspacePath: string,
		private readonly cacheManager: CacheManager,
		private readonly vectorStore: IVectorStore,
		private readonly scanner: DirectoryScanner,
		private readonly fileWatcher: IFileWatcher,
	) {}

	/**
	 * Starts the file watcher if not already running.
	 */
	private async _startWatcher(): Promise<void> {
		if (!this.configManager.isFeatureConfigured) {
			throw new Error("Cannot start watcher: Service not configured.")
		}

		this.stateManager.setSystemState("Indexing", "Initializing file watcher...")

		try {
			await this.fileWatcher.initialize()

			this._fileWatcherSubscriptions = [
				this.fileWatcher.onDidStartBatchProcessing((filePaths: string[]) => {}),
				this.fileWatcher.onBatchProgressUpdate(({ processedInBatch, totalInBatch, currentFile }) => {
					if (totalInBatch > 0 && this.stateManager.state !== "Indexing") {
						this.stateManager.setSystemState("Indexing", "Processing file changes...")
					}
					this.stateManager.reportFileQueueProgress(
						processedInBatch,
						totalInBatch,
						currentFile ? path.basename(currentFile) : undefined,
					)
					if (processedInBatch === totalInBatch) {
						// Covers (N/N) and (0/0)
						if (totalInBatch > 0) {
							// Batch with items completed
							this.stateManager.setSystemState("Indexed", "File changes processed. Index up-to-date.")
						} else {
							if (this.stateManager.state === "Indexing") {
								// Only transition if it was "Indexing"
								this.stateManager.setSystemState("Indexed", "Index up-to-date. File queue empty.")
							}
						}
					}
				}),
				this.fileWatcher.onDidFinishBatchProcessing((summary: BatchProcessingSummary) => {
					if (summary.batchError) {
						console.error(`[CodeIndexOrchestrator] Batch processing failed:`, summary.batchError)
					} else {
						const successCount = summary.processedFiles.filter(
							(f: { status: string }) => f.status === "success",
						).length
						const errorCount = summary.processedFiles.filter(
							(f: { status: string }) => f.status === "error" || f.status === "local_error",
						).length
					}
				}),
			]
		} catch (error) {
			console.error("[CodeIndexOrchestrator] Failed to start file watcher:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "_startWatcher",
			})
			throw error
		}
	}

	/**
	 * Updates the status of a file in the state manager.
	 */

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */
	public async startIndexing(): Promise<void> {
		if (!this.configManager.isFeatureConfigured) {
			this.stateManager.setSystemState("Standby", "Missing configuration. Save your settings to start indexing.")
			console.warn("[CodeIndexOrchestrator] Start rejected: Missing configuration.")
			return
		}

		// Allow restarting from Error state - this fixes the restart issue
		if (
			this._isProcessing ||
			(this.stateManager.state !== "Standby" &&
				this.stateManager.state !== "Error" &&
				this.stateManager.state !== "Indexed")
		) {
			console.warn(
				`[CodeIndexOrchestrator] Start rejected: Already processing or in state ${this.stateManager.state}.`,
			)
			return
		}

		// Reset error state when restarting
		if (this.stateManager.state === "Error") {
			console.log("[CodeIndexOrchestrator] Restarting indexing from error state")
			this.stateManager.setSystemState("Standby", "Restarting indexing...")
		}

		this._isProcessing = true
		this.stateManager.setSystemState("Indexing", "Initializing services...")

		try {
			const collectionCreated = await this.vectorStore.initialize()

			if (collectionCreated) {
				await this.cacheManager.clearCacheFile()
			}

			this.stateManager.setSystemState("Indexing", "Services ready. Starting workspace scan...")

			let cumulativeBlocksIndexed = 0
			let cumulativeBlocksFoundSoFar = 0
			let batchErrors: Error[] = []

			const handleFileParsed = (fileBlockCount: number) => {
				cumulativeBlocksFoundSoFar += fileBlockCount
				this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
			}

			const handleBlocksIndexed = (indexedCount: number) => {
				cumulativeBlocksIndexed += indexedCount
				this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
			}

			const result = await this.scanner.scanDirectory(
				this.workspacePath,
				(batchError: Error) => {
					console.error(
						`[CodeIndexOrchestrator] Error during initial scan batch: ${batchError.message}`,
						batchError,
					)
					batchErrors.push(batchError)
				},
				handleBlocksIndexed,
				handleFileParsed,
			)

			if (!result) {
				throw new Error("Scan failed, is scanner initialized?")
			}

			const { stats } = result

			// Enhanced failure handling with better error messages and recovery options
			const totalBlocksFound = cumulativeBlocksFoundSoFar
			const totalBlocksIndexed = cumulativeBlocksIndexed
			const failureRate = totalBlocksFound > 0 ? (totalBlocksFound - totalBlocksIndexed) / totalBlocksFound : 0

			// Check if any blocks were actually indexed successfully
			if (totalBlocksIndexed === 0 && totalBlocksFound > 0) {
				if (batchErrors.length > 0) {
					// Use the first batch error as it's likely representative of the main issue
					const firstError = batchErrors[0]
					const errorMessage = `Indexing failed: ${firstError.message}`
					
					// Add specific guidance for common issues
					if (firstError.message.includes("rate limit") || firstError.message.includes("429")) {
						throw new Error(`${errorMessage}\n\nSuggestion: The API rate limit was exceeded. Try again in a few minutes, or consider using a smaller embedding model like text-embedding-3-small for large codebases.`)
					} else if (firstError.message.includes("authentication") || firstError.message.includes("401")) {
						throw new Error(`${errorMessage}\n\nSuggestion: Check your API key configuration in the settings.`)
					} else if (firstError.message.includes("quota") || firstError.message.includes("billing")) {
						throw new Error(`${errorMessage}\n\nSuggestion: Check your OpenAI account billing and usage limits.`)
					}
					
					throw new Error(errorMessage)
				} else {
					throw new Error(
						"Indexing failed: No code blocks were successfully indexed. This usually indicates an embedder configuration issue.\n\nSuggestion: Verify your API settings and try again.",
					)
				}
			}

			// Handle partial failures more gracefully
			if (batchErrors.length > 0) {
				const firstError = batchErrors[0]
				
				// If failure rate is high (>50%), treat as critical failure
				if (failureRate > 0.5) {
					throw new Error(
						`Indexing mostly failed: Only ${totalBlocksIndexed} of ${totalBlocksFound} blocks were indexed (${Math.round(failureRate * 100)}% failure rate). ${firstError.message}\n\nSuggestion: Check your network connection and API configuration, then try again.`,
					)
				}
				
				// If failure rate is moderate (10-50%), log warning but continue
				if (failureRate > 0.1) {
					console.warn(
						`[CodeIndexOrchestrator] Partial indexing failure: ${totalBlocksIndexed}/${totalBlocksFound} blocks indexed (${Math.round(failureRate * 100)}% failure rate). Error: ${firstError.message}`,
					)
					
					// Set a warning state but don't fail completely
					this.stateManager.setSystemState("Indexed",
						`Indexing completed with warnings: ${totalBlocksIndexed}/${totalBlocksFound} blocks indexed. Some files may have been skipped due to API issues.`
					)
				}
			}

			// Final sanity check: If we found blocks but indexed none and somehow no errors were reported,
			// this is still a failure
			if (totalBlocksFound > 0 && totalBlocksIndexed === 0 && batchErrors.length === 0) {
				throw new Error(
					"Indexing failed: No code blocks were successfully indexed despite finding files to process. This indicates a critical embedder failure.\n\nSuggestion: Check your embedder configuration and try again.",
				)
			}

			await this._startWatcher()

			this.stateManager.setSystemState("Indexed", "File watcher started.")
		} catch (error: any) {
			console.error("[CodeIndexOrchestrator] Error during indexing:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "startIndexing",
			})
			try {
				await this.vectorStore.clearCollection()
			} catch (cleanupError) {
				console.error("[CodeIndexOrchestrator] Failed to clean up after error:", cleanupError)
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
					stack: cleanupError instanceof Error ? cleanupError.stack : undefined,
					location: "startIndexing.cleanup",
				})
			}

			await this.cacheManager.clearCacheFile()

			this.stateManager.setSystemState("Error", `Failed during initial scan: ${error.message || "Unknown error"}`)
			this.stopWatcher()
		} finally {
			this._isProcessing = false
		}
	}

	/**
	 * Stops the file watcher and cleans up resources.
	 */
	public stopWatcher(): void {
		this.fileWatcher.dispose()
		this._fileWatcherSubscriptions.forEach((sub) => sub.dispose())
		this._fileWatcherSubscriptions = []

		if (this.stateManager.state !== "Error") {
			this.stateManager.setSystemState("Standby", "File watcher stopped.")
		}
		this._isProcessing = false
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the vector store,
	 * and resetting the cache file.
	 */
	public async clearIndexData(): Promise<void> {
		this._isProcessing = true

		try {
			await this.stopWatcher()

			try {
				if (this.configManager.isFeatureConfigured) {
					await this.vectorStore.deleteCollection()
				} else {
					console.warn("[CodeIndexOrchestrator] Service not configured, skipping vector collection clear.")
				}
			} catch (error: any) {
				console.error("[CodeIndexOrchestrator] Failed to clear vector collection:", error)
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "clearIndexData",
				})
				this.stateManager.setSystemState("Error", `Failed to clear vector collection: ${error.message}`)
			}

			await this.cacheManager.clearCacheFile()

			if (this.stateManager.state !== "Error") {
				this.stateManager.setSystemState("Standby", "Index data cleared successfully.")
			}
		} finally {
			this._isProcessing = false
		}
	}

	/**
	 * Gets the current state of the indexing system.
	 */
	public get state(): IndexingState {
		return this.stateManager.state
	}
}
