import * as vscode from "vscode"
import { createHash } from "crypto"
import * as path from "path"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager, IndexingState } from "./state-manager"
import { CodeIndexServiceFactory } from "./service-factory"
import { FileProcessingResult, IFileWatcher, IVectorStore } from "./interfaces"
import { DirectoryScanner } from "./processors"

/**
 * Manages the code indexing workflow, coordinating between different services and managers.
 */
export class CodeIndexOrchestrator {
	private _fileWatcher?: IFileWatcher
	private _fileWatcherSubscriptions: vscode.Disposable[] = []
	private _isProcessing: boolean = false
	private _scanner?: DirectoryScanner
	private _vectorStore?: IVectorStore

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly stateManager: CodeIndexStateManager,
		private readonly serviceFactory: CodeIndexServiceFactory,
		private readonly context: vscode.ExtensionContext,
		private readonly workspacePath: string,
	) {}

	/**
	 * Resets the cache file to an empty state.
	 */
	private async _resetCacheFile(): Promise<void> {
		try {
			const cacheFileName = `roo-index-cache-${createHash("sha256").update(this.workspacePath).digest("hex")}.json`
			const cachePath = vscode.Uri.joinPath(this.context.globalStorageUri, cacheFileName)

			try {
				await vscode.workspace.fs.writeFile(cachePath, Buffer.from("{}", "utf-8"))
				console.log(`[CodeIndexOrchestrator] Cache file reset (emptied) at ${cachePath.fsPath}`)
			} catch (error) {
				console.error("[CodeIndexOrchestrator] Failed to reset (empty) cache file:", error)
			}
		} catch (error) {
			console.error("[CodeIndexOrchestrator] Unexpected error during cache file reset:", error)
		}
	}

	/**
	 * Starts the file watcher if not already running.
	 */
	private async _startWatcher(): Promise<void> {
		if (this._fileWatcher) {
			console.log("[CodeIndexOrchestrator] File watcher already running.")
			return
		}

		if (!this.configManager.isFeatureConfigured) {
			throw new Error("Cannot start watcher: Service not configured.")
		}

		this.stateManager.setSystemState("Indexing", "Initializing file watcher...")

		try {
			const services = this.serviceFactory.createServices(this.context)
			this._fileWatcher = services.fileWatcher
			await this._fileWatcher.initialize()

			this._fileWatcherSubscriptions = [
				this._fileWatcher.onDidStartProcessing((filePath: string) => {
					this._updateFileStatus(filePath, "Processing", `Processing file: ${path.basename(filePath)}`)
				}),
				this._fileWatcher.onDidFinishProcessing((event: FileProcessingResult) => {
					if (event.error) {
						this._updateFileStatus(event.path, "Error")
						console.error(`[CodeIndexOrchestrator] Error processing file ${event.path}:`, event.error)
					} else {
						this._updateFileStatus(
							event.path,
							"Indexed",
							`Finished processing ${path.basename(event.path)}. Index up-to-date.`,
						)
					}

					if (this.stateManager.state === "Indexing") {
						this.stateManager.setSystemState("Indexed", "Index up-to-date.")
					}
				}),
			]

			console.log("[CodeIndexOrchestrator] File watcher started.")
		} catch (error) {
			console.error("[CodeIndexOrchestrator] Failed to start file watcher:", error)
			throw error
		}
	}

	/**
	 * Updates the status of a file in the state manager.
	 */
	private _updateFileStatus(filePath: string, fileStatus: string, message?: string): void {
		if (!this.configManager.isFeatureConfigured) {
			console.warn(
				"[CodeIndexOrchestrator] Ignoring file status update because system is not properly configured.",
			)
			return
		}
		this.stateManager.updateFileStatus(filePath, fileStatus, message)
	}

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */
	public async startIndexing(): Promise<void> {
		if (!this.configManager.isFeatureConfigured) {
			this.stateManager.setSystemState("Standby", "Cannot start: Missing configuration.")
			console.warn("[CodeIndexOrchestrator] Start rejected: Missing configuration.")
			return
		}

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

		this._isProcessing = true
		this.stateManager.setSystemState("Indexing", "Initializing services...")

		try {
			this.configManager.loadConfiguration()
			const services = this.serviceFactory.createServices(this.context)
			this._vectorStore = services.vectorStore
			this._scanner = services.scanner

			const collectionCreated = await this._vectorStore.initialize()

			if (collectionCreated) {
				await this._resetCacheFile()
				console.log("[CodeIndexOrchestrator] Qdrant collection created; cache file emptied.")
			}

			this.stateManager.setSystemState("Indexing", "Services ready. Starting workspace scan...")

			let cumulativeBlocksIndexed = 0
			let cumulativeBlocksFoundSoFar = 0

			const handleFileParsed = (fileBlockCount: number) => {
				cumulativeBlocksFoundSoFar += fileBlockCount
				this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
			}

			const handleBlocksIndexed = (indexedCount: number) => {
				cumulativeBlocksIndexed += indexedCount
				this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
			}

			const result = await this._scanner.scanDirectory(
				this.workspacePath,
				this.context,
				(batchError: Error) => {
					console.error(
						`[CodeIndexOrchestrator] Error during initial scan batch: ${batchError.message}`,
						batchError,
					)
				},
				handleBlocksIndexed,
				handleFileParsed,
			)

			if (!result) {
				throw new Error("Scan failed, is scanner initialized?")
			}

			const { stats } = result

			console.log(
				`[CodeIndexOrchestrator] Initial scan complete. Processed Files: ${stats.processed}, Skipped Files: ${stats.skipped}, Blocks Found: ${result.totalBlockCount}, Blocks Indexed: ${cumulativeBlocksIndexed}`,
			)

			await this._startWatcher()

			this.stateManager.setSystemState("Indexed", "Workspace scan and watcher started.")
		} catch (error: any) {
			console.error("[CodeIndexOrchestrator] Error during indexing:", error)
			try {
				await this._vectorStore?.clearCollection()
			} catch (cleanupError) {
				console.error("[CodeIndexOrchestrator] Failed to clean up after error:", cleanupError)
			}

			await this._resetCacheFile()
			console.log("[CodeIndexOrchestrator] Cleared cache file due to scan error.")

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
		if (this._fileWatcher) {
			this._fileWatcher.dispose()
			this._fileWatcher = undefined
			this._fileWatcherSubscriptions.forEach((sub) => sub.dispose())
			this._fileWatcherSubscriptions = []
			console.log("[CodeIndexOrchestrator] File watcher stopped.")

			if (this.stateManager.state !== "Error") {
				this.stateManager.setSystemState("Standby", "File watcher stopped.")
			}
		}
		this._isProcessing = false
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the vector store,
	 * and resetting the cache file.
	 */
	public async clearIndexData(): Promise<void> {
		console.log("[CodeIndexOrchestrator] Clearing code index data...")
		this._isProcessing = true

		try {
			await this.stopWatcher()

			try {
				if (this.configManager.isFeatureConfigured) {
					if (!this._vectorStore) {
						const services = this.serviceFactory.createServices(this.context)
						this._vectorStore = services.vectorStore
					}

					await this._vectorStore.deleteCollection()
					console.log("[CodeIndexOrchestrator] Vector collection deleted.")
				} else {
					console.warn("[CodeIndexOrchestrator] Service not configured, skipping vector collection clear.")
				}
			} catch (error: any) {
				console.error("[CodeIndexOrchestrator] Failed to clear vector collection:", error)
				this.stateManager.setSystemState("Error", `Failed to clear vector collection: ${error.message}`)
			}

			await this._resetCacheFile()
			console.log("[CodeIndexOrchestrator] Cache file emptied.")

			if (this.stateManager.state !== "Error") {
				this.stateManager.setSystemState("Standby", "Index data cleared successfully.")
				console.log("[CodeIndexOrchestrator] Code index data cleared successfully.")
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
