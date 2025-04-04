import * as vscode from "vscode"
import * as path from "path"
import { createHash } from "crypto"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { getWorkspacePath } from "../../utils/path"
import { extensions } from "../tree-sitter"
import { parseCodeFileBySize, CodeBlock } from "./parser"
import { CodeIndexOpenAiEmbedder } from "./openai-embedder"
import { CodeIndexQdrantClient } from "./qdrant-client"
import { ApiHandlerOptions } from "../../shared/api"

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 // 1MB

export class CodeIndexFileWatcher {
	private watcher: vscode.FileSystemWatcher
	private ignoreController: RooIgnoreController
	private embedder?: CodeIndexOpenAiEmbedder
	private qdrantClient?: CodeIndexQdrantClient
	private hashCache: Record<string, string> = {}
	private cachePath?: vscode.Uri
	private debounceTimers: Record<string, NodeJS.Timeout> = {}

	private _onDidStartProcessing = new vscode.EventEmitter<string>()
	private _onDidFinishProcessing = new vscode.EventEmitter<{ path: string; error?: Error }>()
	private _onError = new vscode.EventEmitter<Error>()

	public readonly onDidStartProcessing = this._onDidStartProcessing.event
	public readonly onDidFinishProcessing = this._onDidFinishProcessing.event
	public readonly onError = this._onError.event

	constructor(
		private workspacePath: string,
		private context: vscode.ExtensionContext,
		openAiOptions?: ApiHandlerOptions,
		qdrantUrl?: string,
	) {
		// Initialize ignore controller
		this.ignoreController = new RooIgnoreController(workspacePath)

		// Initialize clients if options provided
		if (openAiOptions && qdrantUrl) {
			this.embedder = new CodeIndexOpenAiEmbedder(openAiOptions)
			this.qdrantClient = new CodeIndexQdrantClient(workspacePath, qdrantUrl)
		}

		// Initialize cache path
		this.cachePath = vscode.Uri.joinPath(
			context.globalStorageUri,
			`roo-index-cache-${createHash("sha256").update(workspacePath).digest("hex")}.json`,
		)

		// Create file system watcher
		this.watcher = vscode.workspace.createFileSystemWatcher("**/*")

		// Setup event handlers with debouncing
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

		// Clear any pending debounce timer for this file
		if (this.debounceTimers[filePath]) {
			clearTimeout(this.debounceTimers[filePath])
			delete this.debounceTimers[filePath]
		}

		// Debounce the event handling
		this.debounceTimers[filePath] = setTimeout(async () => {
			let hadError = false
			this._onDidStartProcessing.fire(filePath)

			try {
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
			} catch (error) {
				hadError = true
				console.error(`Error handling file ${eventType} event for ${filePath}:`, error)
				this._onDidFinishProcessing.fire({ path: filePath, error: error as Error })
				this._onError.fire(error as Error)
			} finally {
				if (!hadError) {
					this._onDidFinishProcessing.fire({ path: filePath })
				}
				delete this.debounceTimers[filePath]
			}
		}, 500) // 500ms debounce
	}

	private async shouldProcessFile(filePath: string): Promise<boolean> {
		// Check file extension
		const ext = path.extname(filePath).toLowerCase()
		if (!extensions.includes(ext)) {
			return false
		}

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

					return {
						id: `${block.file_path}:${block.start_line}-${block.end_line}`,
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

			// Delete old points if they exist
			if (this.qdrantClient) {
				await this.qdrantClient.deletePointsByFilePath(filePath)
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

					return {
						id: `${block.file_path}:${block.start_line}-${block.end_line}`,
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

	dispose(): void {
		this.watcher.dispose()
		Object.values(this.debounceTimers).forEach(clearTimeout)
		this._onDidStartProcessing.dispose()
		this._onDidFinishProcessing.dispose()
		this._onError.dispose()
	}
}
