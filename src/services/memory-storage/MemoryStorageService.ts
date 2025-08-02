import { IEmbedder } from "../code-index/interfaces/embedder"
import { IVectorStore, PointStruct } from "../code-index/interfaces/vector-store"
import { CodeIndexServiceFactory } from "../code-index/service-factory"
import { CodeIndexConfigManager } from "../code-index/config-manager"
import { QdrantCollectionType } from "../code-index/interfaces/collection-types"
import { v4 as uuidv4 } from "uuid"

export interface MemoryEntry {
	id: string
	question: string
	answer: string
	suggestions?: Array<{ answer: string; mode?: string }>
	timestamp: number
	taskId: string
	mode?: string
}

export class MemoryStorageService {
	private embedder: IEmbedder | null = null
	private vectorStore: IVectorStore | null = null
	private isInitialized = false

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly serviceFactory: CodeIndexServiceFactory,
		private readonly workspacePath: string,
	) {}

	/**
	 * Initialize the memory storage service
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return
		}

		const config = this.configManager.getConfig()

		// Only initialize if memory storage is enabled and the feature is configured
		if (!config.memoryStorageEnabled || !config.isConfigured) {
			return
		}

		try {
			// Create embedder and vector store for memory collection
			this.embedder = this.serviceFactory.createEmbedder()
			this.vectorStore = this.serviceFactory.createVectorStore(QdrantCollectionType.MEMORY)

			// Initialize the vector store
			await this.vectorStore.initialize()

			this.isInitialized = true
		} catch (error) {
			console.error("Failed to initialize memory storage service:", error)
			throw error
		}
	}

	/**
	 * Store a question-answer pair in memory
	 */
	async storeMemory(
		question: string,
		answer: string,
		suggestions: Array<{ answer: string; mode?: string }> = [],
		taskId: string,
		mode?: string,
	): Promise<void> {
		if (!this.isInitialized || !this.embedder || !this.vectorStore) {
			await this.initialize()
			if (!this.isInitialized) {
				// Memory storage is disabled or not configured
				return
			}
		}

		if (!this.embedder || !this.vectorStore) {
			throw new Error("Memory storage service not properly initialized")
		}

		const memoryEntry: MemoryEntry = {
			id: uuidv4(),
			question,
			answer,
			suggestions: suggestions.length > 0 ? suggestions : undefined,
			timestamp: Date.now(),
			taskId,
			mode,
		}

		try {
			// Create embedding for the question
			const embeddingResponse = await this.embedder.createEmbeddings([question])
			const vector = embeddingResponse.embeddings[0]

			// Create point for vector store
			const point: PointStruct = {
				id: memoryEntry.id,
				vector,
				payload: memoryEntry,
			}

			// Store in vector database
			await this.vectorStore.upsertPoints([point])
		} catch (error) {
			console.error("Failed to store memory:", error)
			throw error
		}
	}

	/**
	 * Search for similar questions in memory
	 */
	async searchSimilarQuestions(question: string, limit: number = 5, scoreThreshold?: number): Promise<MemoryEntry[]> {
		if (!this.isInitialized || !this.embedder || !this.vectorStore) {
			await this.initialize()
			if (!this.isInitialized) {
				// Memory storage is disabled or not configured
				return []
			}
		}

		if (!this.embedder || !this.vectorStore) {
			return []
		}

		try {
			// Create embedding for the search query
			const embeddingResponse = await this.embedder.createEmbeddings([question])
			const vector = embeddingResponse.embeddings[0]

			// Search in vector database
			const results = await this.vectorStore.search(
				vector,
				undefined, // directoryPrefix
				scoreThreshold ?? this.configManager.currentSearchMinScore,
				limit,
			)

			// Extract and return memory entries
			return results.filter((result) => result.payload).map((result) => result.payload as unknown as MemoryEntry)
		} catch (error) {
			console.error("Failed to search memories:", error)
			return []
		}
	}

	/**
	 * Check if memory storage is enabled and configured
	 */
	isEnabled(): boolean {
		const config = this.configManager.getConfig()
		return config.memoryStorageEnabled === true && config.isConfigured
	}

	/**
	 * Clear all memories
	 */
	async clearMemories(): Promise<void> {
		if (!this.vectorStore) {
			return
		}

		try {
			await this.vectorStore.clearCollection()
		} catch (error) {
			console.error("Failed to clear memories:", error)
			throw error
		}
	}

	/**
	 * Search for memories (alias for searchSimilarQuestions)
	 */
	async searchMemories(query: string, limit: number = 5): Promise<Array<{ question: string; answer: string }>> {
		const memories = await this.searchSimilarQuestions(query, limit)
		return memories.map((memory) => ({
			question: memory.question,
			answer: memory.answer,
		}))
	}

	/**
	 * Dispose of resources
	 */
	dispose(): void {
		this.embedder = null
		this.vectorStore = null
		this.isInitialized = false
	}
}
