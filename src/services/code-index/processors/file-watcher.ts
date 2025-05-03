import * as vscode from "vscode"
import * as path from "path"
import { createHash } from "crypto"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"
import { getWorkspacePath } from "../../../utils/path"
import { v5 as uuidv5 } from "uuid"
import { scannerExtensions } from "../shared/supported-extensions"
import { IFileWatcher, FileProcessingResult, IEmbedder, IVectorStore } from "../interfaces"
import { codeParser } from "./parser"

const QDRANT_CODE_BLOCK_NAMESPACE = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 // 1MB

/**
 * Implementation of the file watcher interface
 */
export class FileWatcher implements IFileWatcher {
	private fileWatcher?: vscode.FileSystemWatcher
	private ignoreController: RooIgnoreController
	private cachePath: vscode.Uri
	private fileHashes: Record<string, string> = {}

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
	 */
	constructor(
		private workspacePath: string,
		private context: vscode.ExtensionContext,
		private embedder?: IEmbedder,
		private vectorStore?: IVectorStore,
	) {
		this.ignoreController = new RooIgnoreController(workspacePath)

		this.cachePath = vscode.Uri.joinPath(
			context.globalStorageUri,
			`roo-index-cache-${createHash("sha256").update(workspacePath).digest("hex")}.json`,
		)
	}

	/**
	 * Initializes the file watcher
	 */
	async initialize(): Promise<void> {
		// Load cache
		try {
			const cacheData = await vscode.workspace.fs.readFile(this.cachePath)
			this.fileHashes = JSON.parse(cacheData.toString())
		} catch (error) {
			console.log("No cache file found or error reading cache, starting fresh")
			this.fileHashes = {}
		}

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
	}

	/**
	 * Handles file creation events
	 * @param uri URI of the created file
	 */
	private async handleFileCreated(uri: vscode.Uri): Promise<void> {
		await this.processFile(uri.fsPath)
	}

	/**
	 * Handles file change events
	 * @param uri URI of the changed file
	 */
	private async handleFileChanged(uri: vscode.Uri): Promise<void> {
		await this.processFile(uri.fsPath)
	}

	/**
	 * Handles file deletion events
	 * @param uri URI of the deleted file
	 */
	private async handleFileDeleted(uri: vscode.Uri): Promise<void> {
		const filePath = uri.fsPath

		// Delete from cache
		if (this.fileHashes[filePath]) {
			delete this.fileHashes[filePath]
			await this.saveCache()
		}

		// Delete from vector store
		if (this.vectorStore) {
			try {
				await this.vectorStore.deletePointsByFilePath(filePath)
				console.log(`[FileWatcher] Deleted points for removed file: ${filePath}`)
			} catch (error) {
				console.error(`[FileWatcher] Failed to delete points for ${filePath}:`, error)
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
				const result = {
					path: filePath,
					status: "skipped" as const,
					reason: "File is ignored by .rooignore",
				}
				this._onDidFinishProcessing.fire(result)
				return result
			}

			// Check file size
			const fileStat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
			if (fileStat.size > MAX_FILE_SIZE_BYTES) {
				const result = {
					path: filePath,
					status: "skipped" as const,
					reason: "File is too large",
				}
				this._onDidFinishProcessing.fire(result)
				return result
			}

			// Read file content
			const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
			const content = fileContent.toString()

			// Calculate hash
			const newHash = createHash("sha256").update(content).digest("hex")

			// Check if file has changed
			if (this.fileHashes[filePath] === newHash) {
				const result = {
					path: filePath,
					status: "skipped" as const,
					reason: "File has not changed",
				}
				this._onDidFinishProcessing.fire(result)
				return result
			}

			// Delete old points
			if (this.vectorStore) {
				try {
					await this.vectorStore.deletePointsByFilePath(filePath)
					console.log(`[FileWatcher] Deleted existing points for changed file: ${filePath}`)
				} catch (error) {
					console.error(`[FileWatcher] Failed to delete points for ${filePath}:`, error)
					throw error
				}
			}

			// Parse file
			const blocks = await codeParser.parseFile(filePath, { content, fileHash: newHash })

			// Create embeddings and upsert points
			if (this.embedder && this.vectorStore && blocks.length > 0) {
				const texts = blocks.map((block) => block.content)
				const { embeddings } = await this.embedder.createEmbeddings(texts)

				const workspaceRoot = getWorkspacePath()
				const points = blocks.map((block, index) => {
					const absolutePath = path.resolve(workspaceRoot, block.file_path)
					const normalizedAbsolutePath = path.normalize(absolutePath)

					const stableName = `${normalizedAbsolutePath}:${block.start_line}`
					const pointId = uuidv5(stableName, QDRANT_CODE_BLOCK_NAMESPACE)

					return {
						id: pointId,
						vector: embeddings[index],
						payload: {
							filePath: normalizedAbsolutePath,
							codeChunk: block.content,
							startLine: block.start_line,
							endLine: block.end_line,
						},
					}
				})

				await this.vectorStore.upsertPoints(points)
			}

			// Update cache
			this.fileHashes[filePath] = newHash
			await this.saveCache()

			const result = {
				path: filePath,
				status: "success" as const,
			}
			this._onDidFinishProcessing.fire(result)
			return result
		} catch (error) {
			const result = {
				path: filePath,
				status: "error" as const,
				error: error as Error,
			}
			this._onDidFinishProcessing.fire(result)
			return result
		}
	}

	/**
	 * Saves the cache to disk
	 */
	private async saveCache(): Promise<void> {
		try {
			await vscode.workspace.fs.writeFile(this.cachePath, Buffer.from(JSON.stringify(this.fileHashes, null, 2)))
		} catch (error) {
			console.error("Failed to save cache:", error)
		}
	}
}
