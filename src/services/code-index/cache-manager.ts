import * as vscode from "vscode"
import { createHash } from "crypto"
import { ICacheManager } from "./interfaces/cache"
import debounce from "lodash.debounce"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

/**
 * Manages the cache for code indexing
 */
export class CacheManager implements ICacheManager {
	private cachePath: vscode.Uri
	private progressPath: vscode.Uri
	private fileHashes: Record<string, string> = {}
	private indexingProgress: {
		lastIndexedBlock: number
		totalBlocks: number
		failedBatches: string[]
		lastError?: string
		timestamp: number
	} = {
		lastIndexedBlock: 0,
		totalBlocks: 0,
		failedBatches: [],
		timestamp: Date.now()
	}
	private _debouncedSaveCache: () => void
	private _debouncedSaveProgress: () => void

	/**
	 * Creates a new cache manager
	 * @param context VS Code extension context
	 * @param workspacePath Path to the workspace
	 */
	constructor(
		private context: vscode.ExtensionContext,
		private workspacePath: string,
	) {
		const workspaceHash = createHash("sha256").update(workspacePath).digest("hex")
		this.cachePath = vscode.Uri.joinPath(
			context.globalStorageUri,
			`roo-index-cache-${workspaceHash}.json`,
		)
		this.progressPath = vscode.Uri.joinPath(
			context.globalStorageUri,
			`roo-index-progress-${workspaceHash}.json`,
		)
		this._debouncedSaveCache = debounce(async () => {
			await this._performSave()
		}, 1500)
		this._debouncedSaveProgress = debounce(async () => {
			await this._performProgressSave()
		}, 1000)
	}

	/**
	 * Initializes the cache manager by loading the cache file and progress
	 */
	async initialize(): Promise<void> {
		try {
			const cacheData = await vscode.workspace.fs.readFile(this.cachePath)
			this.fileHashes = JSON.parse(cacheData.toString())
		} catch (error) {
			this.fileHashes = {}
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "initialize:cache",
			})
		}

		// Load progress data
		try {
			const progressData = await vscode.workspace.fs.readFile(this.progressPath)
			this.indexingProgress = JSON.parse(progressData.toString())
		} catch (error) {
			// Progress file doesn't exist or is corrupted - start fresh
			this.indexingProgress = {
				lastIndexedBlock: 0,
				totalBlocks: 0,
				failedBatches: [],
				timestamp: Date.now()
			}
		}
	}

	/**
	 * Saves the cache to disk
	 */
	private async _performSave(): Promise<void> {
		try {
			await safeWriteJson(this.cachePath.fsPath, this.fileHashes)
		} catch (error) {
			console.error("Failed to save cache:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "_performSave",
			})
		}
	}

	/**
	 * Clears the cache file by writing an empty object to it
	 */
	async clearCacheFile(): Promise<void> {
		try {
			await safeWriteJson(this.cachePath.fsPath, {})
			this.fileHashes = {}
		} catch (error) {
			console.error("Failed to clear cache file:", error, this.cachePath)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "clearCacheFile",
			})
		}
	}

	/**
	 * Gets the hash for a file path
	 * @param filePath Path to the file
	 * @returns The hash for the file or undefined if not found
	 */
	getHash(filePath: string): string | undefined {
		return this.fileHashes[filePath]
	}

	/**
	 * Updates the hash for a file path
	 * @param filePath Path to the file
	 * @param hash New hash value
	 */
	updateHash(filePath: string, hash: string): void {
		this.fileHashes[filePath] = hash
		this._debouncedSaveCache()
	}

	/**
	 * Deletes the hash for a file path
	 * @param filePath Path to the file
	 */
	deleteHash(filePath: string): void {
		delete this.fileHashes[filePath]
		this._debouncedSaveCache()
	}

	/**
	 * Gets a copy of all file hashes
	 * @returns A copy of the file hashes record
	 */
	getAllHashes(): Record<string, string> {
		return { ...this.fileHashes }
	}

	/**
	 * Saves progress data to disk
	 */
	private async _performProgressSave(): Promise<void> {
		try {
			await safeWriteJson(this.progressPath.fsPath, this.indexingProgress)
		} catch (error) {
			console.error("Failed to save progress:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "_performProgressSave",
			})
		}
	}

	/**
	 * Updates indexing progress
	 * @param indexedBlocks Number of blocks indexed so far
	 * @param totalBlocks Total number of blocks to index
	 */
	updateProgress(indexedBlocks: number, totalBlocks: number): void {
		this.indexingProgress.lastIndexedBlock = indexedBlocks
		this.indexingProgress.totalBlocks = totalBlocks
		this.indexingProgress.timestamp = Date.now()
		this._debouncedSaveProgress()
	}

	/**
	 * Records a failed batch for potential retry
	 * @param batchId Identifier for the failed batch
	 * @param error Error message
	 */
	recordFailedBatch(batchId: string, error: string): void {
		if (!this.indexingProgress.failedBatches.includes(batchId)) {
			this.indexingProgress.failedBatches.push(batchId)
		}
		this.indexingProgress.lastError = error
		this.indexingProgress.timestamp = Date.now()
		this._debouncedSaveProgress()
	}

	/**
	 * Gets the current indexing progress
	 * @returns Progress information
	 */
	getProgress(): {
		lastIndexedBlock: number
		totalBlocks: number
		failedBatches: string[]
		lastError?: string
		timestamp: number
	} {
		return { ...this.indexingProgress }
	}

	/**
	 * Clears progress data
	 */
	clearProgress(): void {
		this.indexingProgress = {
			lastIndexedBlock: 0,
			totalBlocks: 0,
			failedBatches: [],
			timestamp: Date.now()
		}
		this._debouncedSaveProgress()
	}

	/**
	 * Clears both cache and progress files
	 */
	async clearAll(): Promise<void> {
		await this.clearCacheFile()
		this.clearProgress()
		try {
			await vscode.workspace.fs.delete(this.progressPath)
		} catch (error) {
			// Progress file might not exist, which is fine
		}
	}
}
