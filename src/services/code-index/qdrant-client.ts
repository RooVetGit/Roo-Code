import { QdrantClient } from "@qdrant/js-client-rest"

export class CodeIndexQdrantClient {
	private readonly QDRANT_URL = "http://localhost:6333"
	private readonly COLLECTION_NAME = "code_embeddings"
	private readonly VECTOR_SIZE = 1536
	private readonly DISTANCE_METRIC = "Cosine"

	private client: QdrantClient

	constructor(url?: string) {
		this.client = new QdrantClient({
			url: url || this.QDRANT_URL,
		})
	}

	async initialize(): Promise<void> {
		try {
			const collections = await this.client.getCollections()
			const collectionExists = collections.collections.some(
				(collection) => collection.name === this.COLLECTION_NAME,
			)

			if (!collectionExists) {
				await this.client.createCollection(this.COLLECTION_NAME, {
					vectors: {
						size: this.VECTOR_SIZE,
						distance: this.DISTANCE_METRIC,
					},
				})
			}
		} catch (error) {
			console.error("Failed to initialize Qdrant collection:", error)
			throw error
		}
	}

	async upsertPoints(
		points: Array<{
			id: string
			vector: number[]
			payload: Record<string, any>
		}>,
	): Promise<void> {
		try {
			await this.client.upsert(this.COLLECTION_NAME, {
				points,
				wait: true,
			})
		} catch (error) {
			console.error("Failed to upsert points:", error)
			throw error
		}
	}

	async search(queryVector: number[], limit: number = 10): Promise<Array<Record<string, any>>> {
		try {
			const result = await this.client.search(this.COLLECTION_NAME, {
				vector: queryVector,
				limit,
			})
			return result
		} catch (error) {
			console.error("Failed to search points:", error)
			throw error
		}
	}
}
