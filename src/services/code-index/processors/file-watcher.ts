import * as vscode from "vscode"
import { QDRANT_CODE_BLOCK_NAMESPACE, MAX_FILE_SIZE_BYTES } from "../constants"
import { createHash } from "crypto"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"
import { v5 as uuidv5 } from "uuid"
import { scannerExtensions } from "../shared/supported-extensions"
import { IFileWatcher, FileProcessingResult, IEmbedder, IVectorStore, PointStruct } from "../interfaces"
import { codeParser } from "./parser"
import { CacheManager } from "../cache-manager"
import { generateNormalizedAbsolutePath, generateRelativeFilePath } from "../shared/get-relative-path"

/**
 * Implementation of the file watcher interface
 */
export class FileWatcher implements IFileWatcher {
	private fileWatcher?: vscode.FileSystemWatcher
	private ignoreController: RooIgnoreController
	private eventQueue: { uri: vscode.Uri; type: "create" | "change" | "delete" }[] = []
	private processingMap: Map<string, Promise<FileProcessingResult | undefined>> = new Map()
	private isProcessing = false
	private deletedFilesBuffer: string[] = []
	private deleteTimer: NodeJS.Timeout | undefined

	private readonly _onDidStartProcessing = new vscode.EventEmitter<string>()
	private readonly _onDidFinishProcessing = new vscode.EventEmitter<FileProcessingResult>()

	/**
	 * Event emitted when a file starts processing
	 */
	public readonly onDidStartProcessing = this._onDidStartProcessing.event

	/**
	 * Event emitted when a file finishes processing
	 */
	public readonly onDidFinishProcessing = this._onDidFinishProcessing.event

	/**
	 * Creates a new file watcher
	 * @param workspacePath Path to the workspace
	 * @param context VS Code extension context
	 * @param embedder Optional embedder
	 * @param vectorStore Optional vector store
	 * @param cacheManager Cache manager
	 */
	constructor(
		private workspacePath: string,
		private context: vscode.ExtensionContext,
		private readonly cacheManager: CacheManager,
		private embedder?: IEmbedder,
		private vectorStore?: IVectorStore,
		ignoreController?: RooIgnoreController,
	) {
		this.ignoreController = ignoreController || new RooIgnoreController(workspacePath)
	}

	/**
	 * Initializes the file watcher
	 */
	async initialize(): Promise<void> {
		// Create file watcher
		const filePattern = new vscode.RelativePattern(
			this.workspacePath,
			`**/*{${scannerExtensions.map((e) => e.substring(1)).join(",")}}`,
		)
		this.fileWatcher = vscode.workspace.createFileSystemWatcher(filePattern)

		// Register event handlers
		this.fileWatcher.onDidCreate(this.handleFileCreated.bind(this))
		this.fileWatcher.onDidChange(this.handleFileChanged.bind(this))
		this.fileWatcher.onDidDelete(this.handleFileDeleted.bind(this))
	}

	/**
	 * Disposes the file watcher
	 */
	dispose(): void {
		this.fileWatcher?.dispose()
		this._onDidStartProcessing.dispose()
		this._onDidFinishProcessing.dispose()
		this.processingMap.clear()
		this.eventQueue = []
		clearTimeout(this.deleteTimer)
	}

	/**
	 * Handles file creation events
	 * @param uri URI of the created file
	 */
	private async handleFileCreated(uri: vscode.Uri): Promise<void> {
		this.eventQueue.push({ uri, type: "create" })
		this.startProcessing()
	}

	/**
	 * Handles file change events
	 * @param uri URI of the changed file
	 */
	private async handleFileChanged(uri: vscode.Uri): Promise<void> {
		this.eventQueue.push({ uri, type: "change" })
		this.startProcessing()
	}

	/**
	 * Handles file deletion events
	 * @param uri URI of the deleted file
	 */
	private async handleFileDeleted(uri: vscode.Uri): Promise<void> {
		this.eventQueue.push({ uri, type: "delete" })
		this.startProcessing()
	}

	/**
	 * Starts the processing loop if not already running
	 */
	private startProcessing(): void {
		if (!this.isProcessing) {
			this.isProcessing = true
			this.processQueue()
		}
	}

	/**
	 * Processes events from the queue
	 */
	private async processQueue(): Promise<void> {
		try {
			const filesToBatchProcess: FileProcessingResult[] = []

			while (this.eventQueue.length > 0) {
				const event = this.eventQueue.shift()!
				const filePath = event.uri.fsPath

				// Ensure sequential processing for the same file path
				const existingPromise = this.processingMap.get(filePath)
				const newPromise = (existingPromise || Promise.resolve())
					.then(async () => {
						const result = await this.processEvent(event)
						if (result) {
							if (result.status === "processed_for_batching") {
								filesToBatchProcess.push(result)
							} else if (
								result.status === "skipped" ||
								result.status === "local_error" ||
								result.status === "error" ||
								result.status === "success"
							) {
								this._onDidFinishProcessing.fire(result)
							}
						}
						return result
					})
					.finally(() => this.processingMap.delete(filePath))

				this.processingMap.set(filePath, newPromise)
				await newPromise
			}

			// Process batch operations if we have files to process
			if (filesToBatchProcess.length > 0 && this.vectorStore) {
				// Extract unique file paths that need deletion
				const pathsToDelete = [...new Set(filesToBatchProcess.map((f) => f.path))]
				// Extract all points to upsert
				const allPointsToUpsert = filesToBatchProcess.flatMap((f) => f.pointsToUpsert || [])

				try {
					// Batch delete old points
					if (pathsToDelete.length > 0) {
						await this.vectorStore.deletePointsByMultipleFilePaths(pathsToDelete)
					}

					// Batch upsert new points
					if (allPointsToUpsert.length > 0) {
						await this.vectorStore.upsertPoints(allPointsToUpsert)
					}

					// Update cache and fire success events
					for (const fileData of filesToBatchProcess) {
						if (fileData.newHash) {
							this.cacheManager.updateHash(fileData.path, fileData.newHash)
						}
						this._onDidFinishProcessing.fire({
							path: fileData.path,
							status: "success",
						})
					}
				} catch (error) {
					// Handle batch operation failures
					for (const fileData of filesToBatchProcess) {
						this._onDidFinishProcessing.fire({
							path: fileData.path,
							status: "error",
							error: error as Error,
						})
					}
				}
			}
		} finally {
			this.isProcessing = false
		}
	}

	/**
	 * Processes a single file system event
	 * @param event The file system event to process
	 */
	private async processEvent(event: {
		uri: vscode.Uri
		type: "create" | "change" | "delete"
	}): Promise<FileProcessingResult | undefined> {
		const filePath = event.uri.fsPath

		// For delete operations, process immediately
		if (event.type === "delete") {
			await this.processFileDeletion(filePath)
			return
		}

		// For create/change operations, check if the file is in the deletion buffer
		const bufferIndex = this.deletedFilesBuffer.indexOf(filePath)
		if (bufferIndex !== -1) {
			// Remove from buffer and delete immediately before processing the new version
			this.deletedFilesBuffer.splice(bufferIndex, 1)
			if (this.vectorStore) {
				await this.vectorStore.deletePointsByFilePath(filePath)
			}
		}

		// Also check if there's a pending delete in the queue
		const hasPendingDelete = this.eventQueue.some((e) => e.type === "delete" && e.uri.fsPath === filePath)

		if (hasPendingDelete) {
			// Wait for delete to be processed first
			return undefined
		}

		return await this.processFile(filePath)
	}

	/**
	 * Processes a file deletion
	 * @param filePath Path of the file to delete
	 */
	private async processFileDeletion(filePath: string): Promise<void> {
		// Delete from cache
		this.cacheManager.deleteHash(filePath)

		// Add to deletion buffer instead of deleting immediately
		this.deletedFilesBuffer.push(filePath)

		// Clear any existing timer
		if (this.deleteTimer) {
			clearTimeout(this.deleteTimer)
		}

		// Set a new timer to flush the buffer after a delay
		this.deleteTimer = setTimeout(() => {
			this.flushDeletedFiles()
		}, 500)
	}

	/**
	 * Processes the batch deletion of files from the buffer
	 */
	private async flushDeletedFiles(): Promise<void> {
		if (this.deletedFilesBuffer.length > 0 && this.vectorStore) {
			const filesToDelete = [...this.deletedFilesBuffer]

			try {
				await this.vectorStore.deletePointsByMultipleFilePaths(filesToDelete)
				console.log(`[FileWatcher] Batch deleted points for ${filesToDelete.length} files`)
			} catch (error) {
				console.error(`[FileWatcher] Failed to batch delete points:`, error)
			} finally {
				// Clear the buffer
				this.deletedFilesBuffer = []
			}
		}
	}

	/**
	 * Processes a file
	 * @param filePath Path to the file to process
	 * @returns Promise resolving to processing result
	 */
	async processFile(filePath: string): Promise<FileProcessingResult> {
		this._onDidStartProcessing.fire(filePath)

		try {
			// Check if file should be ignored
			if (!this.ignoreController.validateAccess(filePath)) {
				return {
					path: filePath,
					status: "skipped" as const,
					reason: "File is ignored by .rooignore",
				}
			}

			// Check file size
			const fileStat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
			if (fileStat.size > MAX_FILE_SIZE_BYTES) {
				return {
					path: filePath,
					status: "skipped" as const,
					reason: "File is too large",
				}
			}

			// Read file content
			const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
			const content = fileContent.toString()

			// Calculate hash
			const newHash = createHash("sha256").update(content).digest("hex")

			// Check if file has changed
			if (this.cacheManager.getHash(filePath) === newHash) {
				return {
					path: filePath,
					status: "skipped" as const,
					reason: "File has not changed",
				}
			}

			// Parse file
			const blocks = await codeParser.parseFile(filePath, { content, fileHash: newHash })

			// Prepare points for batch processing
			let pointsToUpsert: PointStruct[] = []
			if (this.embedder && this.vectorStore && blocks.length > 0) {
				const texts = blocks.map((block) => block.content)
				const { embeddings } = await this.embedder.createEmbeddings(texts)

				pointsToUpsert = blocks.map((block, index) => {
					const normalizedAbsolutePath = generateNormalizedAbsolutePath(block.file_path)
					const stableName = `${normalizedAbsolutePath}:${block.start_line}`
					const pointId = uuidv5(stableName, QDRANT_CODE_BLOCK_NAMESPACE)

					return {
						id: pointId,
						vector: embeddings[index],
						payload: {
							filePath: generateRelativeFilePath(normalizedAbsolutePath),
							codeChunk: block.content,
							startLine: block.start_line,
							endLine: block.end_line,
						},
					}
				})
			}

			return {
				path: filePath,
				status: "processed_for_batching" as const,
				newHash,
				pointsToUpsert,
			}
		} catch (error) {
			return {
				path: filePath,
				status: "local_error" as const,
				error: error as Error,
			}
		}
	}
}
