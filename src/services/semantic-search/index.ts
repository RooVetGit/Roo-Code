import {
	CodeDefinition,
	convertSegmentToDefinition,
	SearchResult,
	SearchResultType,
	FileSearchResult,
	CodeSearchResult,
} from "./types"
import { PersistentVectorStore } from "./vector-store/persistent"
import { Vector, VectorWithMetadata } from "./vector-store/types"
import { WorkspaceCache } from "./cache/workspace-cache"
import { MemoryMonitor, MemoryStats } from "./memory/monitor"
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
	 * Minimum similarity score (0-1) for results
	 */
	minScore?: number

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
	 * Maximum memory usage in bytes (default: 100MB)
	 */
	maxMemoryBytes?: number

	/**
	 * Model type to use (default: minilm)
	 */
	modelType?: ModelType
}

export class SemanticSearchService {
	// Scores for code and file search results
	private static readonly CODE_SEARCH_SCORE = 0.8
	private static readonly FILE_SEARCH_SCORE = 0.5

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

	private model: EmbeddingModel
	private store!: LanceDBVectorStore
	private cache: WorkspaceCache
	private initialized = false
	private readonly maxMemoryBytes: number
	private initializationPromise: Promise<void> | null = null
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
		this.maxMemoryBytes = config.maxMemoryBytes ?? 100 * 1024 * 1024 // Default 100MB
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

	async initialize(): Promise<void> {
		// If already initialized, return immediately
		if (this.initialized) return

		// If an initialization is already in progress, wait for it
		if (this.initializationPromise) {
			await this.initializationPromise
			return
		}

		// Reset any previous initialization error
		this.initializationError = null

		// Create a new initialization promise
		this.initializationPromise = (async () => {
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
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				console.error("Initialization failed:", errorMessage)

				// Store the initialization error
				this.initializationError = error instanceof Error ? error : new Error(errorMessage)

				// Reset initialization state to allow retry
				this.initialized = false
				throw error
			} finally {
				// Clear the initialization promise
				this.initializationPromise = null
			}
		})()

		// Wait for initialization to complete
		await this.initializationPromise

		// If an error occurred during initialization, throw it
		if (this.initializationError) {
			throw this.initializationError
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

	private async checkMemoryUsage(): Promise<void> {
		const stats = await this.getMemoryStats()
		const totalMemory = stats.totalVectorMemory + stats.totalMetadataMemory + stats.totalCacheMemory

		if (totalMemory > this.maxMemoryBytes) {
			// If we're over the limit, clear the cache first
			if (stats.totalCacheMemory > 0) {
				await this.cache.clear()
			}

			// If still over limit, start removing old vectors
			if (totalMemory - stats.totalCacheMemory > this.maxMemoryBytes) {
				// For now, just clear everything - in future we could be more selective
				this.store.clear()
				throw new Error(
					`Memory usage exceeded limit of ${MemoryMonitor.formatBytes(this.maxMemoryBytes)}. ` +
						`Vector store has been cleared.`,
				)
			}
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

		// Check memory usage before adding to store
		await this.checkMemoryUsage()

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

			const codeResults = dedupedResults.filter((r) => r.metadata?.type !== "file")
			const fileResults = dedupedResults.filter((r) => r.metadata?.type === "file")

			//Assume that all results are already ranked by score
			/*let filteredCodeResults = codeResults.filter(
				(r) => r.score && r.score >= SemanticSearchService.CODE_SEARCH_SCORE,
			)
			let filteredFileResults = fileResults.filter(
				(r) => r.score && r.score >= SemanticSearchService.FILE_SEARCH_SCORE,
			)

			console.log(`Filtering code results with minimum score ${SemanticSearchService.CODE_SEARCH_SCORE}`)
			console.log(`Filtering file results with minimum score ${SemanticSearchService.FILE_SEARCH_SCORE}`)

			const sortedCodeResults = filteredCodeResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
			const sortedFileResults = filteredFileResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))*/

			const finalResults = codeResults
				.slice(0, this.config.maxResults ?? 10 / 2)
				.concat(fileResults.slice(0, this.config.maxResults ?? 10 / 2))

			console.log("Final results:", finalResults)
			return finalResults.map((r) => this.formatResult(r))
		} catch (error) {
			console.error("Error during semantic search:", error)
			throw error
		}
	}

	private formatResult(result: VectorWithMetadata): SearchResult {
		if (!result.metadata || !result.metadata.filePath) {
			throw new Error("Invalid metadata in search result")
		}

		if (result.metadata.type === "file") {
			const { content, ...restMetadata } = result.metadata
			return {
				type: "file",
				score: result.score ?? 0,
				filePath: result.metadata.filePath,
				name: result.metadata.name,
				metadata: restMetadata,
			} as FileSearchResult
		}

		// Only return code result if we have all required properties
		if (
			result.metadata.content &&
			result.metadata.startLine !== undefined &&
			result.metadata.endLine !== undefined &&
			result.metadata.name &&
			result.metadata.type
		) {
			return {
				type: "code",
				score: result.score ?? 0,
				filePath: result.metadata.filePath,
				content: result.metadata.content,
				startLine: result.metadata.startLine,
				endLine: result.metadata.endLine,
				name: result.metadata.name,
				codeType: result.metadata.type,
				metadata: result.metadata,
			} as CodeSearchResult
		}

		// Default to file result if missing any required code properties
		// Remove content from metadata before returning it
		const { content, ...restMetadata } = result.metadata
		return {
			type: "file",
			score: result.score ?? 0,
			filePath: result.metadata.filePath,
			metadata: restMetadata,
		} as FileSearchResult
	}

	private deduplicateResults(results: VectorWithMetadata[]): VectorWithMetadata[] {
		const dedupedResults: VectorWithMetadata[] = []
		const seenPaths = new Set<string>()
		const seenContent = new Set<string>()
		for (const result of results) {
			const filePath = result.metadata.filePath
			if (!filePath) continue

			if (result.metadata.type === "file") {
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

	async getMemoryStats(): Promise<MemoryStats> {
		// Get vectors from store - we know PersistentVectorStore uses InMemoryVectorStore internally
		const store = this.store as unknown as { vectors: VectorWithMetadata[] }
		const vectors = store.vectors || []

		// Get cache entries
		const cacheData = this.config.context.globalState.get<{
			entries: { [hash: string]: { vector: Vector; metadata: CodeDefinition } }
		}>("semantic-search-cache")
		const cacheEntries = cacheData ? Object.values(cacheData.entries) : []

		return MemoryMonitor.calculateStats(vectors, cacheEntries)
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
