import * as path from "path"
import { VectorDBAdapter, VectorDBConfig } from "./base"
import { PointStruct, VectorStoreSearchResult } from "../../interfaces/vector-store"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../../constants"
import { t } from "../../../../i18n"
import { getWorkspacePath } from "../../../../utils/path"

// Dynamic imports for ChromaDB to handle optional dependency
let ChromaClient: any

/**
 * ChromaDB adapter for vector database operations
 * ChromaDB can run as either a client-server or in-memory database
 */
export class ChromaDBAdapter extends VectorDBAdapter {
	private client: any
	private collection: any
	private chromaUrl: string
	private initialized: boolean = false

	constructor(config: VectorDBConfig) {
		super(config)
		// Default to local ChromaDB instance
		this.chromaUrl = config.url || "http://localhost:8000"
	}

	get providerName(): string {
		return "chromadb"
	}

	get requiresExternalService(): boolean {
		// ChromaDB can run in-memory or as a service
		return this.chromaUrl !== "memory"
	}

	/**
	 * Dynamically import ChromaDB modules
	 */
	private async loadChromaDB() {
		if (!ChromaClient) {
			try {
				// @ts-ignore - Dynamic import for optional dependency
				const chromaModule = await import("chromadb")
				ChromaClient = chromaModule.ChromaClient
			} catch (error) {
				throw new Error(
					t("embeddings:vectorStore.chromadbNotInstalled", {
						errorMessage: error instanceof Error ? error.message : String(error),
					}),
				)
			}
		}
	}

	async initialize(): Promise<boolean> {
		try {
			await this.loadChromaDB()

			// Create ChromaDB client
			if (this.chromaUrl === "memory") {
				// In-memory mode for testing or lightweight usage
				this.client = new ChromaClient()
			} else {
				// Client-server mode
				this.client = new ChromaClient({
					path: this.chromaUrl,
				})
			}

			// Check if collection exists
			let collectionExists = false
			try {
				const collections = await this.client.listCollections()
				collectionExists = collections.some((col: any) => col.name === this.collectionName)
			} catch (error) {
				console.warn(`[ChromaDBAdapter] Error listing collections:`, error)
			}

			if (!collectionExists) {
				// Create new collection
				this.collection = await this.client.createCollection({
					name: this.collectionName,
					metadata: {
						"hnsw:space": "cosine",
						vector_size: this.vectorSize,
					},
				})
				this.initialized = true
				return true // New collection created
			} else {
				// Get existing collection
				this.collection = await this.client.getCollection({
					name: this.collectionName,
				})

				// Verify vector dimension matches
				const metadata = this.collection.metadata || {}
				const existingVectorSize = metadata.vector_size

				if (existingVectorSize && existingVectorSize !== this.vectorSize) {
					// Dimension mismatch - need to recreate collection
					console.warn(
						`[ChromaDBAdapter] Collection ${this.collectionName} exists with vector size ${existingVectorSize}, but expected ${this.vectorSize}. Recreating collection.`,
					)

					// Delete and recreate collection
					await this.client.deleteCollection({ name: this.collectionName })

					this.collection = await this.client.createCollection({
						name: this.collectionName,
						metadata: {
							"hnsw:space": "cosine",
							vector_size: this.vectorSize,
						},
					})
					this.initialized = true
					return true // Recreated collection
				}

				this.initialized = true
				return false // Existing collection used
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[ChromaDBAdapter] Failed to initialize ChromaDB:`, errorMessage)
			throw new Error(t("embeddings:vectorStore.chromadbInitFailed", { chromaUrl: this.chromaUrl, errorMessage }))
		}
	}

	async upsertPoints(points: PointStruct[]): Promise<void> {
		if (!this.initialized || !this.collection) {
			throw new Error("ChromaDB not initialized")
		}

		try {
			// Transform points to ChromaDB format
			const ids: string[] = []
			const embeddings: number[][] = []
			const metadatas: any[] = []
			const documents: string[] = []

			for (const point of points) {
				ids.push(point.id)
				embeddings.push(Array.from(point.vector))

				// Build metadata with path segments
				const pathSegments = point.payload?.filePath
					? point.payload.filePath
							.split(path.sep)
							.filter(Boolean)
							.reduce((acc: Record<string, string>, segment: string, index: number) => {
								acc[`pathSegment_${index}`] = segment
								return acc
							}, {})
					: {}

				metadatas.push({
					filePath: point.payload?.filePath || "",
					startLine: point.payload?.startLine || 0,
					endLine: point.payload?.endLine || 0,
					...pathSegments,
				})

				// Use code chunk as document
				documents.push(point.payload?.codeChunk || "")
			}

			// Upsert to collection
			await this.collection.upsert({
				ids,
				embeddings,
				metadatas,
				documents,
			})
		} catch (error) {
			console.error("Failed to upsert points:", error)
			throw error
		}
	}

	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		if (!this.initialized || !this.collection) {
			throw new Error("ChromaDB not initialized")
		}

		try {
			// Build where clause for filtering
			let whereClause: any = undefined

			if (directoryPrefix) {
				const segments = directoryPrefix.split(path.sep).filter(Boolean)

				// Build filter for path segments
				whereClause = {
					$and: segments.map((segment, index) => ({
						[`pathSegment_${index}`]: segment,
					})),
				}
			}

			// Query collection
			const results = await this.collection.query({
				queryEmbeddings: [Array.from(queryVector)],
				nResults: maxResults ?? DEFAULT_MAX_SEARCH_RESULTS,
				where: whereClause,
			})

			// Transform results to our format
			const searchResults: VectorStoreSearchResult[] = []

			if (results.ids && results.ids[0]) {
				const queryResults = results.ids[0]
				const distances = results.distances?.[0] || []
				const metadatas = results.metadatas?.[0] || []
				const documents = results.documents?.[0] || []

				for (let i = 0; i < queryResults.length; i++) {
					// Convert distance to similarity score
					// ChromaDB returns squared L2 distance for cosine
					// Convert to similarity score (1 - distance)
					const distance = distances[i] || 0
					const score = 1 - Math.sqrt(distance / 2)

					// Skip results below minimum score
					if (score < (minScore ?? DEFAULT_SEARCH_MIN_SCORE)) {
						continue
					}

					const metadata = metadatas[i] || {}

					// Reconstruct path segments
					const pathSegments: Record<string, string> = {}
					for (const key in metadata) {
						if (key.startsWith("pathSegment_")) {
							const index = key.replace("pathSegment_", "")
							pathSegments[index] = metadata[key]
						}
					}

					const payload = {
						filePath: metadata.filePath || "",
						codeChunk: documents[i] || "",
						startLine: metadata.startLine || 0,
						endLine: metadata.endLine || 0,
						pathSegments,
					}

					if (this.isPayloadValid(payload)) {
						searchResults.push({
							id: queryResults[i],
							score,
							payload,
						})
					}
				}
			}

			return searchResults
		} catch (error) {
			console.error("Failed to search points:", error)
			throw error
		}
	}

	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (!this.initialized || !this.collection) {
			throw new Error("ChromaDB not initialized")
		}

		if (filePaths.length === 0) {
			return
		}

		try {
			const workspaceRoot = getWorkspacePath()
			const normalizedPaths = filePaths.map((filePath) => {
				const absolutePath = path.resolve(workspaceRoot, filePath)
				return path.normalize(absolutePath)
			})

			// Delete records matching any of the file paths
			await this.collection.delete({
				where: {
					$or: normalizedPaths.map((normalizedPath) => ({
						filePath: normalizedPath,
					})),
				},
			})
		} catch (error) {
			console.error("Failed to delete points by file paths:", error)
			throw error
		}
	}

	async deleteCollection(): Promise<void> {
		try {
			if (this.client && (await this.collectionExists())) {
				await this.client.deleteCollection({ name: this.collectionName })
				this.collection = null
				this.initialized = false
			}
		} catch (error) {
			console.error(`[ChromaDBAdapter] Failed to delete collection ${this.collectionName}:`, error)
			throw error
		}
	}

	async clearCollection(): Promise<void> {
		if (!this.initialized || !this.collection) {
			throw new Error("ChromaDB not initialized")
		}

		try {
			// Get all IDs and delete them
			const allData = await this.collection.get()
			if (allData.ids && allData.ids.length > 0) {
				await this.collection.delete({
					ids: allData.ids,
				})
			}
		} catch (error) {
			console.error("Failed to clear collection:", error)
			throw error
		}
	}

	async collectionExists(): Promise<boolean> {
		try {
			if (!this.client) {
				await this.loadChromaDB()

				if (this.chromaUrl === "memory") {
					this.client = new ChromaClient()
				} else {
					this.client = new ChromaClient({
						path: this.chromaUrl,
					})
				}
			}

			const collections = await this.client.listCollections()
			return collections.some((col: any) => col.name === this.collectionName)
		} catch {
			return false
		}
	}

	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			// Try to load ChromaDB
			await this.loadChromaDB()

			// Try to connect
			let testClient: any
			if (this.chromaUrl === "memory") {
				testClient = new ChromaClient()
			} else {
				testClient = new ChromaClient({
					path: this.chromaUrl,
				})
			}

			// List collections to verify connection works
			await testClient.listCollections()

			return { valid: true }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			if (errorMessage.includes("Cannot find module")) {
				return {
					valid: false,
					error: t("embeddings:vectorStore.chromadbNotInstalled", { errorMessage }),
				}
			}

			if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed")) {
				return {
					valid: false,
					error: t("embeddings:vectorStore.chromadbConnectionFailed", {
						chromaUrl: this.chromaUrl,
						errorMessage,
					}),
				}
			}

			return {
				valid: false,
				error: t("embeddings:vectorStore.chromadbInitFailed", {
					chromaUrl: this.chromaUrl,
					errorMessage,
				}),
			}
		}
	}

	getConfigurationRequirements() {
		return {
			required: ["vectorSize", "workspacePath"],
			optional: ["url", "apiKey"],
			defaults: {
				url: "http://localhost:8000",
			},
		}
	}
}
