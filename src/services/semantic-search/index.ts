import { CodeDefinition, convertSegmentToDefinition } from "./types"
import { PersistentVectorStore } from "./vector-store/persistent"
import { SearchResult, Vector, VectorWithMetadata } from "./vector-store/types"
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
		const modelConfig = {
			modelPath: path.join(config.storageDir, "models"),
			normalize: config.normalizeEmbeddings ?? true,
		}

		this.model = new MiniLMModel(modelConfig)
		this.cache = new WorkspaceCache(config.context.globalState)
		this.maxMemoryBytes = config.maxMemoryBytes ?? 100 * 1024 * 1024 // Default 100MB
		this.parser = new TreeSitterParser()
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

				// Initialize store first
				this.store = await PersistentVectorStore.create(this.config.context.globalState)
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
					vector = await this.model.embed(definition.content)
					await this.cache.set(definition, vector)
					console.log(
						`Generated new embedding for ${definition.filePath} (${definition.type}: ${definition.name})`,
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
			console.error(`Error indexing file ${filePath}:`, error)
			throw error
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

				for (const segment of parsedFile.segments) {
					const definition = convertSegmentToDefinition(segment, filePath)

					// Try to get vector from cache first
					let vector = await this.cache.get(definition)

					if (!vector) {
						// Generate new embedding if not in cache
						vector = await this.model.embed(definition.content)
						await this.cache.set(definition, vector)
						console.log(
							`Generated new embedding for ${definition.filePath} (${definition.type}: ${definition.name})`,
						)
					} else {
						console.log(
							`Using cached embedding for ${definition.filePath} (${definition.type}: ${definition.name})`,
						)
					}

					allSegments.push({ definition, vector })
				}
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

			console.log("Service initialization verified")

			console.log("Generating query embedding...")
			const queryVector = await this.model.embed(query)
			console.log("Query embedding generated successfully")

			console.log("Searching vector store...")
			const results = await this.store.search(
				queryVector,
				this.config.maxResults ? this.config.maxResults * 2 : 20,
			) // Get more results for better deduplication
			console.log(`Found ${results.length} results before filtering`)

			// Always log scores for debugging
			console.log("\nAll results with scores:")
			results.forEach((r, i) => {
				console.log(
					`${i + 1}. Score: ${r.score.toFixed(4)} - ${r.metadata.type} '${r.metadata.name}' in ${r.metadata.filePath}:${r.metadata.startLine}`,
				)
			})

			// Filter by minimum score if configured
			let filteredResults = results
			if (this.config.minScore !== undefined) {
				console.log(`\nFiltering results with minimum score ${this.config.minScore}`)
				filteredResults = results.filter((r) => r.score >= this.config.minScore!)
				console.log(`Filtered to ${filteredResults.length} results`)
			}

			// Deduplicate results
			const dedupedResults = this.deduplicateResults(filteredResults)
			console.log(`Deduplicated to ${dedupedResults.length} results`)

			// Limit to maxResults
			const finalResults = dedupedResults.slice(0, this.config.maxResults ?? 10)

			// Log detailed results for debugging
			finalResults.forEach((result, index) => {
				console.log(`Result ${index + 1}:`)
				console.log(`- Score: ${result.score}`)
				console.log(`- File: ${result.metadata.filePath}`)
				console.log(`- Type: ${result.metadata.type}`)
				console.log(`- Lines: ${result.metadata.startLine}-${result.metadata.endLine}`)
			})

			return finalResults
		} catch (error) {
			console.error("Error during semantic search:", error)
			if (error instanceof Error) {
				console.error("Error details:")
				console.error(`- Name: ${error.name}`)
				console.error(`- Message: ${error.message}`)
				console.error(`- Stack: ${error.stack}`)
			}
			throw error
		}
	}

	private deduplicateResults(results: SearchResult[]): SearchResult[] {
		const dedupedResults: SearchResult[] = []
		const seenRanges = new Map<string, Array<{ start: number; end: number }>>()

		for (const result of results) {
			const filePath = result.metadata.filePath
			const currentRange = {
				start: result.metadata.startLine,
				end: result.metadata.endLine,
			}

			// Get existing ranges for this file
			const fileRanges = seenRanges.get(filePath) || []

			// Check if this range overlaps with any existing range
			const hasOverlap = fileRanges.some((range) => this.rangesOverlap(currentRange, range))

			if (!hasOverlap) {
				dedupedResults.push(result)
				seenRanges.set(filePath, [...fileRanges, currentRange])
			} else {
				console.log(`Skipping duplicate result in ${filePath}:${currentRange.start}-${currentRange.end}`)
			}
		}

		return dedupedResults
	}

	private rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
		// Check if range a overlaps with range b
		return a.start <= b.end && b.start <= a.end
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
