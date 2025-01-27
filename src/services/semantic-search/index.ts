import {
	CodeDefinition,
	convertSegmentToDefinition,
	SearchResult,
	SearchResultType,
	FileSearchResult,
	CodeSearchResult,
} from "./types"
import { Vector, VectorSearchResult, VectorWithMetadata } from "./vector-store/types"
import { WorkspaceCache } from "./cache/workspace-cache"
import * as path from "path"
import { EmbeddingModel } from "./embeddings/types"
import { MiniLMModel } from "./embeddings/minilm"
import * as vscode from "vscode"
import { TreeSitterParser } from "./parser/tree-sitter"
import { LanceDBVectorStore } from "./vector-store/lancedb"
import * as crypto from "crypto"

export type ModelType = "minilm"

export interface SemanticSearchConfig {
	/**
	 * Directory to store model files and cache
	 */
	storageDir: string

	/**
	 * Maximum number of results to return
	 */
	maxResults?: number

	/**
	 * Whether to normalize embeddings
	 */
	normalizeEmbeddings?: boolean

	/**
	 * Context for storage and paths
	 */
	context: vscode.ExtensionContext

	/**
	 * Model type to use (default: minilm)
	 */
	modelType?: ModelType
}

export enum WorkspaceIndexStatus {
	NotIndexed = "Not indexed",
	Indexing = "Indexing",
	Indexed = "Indexed",
}

export class SemanticSearchService {
	// Supported file extensions for semantic search
	private static readonly SUPPORTED_CODE_EXTENSIONS = new Set([
		"js",
		"jsx",
		"ts",
		"tsx", // JavaScript/TypeScript
		"py", // Python
		"rs", // Rust
		"go", // Go
		"cpp",
		"hpp", // C++
		"c",
		"h", // C
		"cs", // C#
		"rb", // Ruby
		"java", // Java
		"php", // PHP
		"swift", // Swift
	])

	// Maximum size for text files (5MB)
	private static readonly MAX_TEXT_FILE_SIZE = 5 * 1024 * 1024

	private static async isTextFile(filePath: string): Promise<boolean> {
		const stats = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))

		// Check if path is a directory
		if (stats.type === vscode.FileType.Directory) {
			return false
		}

		if (stats.size > this.MAX_TEXT_FILE_SIZE) {
			return false
		}

		const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))

		// Check for null bytes and other control characters (except common ones like newline, tab)
		const sampleSize = Math.min(4096, fileContent.length)
		for (let i = 0; i < sampleSize; i++) {
			if (fileContent[i] === 0 || (fileContent[i] < 32 && ![9, 10, 13].includes(fileContent[i]))) {
				return false
			}
		}

		// Check if the buffer is valid UTF-8
		if (!this.isValidUtf8(fileContent)) {
			return false
		}

		// Heuristic check for ASCII printable characters
		let validBytes = 0
		for (let i = 0; i < fileContent.length; i++) {
			const byte = fileContent[i]
			if (
				byte === 0x09 || // Tab
				byte === 0x0a || // Line Feed
				byte === 0x0d || // Carriage Return
				(byte >= 0x20 && byte <= 0x7e) // Printable ASCII
			) {
				validBytes++
			}
		}

		const ratio = validBytes / fileContent.length
		return ratio >= 0.95 // 95% threshold
	}

	private static isValidUtf8(buffer: Uint8Array): boolean {
		// Check if buffer can be converted to UTF-8 without replacement characters
		const str = new TextDecoder().decode(buffer)
		return !str.includes("\ufffd") // No replacement characters found
	}

	// Check if a file is supported for indexing
	public static async isFileSupported(filePath: string): Promise<boolean> {
		const ext = path.extname(filePath).toLowerCase().slice(1)
		return this.SUPPORTED_CODE_EXTENSIONS.has(ext) || (await this.isTextFile(filePath))
	}

	// Check if a file should be treated as a code file (parsed with tree-sitter)
	private static isCodeFile(filePath: string): boolean {
		const ext = path.extname(filePath).toLowerCase().slice(1)
		return this.SUPPORTED_CODE_EXTENSIONS.has(ext)
	}

	private statuses = new Map<string, WorkspaceIndexStatus>()
	private model: EmbeddingModel
	private store!: LanceDBVectorStore
	private cache: WorkspaceCache
	private initialized = false
	private initializationError: Error | null = null
	private parser: TreeSitterParser

	constructor(private config: SemanticSearchConfig) {
		const workspaceId = this.getWorkspaceId(config.context)
		const modelConfig = {
			modelPath: path.join(config.storageDir, "models"),
			normalize: config.normalizeEmbeddings ?? true,
		}

		this.model = new MiniLMModel(modelConfig)
		this.cache = new WorkspaceCache(config.context.globalState, workspaceId)
		this.parser = new TreeSitterParser()
	}

	private getWorkspaceId(context: vscode.ExtensionContext): string {
		// Use the workspace folder path as the ID
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders && workspaceFolders.length > 0) {
			return workspaceFolders[0].uri.fsPath
		}
		// Fallback to extension context storage path
		return context.storagePath || "global"
	}

	public updateStatus(status: WorkspaceIndexStatus): void {
		const workspaceId = this.getWorkspaceId(this.config.context)
		this.statuses.set(workspaceId, status)
	}

	public getStatus(): WorkspaceIndexStatus {
		const workspaceId = this.getWorkspaceId(this.config.context)
		return this.statuses.get(workspaceId) || WorkspaceIndexStatus.NotIndexed
	}

	async initialize(): Promise<void> {
		this.updateStatus(WorkspaceIndexStatus.Indexing)

		try {
			console.log("Starting semantic search service initialization")

			// Initialize store with workspace ID
			const workspaceId = this.getWorkspaceId(this.config.context)
			this.store = new LanceDBVectorStore(path.join(this.config.storageDir, "lancedb"), workspaceId)
			await this.store.initialize()
			console.log("Vector store initialized")

			// Initialize model first
			try {
				console.log("Initializing embedding model")
				const startTime = Date.now()

				// Detailed model initialization with multiple attempts
				const MAX_INIT_ATTEMPTS = 3
				let initAttempt = 0
				let modelInitError: Error | null = null

				while (initAttempt < MAX_INIT_ATTEMPTS) {
					try {
						await this.model.initialize()
						modelInitError = null
						break
					} catch (error) {
						initAttempt++
						modelInitError = error instanceof Error ? error : new Error(String(error))

						console.error(`Model initialization attempt ${initAttempt} failed:`, modelInitError)

						// Wait before retrying
						if (initAttempt < MAX_INIT_ATTEMPTS) {
							await new Promise((resolve) => setTimeout(resolve, 1000 * initAttempt))
						}
					}
				}

				// If all attempts failed, throw the last error
				if (modelInitError) {
					throw modelInitError
				}

				const initDuration = Date.now() - startTime
				console.log(`Embedding model initialization completed in ${initDuration}ms`)

				// Verify model is truly initialized
				if (!this.model.isInitialized()) {
					throw new Error("Model initialization failed: isInitialized() returned false")
				}

				// Perform a test embedding to ensure model works
				try {
					const testEmbedding = await this.model.embed("Test embedding to verify initialization")
					console.log(`Test embedding generated successfully. Dimension: ${testEmbedding.dimension}`)
				} catch (embedError) {
					console.error("Failed to generate test embedding:", embedError)
					throw new Error(
						`Model initialization verification failed: ${embedError instanceof Error ? embedError.message : String(embedError)}`,
					)
				}
			} catch (modelInitError) {
				console.error("Detailed model initialization error:", modelInitError)

				// Log additional context about the error
				if (modelInitError instanceof Error) {
					console.error(`Error name: ${modelInitError.name}`)
					console.error(`Error message: ${modelInitError.message}`)
					console.error(`Error stack: ${modelInitError.stack}`)
				}

				throw new Error(
					`Model initialization failed: ${modelInitError instanceof Error ? modelInitError.message : String(modelInitError)}`,
				)
			}

			// Load persisted vectors
			try {
				console.log("Loading persisted vectors")
				await this.store.load()
			} catch (storeLoadError) {
				console.error("Failed to load persisted vectors:", storeLoadError)
				// Non-fatal, continue initialization
			}

			console.log("Semantic search service initialization completed successfully")
			this.initialized = true
			this.updateStatus(WorkspaceIndexStatus.Indexed)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("Initialization failed:", errorMessage)

			// Reset status on error
			this.updateStatus(WorkspaceIndexStatus.NotIndexed)

			// Store the initialization error
			this.initializationError = error instanceof Error ? error : new Error(errorMessage)

			// Reset initialization state to allow retry
			this.initialized = false
			throw error
		}
	}

	// Modify methods that require initialization to handle potential errors
	private async ensureInitialized(): Promise<void> {
		// If not initialized, attempt initialization
		if (!this.initialized) {
			try {
				await this.initialize()
			} catch (error) {
				// If initialization fails, throw a clear error
				throw new Error(
					`Semantic search service could not be initialized: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		// If an initialization error occurred previously, throw it
		if (this.initializationError) {
			throw this.initializationError
		}

		// Verify store exists
		if (!this.store) {
			throw new Error("Vector store not initialized")
		}
	}

	private async processFileWithHash(filePath: string): Promise<void> {
		// Check if path is a directory
		try {
			const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath))
			if (stat.type === vscode.FileType.Directory) {
				console.log(`Skipping directory: ${filePath}`)
				return
			}
		} catch (error) {
			console.error(`Error checking file stats for ${filePath}:`, error)
			return
		}

		const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
		const textContent = new TextDecoder().decode(fileContent)

		// Create hash of file content
		const hash = crypto.createHash("sha256").update(textContent).digest("hex")

		// Check if file exists in DB and get its hash
		const { exists: hasExisting, hash: prevHash } = await this.store.hasFileSegments(filePath)

		// If hash matches and has existing segments, skip entirely
		if (hasExisting && hash === prevHash) {
			console.log(`Skipping unchanged file: ${filePath}`)
			return
		}

		// Delete old segments if needed
		if (hasExisting) {
			console.log(`File ${filePath} changed, deleting old segments`)
			await this.store.deleteByFilePath(filePath)
		}

		// Only process if we passed the checks
		if (SemanticSearchService.isCodeFile(filePath)) {
			const parsedFile = await this.parser.parseFile(filePath, hash) // Pass hash to parser
			for (const segment of parsedFile.segments) {
				const definition = {
					...convertSegmentToDefinition(segment, filePath),
					contentHash: hash,
				}
				await this.indexDefinition(definition)
			}
		} else {
			const definition: CodeDefinition = {
				type: "file",
				name: path.basename(filePath),
				filePath: filePath,
				content: textContent,
				startLine: 1,
				endLine: textContent.split("\n").length,
				language: path.extname(filePath).slice(1) || "text",
				contentHash: hash,
			}
			await this.indexDefinition(definition)
		}
	}

	async addToIndex(filePath: string): Promise<void> {
		await this.ensureInitialized()
		await this.processFileWithHash(filePath)
	}

	async addBatchToIndex(filePaths: string[]): Promise<void> {
		await this.ensureInitialized()
		for (const filePath of filePaths) {
			await this.processFileWithHash(filePath)
		}
	}

	// Helper method to index a single definition
	private async indexDefinition(definition: CodeDefinition): Promise<void> {
		// Try to get vector from cache first
		let vector = await this.cache.get(definition)

		if (!vector) {
			// Generate new embedding if not in cache
			vector = await (this.model as any).embedWithContext(definition)
			if (!vector) {
				console.error(`Failed to generate embedding for ${definition.filePath}`)
				return
			}
			await this.cache.set(definition, vector)
			console.log(
				`Generated new contextual embedding for ${definition.filePath} (${definition.type}: ${definition.name})`,
			)
		} else {
			console.log(`Using cached embedding for ${definition.filePath} (${definition.type}: ${definition.name})`)
		}

		await this.store.add(vector, definition)
	}

	async search(query: string): Promise<SearchResult[]> {
		console.log(`Starting semantic search for query: "${query}"`)
		console.log(`Current workspace ID: ${this.getWorkspaceId(this.config.context)}`)
		console.log(`Store instance: ${this.store?.constructor.name}`)

		try {
			await this.ensureInitialized()
			console.log("Store after initialization:", this.store)

			const storeSize = this.size()
			console.log(`Current vector store size: ${storeSize} documents`)

			if (storeSize === 0) {
				console.log("Vector store is empty, no results to return")
				return []
			}

			const queryVector = await this.model.embed(query)

			const results = await this.store.search(
				queryVector,
				this.config.maxResults ? this.config.maxResults * 2 : 20,
			)
			console.log(`Found ${results.length} results before filtering`)

			const dedupedResults = this.deduplicateResults(results)
			console.log(`Deduplicated to ${dedupedResults.length} results`)

			// Modified section: Prioritize code results but maintain original order
			const maxResults = this.config.maxResults ?? 10
			const finalResults: VectorSearchResult[] = []

			// First collect all code results in original order
			const codeResults = dedupedResults.filter((r) => r.metadata?.type !== "file")
			// Then collect all file results in original order
			const fileResults = dedupedResults.filter((r) => r.metadata?.type === "file")

			// Add code results first until we reach maxResults
			for (const result of codeResults) {
				if (finalResults.length >= maxResults) break
				finalResults.push(result)
			}

			// Then add file results to fill remaining slots
			for (const result of fileResults) {
				if (finalResults.length >= maxResults) break
				finalResults.push(result)
			}

			// Trim to exact max results (in case both arrays had more than needed)
			const trimmedResults = finalResults.slice(0, maxResults)

			const formattedResults = trimmedResults.map((r) => this.formatResult(r))
			console.log("Formatted results:", formattedResults)
			return formattedResults
		} catch (error) {
			console.error("Error during semantic search:", error)
			throw error
		}
	}

	private formatResult(result: VectorWithMetadata): SearchResult {
		if (!result.metadata || !result.metadata.filePath) {
			throw new Error("Invalid metadata in search result")
		}

		if (result.metadata.type === SearchResultType.File) {
			const { content, ...restMetadata } = result.metadata
			return {
				type: SearchResultType.File,
				filePath: result.metadata.filePath,
				name: result.metadata.name,
				metadata: restMetadata,
			} as FileSearchResult
		}

		return {
			type: SearchResultType.Code,
			filePath: result.metadata.filePath,
			content: result.metadata.content,
			startLine: result.metadata.startLine,
			endLine: result.metadata.endLine,
			name: result.metadata.name,
			codeType: result.metadata.type,
			metadata: result.metadata,
		} as CodeSearchResult
	}

	private deduplicateResults(results: VectorSearchResult[]): VectorSearchResult[] {
		const dedupedResults: VectorSearchResult[] = []
		const seenPaths = new Set<string>()
		const seenContent = new Set<string>()
		for (const result of results) {
			const filePath = result.metadata.filePath
			if (!filePath) continue

			if (result.metadata.type === SearchResultType.File) {
				if (!seenPaths.has(filePath)) {
					dedupedResults.push(result)
					seenPaths.add(filePath)
				}
			} else {
				if (!seenContent.has(result.metadata.content)) {
					dedupedResults.push(result)
					seenContent.add(result.metadata.content)
				}
			}
		}

		return dedupedResults
	}

	size(): number {
		if (!this.store) {
			throw new Error("Vector store not initialized")
		}
		return this.store.size()
	}

	clear(): void {
		this.store.clear()
		this.cache.clear()
	}

	async invalidateCache(definition: CodeDefinition): Promise<void> {
		await this.cache.invalidate(definition)
	}
}
