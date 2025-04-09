import * as vscode from "vscode"
import * as path from "path"
import { createHash } from "crypto"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { getWorkspacePath } from "../../utils/path"
import { extensions } from "../tree-sitter"
import { parseCodeFileBySize, CodeBlock } from "./parser"
import { CodeIndexOpenAiEmbedder } from "./openai-embedder"
import { CodeIndexQdrantClient } from "./qdrant-client"
import { v5 as uuidv5 } from "uuid"

const QDRANT_CODE_BLOCK_NAMESPACE = "f47ac10b-58cc-4372-a567-0e02b2c3d479"

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 // 1MB

export interface FileProcessingResult {
	path: string
	status: "success" | "skipped" | "error"
	error?: Error
	reason?: string
}

export class CodeIndexFileWatcher {
	private watcher: vscode.FileSystemWatcher
	private ignoreController: RooIgnoreController
	private embedder?: CodeIndexOpenAiEmbedder
	private qdrantClient?: CodeIndexQdrantClient
	private hashCache: Record<string, string> = {}
	private cachePath?: vscode.Uri
	private debounceTimers: Record<string, NodeJS.Timeout> = {}

	private _onDidStartProcessing = new vscode.EventEmitter<string>()
	private _onDidFinishProcessing = new vscode.EventEmitter<FileProcessingResult>()
	private _onError = new vscode.EventEmitter<Error>()

	public readonly onDidStartProcessing = this._onDidStartProcessing.event
	public readonly onDidFinishProcessing = this._onDidFinishProcessing.event
	public readonly onError = this._onError.event

	constructor(
		private workspacePath: string,
		private context: vscode.ExtensionContext,
		embedder?: CodeIndexOpenAiEmbedder,
		qdrantClient?: CodeIndexQdrantClient,
	) {
		this.ignoreController = new RooIgnoreController(workspacePath)

		this.embedder = embedder
		this.qdrantClient = qdrantClient

		this.cachePath = vscode.Uri.joinPath(
			context.globalStorageUri,
			`roo-index-cache-${createHash("sha256").update(workspacePath).digest("hex")}.json`,
		)

		const extGlob = `{${extensions.map((e) => e.slice(1)).join(",")}}`
		const pattern = `**/*.${extGlob}`
		this.watcher = vscode.workspace.createFileSystemWatcher(pattern)

		this.watcher.onDidCreate((uri) => this.handleFileEvent(uri, "create"))
		this.watcher.onDidChange((uri) => this.handleFileEvent(uri, "change"))
		this.watcher.onDidDelete((uri) => this.handleFileEvent(uri, "delete"))
	}

	async initialize(): Promise<void> {
		await this.ignoreController.initialize()
		if (this.qdrantClient) {
			await this.qdrantClient.initialize()
		}
		if (this.cachePath) {
			await this.loadHashCache()
		}
	}

	private async handleFileEvent(uri: vscode.Uri, eventType: "create" | "change" | "delete"): Promise<void> {
		const filePath = uri.fsPath

		// Check dependencies before scheduling debounce
		if (!this.embedder || !this.qdrantClient) {
			this._onDidFinishProcessing.fire({
				path: filePath,
				status: "skipped",
				reason: "Dependencies not initialized",
			})
			return
		}

		// Clear any pending debounce timer for this file
		if (this.debounceTimers[filePath]) {
			clearTimeout(this.debounceTimers[filePath])
			delete this.debounceTimers[filePath]
		}

		// Debounce the event handling
		this.debounceTimers[filePath] = setTimeout(async () => {
			let resultStatus: "success" | "skipped" | "error" = "skipped"
			let errorObj: Error | undefined = undefined

			try {
				// Double-check dependencies inside debounce
				if (!this.embedder || !this.qdrantClient) {
					resultStatus = "skipped"
					return
				}

				const shouldProcess = await this.shouldProcessFile(filePath)
				if (!shouldProcess) {
					resultStatus = "skipped"
					return
				}

				this._onDidStartProcessing.fire(filePath)

				switch (eventType) {
					case "create":
						await this.handleFileCreate(filePath)
						break
					case "change":
						await this.handleFileChange(filePath)
						break
					case "delete":
						await this.handleFileDelete(filePath)
						break
				}

				resultStatus = "success"
			} catch (error) {
				resultStatus = "error"
				errorObj = error as Error
				console.error(`Error handling file ${eventType} event for ${filePath}:`, errorObj)
				this._onError.fire(errorObj)
			} finally {
				this._onDidFinishProcessing.fire({
					path: filePath,
					status: resultStatus,
					error: errorObj,
				})
				delete this.debounceTimers[filePath]
			}
		}, 500) // 500ms debounce
	}

	private async shouldProcessFile(filePath: string): Promise<boolean> {
		// Check against .rooignore
		if (!this.ignoreController.filterPaths([filePath]).includes(filePath)) {
			return false
		}

		// Check file size
		try {
			const stats = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
			if (stats.size > MAX_FILE_SIZE_BYTES) {
				return false
			}
		} catch {
			return false
		}

		return true
	}

	private async handleFileCreate(filePath: string): Promise<void> {
		if (!(await this.shouldProcessFile(filePath))) {
			return
		}

		try {
			const content = await vscode.workspace.fs
				.readFile(vscode.Uri.file(filePath))
				.then((buffer) => Buffer.from(buffer).toString("utf-8"))

			const fileHash = createHash("sha256").update(content).digest("hex")
			const blocks = await parseCodeFileBySize(filePath, { content, fileHash })

			if (this.embedder && this.qdrantClient && blocks.length > 0) {
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

				await this.qdrantClient.upsertPoints(points)
			}

			this.hashCache[filePath] = fileHash
			await this.saveHashCache()
		} catch (error) {
			console.error(`Error processing created file ${filePath}:`, error)
		}
	}

	private async handleFileChange(filePath: string): Promise<void> {
		if (!(await this.shouldProcessFile(filePath))) {
			return
		}

		try {
			const content = await vscode.workspace.fs
				.readFile(vscode.Uri.file(filePath))
				.then((buffer) => Buffer.from(buffer).toString("utf-8"))

			const newHash = createHash("sha256").update(content).digest("hex")
			const oldHash = this.hashCache[filePath]

			if (oldHash === newHash) {
				return // File content hasn't changed
			}

			// Delete old points first
			if (this.qdrantClient) {
				try {
					// Assuming deletePointsByFilePath handles normalization
					await this.qdrantClient.deletePointsByFilePath(filePath)
					console.log(`[CodeIndexFileWatcher] Deleted existing points for changed file: ${filePath}`)
				} catch (deleteError) {
					console.error(
						`[CodeIndexFileWatcher] Failed to delete points for ${filePath} before upsert:`,
						deleteError,
					)
					// Re-throw the error to stop processing this file event
					throw deleteError
				}
			}

			// Process new content
			const blocks = await parseCodeFileBySize(filePath, { content, fileHash: newHash })

			if (this.embedder && this.qdrantClient && blocks.length > 0) {
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

				await this.qdrantClient.upsertPoints(points)
			}

			this.hashCache[filePath] = newHash
			await this.saveHashCache()
		} catch (error) {
			console.error(`Error processing changed file ${filePath}:`, error)
		}
	}

	private async handleFileDelete(filePath: string): Promise<void> {
		// Check if file was likely indexed
		if (this.hashCache[filePath] && this.qdrantClient) {
			try {
				const workspaceRoot = getWorkspacePath()
				const absolutePath = path.resolve(workspaceRoot, filePath)
				const normalizedAbsolutePath = path.normalize(absolutePath)
				await this.qdrantClient.deletePointsByFilePath(normalizedAbsolutePath)
				delete this.hashCache[filePath]
				await this.saveHashCache()
			} catch (error) {
				console.error(`Error processing deleted file ${filePath}:`, error)
			}
		}
	}

	private async loadHashCache(): Promise<void> {
		if (!this.cachePath) return
		try {
			const fileData = await vscode.workspace.fs.readFile(this.cachePath)
			this.hashCache = JSON.parse(Buffer.from(fileData).toString("utf-8"))
		} catch (error) {
			if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
				this.hashCache = {}
			} else {
				console.error("Error loading hash cache:", error)
				this.hashCache = {}
			}
		}
	}

	private async saveHashCache(): Promise<void> {
		if (!this.cachePath) return
		try {
			await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(this.cachePath.fsPath)))
			await vscode.workspace.fs.writeFile(
				this.cachePath,
				Buffer.from(JSON.stringify(this.hashCache, null, 2), "utf-8"),
			)
		} catch (error) {
			console.error("Error saving hash cache:", error)
		}
	}

	public async deleteCacheFile(): Promise<void> {
		if (!this.cachePath) return
		try {
			await vscode.workspace.fs.delete(this.cachePath, { useTrash: false })
			this.hashCache = {}
			console.log(`Successfully deleted cache file at ${this.cachePath.fsPath}`)
		} catch (error) {
			if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
				console.log("Cache file not found, nothing to delete")
			} else {
				console.error("Error deleting cache file:", error)
				throw error
			}
		}
	}

	public async clearCollection(): Promise<void> {
		if (!this.qdrantClient) {
			throw new Error("Qdrant client not initialized")
		}
		await this.qdrantClient.clearCollection()
	}

	dispose(): void {
		this.watcher.dispose()
		Object.values(this.debounceTimers).forEach(clearTimeout)
		this._onDidStartProcessing.dispose()
		this._onDidFinishProcessing.dispose()
		this._onError.dispose()
	}
	public async checkCollectionExists(): Promise<boolean> {
		if (!this.qdrantClient) {
			console.warn("[CodeIndexFileWatcher] Qdrant client not initialized; cannot check collection existence.")
			return false
		}
		return this.qdrantClient.collectionExists()
	}
}
