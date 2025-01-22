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
	private model: EmbeddingModel
	private store!: PersistentVectorStore
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
				this.store = await PersistentVectorStore.create(this.config.context.globalState, workspaceId)
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

	async addToIndex(filePath: string): Promise<void> {
		// Don't call ensureInitialized() during the initialization process
		if (!this.initializationPromise) {
			await this.ensureInitialized()
		}

		console.log(`Parsing file: ${filePath}`)

		try {
			// Parse the file using tree-sitter
			const parsedFile = await this.parser.parseFile(filePath)
			console.log(`Found ${parsedFile.segments.length} code segments in ${filePath}`)

			// Convert segments to definitions and index them
			for (const segment of parsedFile.segments) {
				const definition = convertSegmentToDefinition(segment, filePath)

				// Try to get vector from cache first
				let vector = await this.cache.get(definition)

				if (!vector) {
					// Generate new embedding if not in cache
					vector = await (this.model as any).embedWithContext(definition)
					if (!vector) {
						console.error(`Failed to generate embedding for ${definition.filePath}`)
						continue
					}
					await this.cache.set(definition, vector)
					console.log(
						`Generated new contextual embedding for ${definition.filePath} (${definition.type}: ${definition.name})`,
					)
				} else {
					console.log(
						`Using cached embedding for ${definition.filePath} (${definition.type}: ${definition.name})`,
					)
				}

				// Check memory usage before adding to store
				const stats = await this.getMemoryStats()
				const newVectorMemory =
					MemoryMonitor.estimateVectorSize(vector) + MemoryMonitor.estimateMetadataSize(definition)
				const totalMemory =
					stats.totalVectorMemory + stats.totalMetadataMemory + stats.totalCacheMemory + newVectorMemory

				if (totalMemory > this.maxMemoryBytes) {
					// If we're over the limit, clear the cache first
					if (stats.totalCacheMemory > 0) {
						console.log("Memory limit exceeded, clearing cache")
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

				await this.store.add(vector, definition)
			}

			console.log(`Successfully indexed ${parsedFile.segments.length} segments from ${filePath}`)
		} catch (error) {
			console.error(`Error processing file ${filePath}:`, error)
		}
	}

	async addBatchToIndex(filePaths: string[]): Promise<void> {
		// Don't call ensureInitialized() during the initialization process
		if (!this.initializationPromise) {
			await this.ensureInitialized()
		}

		console.log(`Batch indexing ${filePaths.length} files...`)

		const allSegments: { definition: CodeDefinition; vector: Vector }[] = []

		// First parse all files and generate/retrieve embeddings
		for (const filePath of filePaths) {
			try {
				const parsedFile = await this.parser.parseFile(filePath)
				console.log(`Found ${parsedFile.segments.length} code segments in ${filePath}`)

				const definitions = parsedFile.segments.map((segment) => convertSegmentToDefinition(segment, filePath))

				// Try to get vectors from cache first
				const vectors = await Promise.all(definitions.map((def) => this.cache.get(def)))

				// Generate new embeddings for uncached definitions
				const uncachedDefinitions = definitions.filter((_, i) => !vectors[i])
				let newVectors: Vector[] = []

				if (uncachedDefinitions.length > 0) {
					newVectors = await (this.model as any).embedBatchWithContext(uncachedDefinitions)
					if (!newVectors.every((v) => v)) {
						console.error("Failed to generate some embeddings")
						continue
					}

					// Cache the new vectors
					await Promise.all(uncachedDefinitions.map((def, i) => this.cache.set(def, newVectors[i])))
				}

				// Combine cached and new vectors, ensuring all vectors are defined
				const allVectors = vectors
					.map((v, i) => {
						if (v) return v
						const newVector = newVectors[definitions.indexOf(definitions[i])]
						if (!newVector) {
							console.error(`Missing vector for ${definitions[i].filePath}`)
							return null
						}
						return newVector
					})
					.filter((v): v is Vector => v !== null)

				// Add to segments array, only for definitions with valid vectors
				definitions.forEach((def, i) => {
					const vector = allVectors[i]
					if (vector) {
						allSegments.push({ definition: def, vector })
					}
				})
			} catch (error) {
				console.error(`Error processing file ${filePath}:`, error)
				// Continue with other files
			}
		}

		// Check memory usage before adding to store
		const stats = await this.getMemoryStats()
		const newVectorsMemory = allSegments.reduce(
			(sum, { vector, definition }) =>
				sum + MemoryMonitor.estimateVectorSize(vector) + MemoryMonitor.estimateMetadataSize(definition),
			0,
		)
		const totalMemory =
			stats.totalVectorMemory + stats.totalMetadataMemory + stats.totalCacheMemory + newVectorsMemory

		if (totalMemory > this.maxMemoryBytes) {
			// If we're over the limit, clear the cache first
			if (stats.totalCacheMemory > 0) {
				console.log("Memory limit exceeded, clearing cache")
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

		// Add all segments to the store
		await this.store.addBatch(
			allSegments.map(({ vector, definition }) => ({
				vector,
				metadata: definition,
			})),
		)
		console.log(`Successfully batch indexed ${allSegments.length} segments from ${filePaths.length} files`)
	}

	async search(query: string): Promise<SearchResult[]> {
		console.log(`Starting semantic search for query: "${query}"`)

		try {
			await this.ensureInitialized()

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

			let filteredResults = results
			if (this.config.minScore !== undefined) {
				console.log(`Filtering results with minimum score ${this.config.minScore}`)
				filteredResults = results.filter((r) => r.score >= this.config.minScore!)
				console.log(`Filtered to ${filteredResults.length} results`)
			}

			const dedupedResults = this.deduplicateResults(filteredResults)
			console.log(`Deduplicated to ${dedupedResults.length} results`)

			const finalResults = dedupedResults
				.slice(0, this.config.maxResults ?? 10)
				.map((result) => this.formatResult(result))

			console.log("Final results:", finalResults)
			return finalResults
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
			return {
				type: "file",
				score: result.score ?? 0,
				filePath: result.metadata.filePath,
				name: result.metadata.name,
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
		return {
			type: "file",
			score: result.score ?? 0,
			filePath: result.metadata.filePath,
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
