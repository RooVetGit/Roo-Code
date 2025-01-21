import { CodeDefinition } from "../types"
import { Vector, VectorStore, VectorWithMetadata, SearchResult } from "./types"

export class InMemoryVectorStore implements VectorStore {
	protected vectors: VectorWithMetadata[] = []

	async add(vector: Vector, metadata: CodeDefinition): Promise<void> {
		this.validateVector(vector)
		this.vectors.push({ vector, metadata })
	}

	async addBatch(items: VectorWithMetadata[]): Promise<void> {
		items.forEach((item) => this.validateVector(item.vector))
		this.vectors.push(...items)
	}

	async search(queryVector: Vector, k: number): Promise<SearchResult[]> {
		this.validateVector(queryVector)

		if (this.vectors.length === 0) {
			return []
		}

		// Calculate cosine similarity with all vectors
		const scores = this.vectors.map((item, index) => ({
			score: this.cosineSimilarity(queryVector, item.vector),
			metadata: item.metadata,
			index,
		}))

		// Sort by score in descending order and take top k
		return scores
			.sort((a, b) => b.score - a.score)
			.slice(0, k)
			.map(({ score, metadata }) => ({ score, metadata }))
	}

	size(): number {
		return this.vectors.length
	}

	clear(): void {
		this.vectors = []
	}

	private validateVector(vector: Vector): void {
		if (!vector.values || !Array.isArray(vector.values)) {
			throw new Error("Vector values must be an array")
		}
		if (vector.values.length !== vector.dimension) {
			throw new Error(`Vector dimension mismatch: expected ${vector.dimension}, got ${vector.values.length}`)
		}
		if (this.vectors.length > 0 && vector.dimension !== this.vectors[0].vector.dimension) {
			throw new Error(
				`Vector dimension mismatch with store: expected ${this.vectors[0].vector.dimension}, got ${vector.dimension}`,
			)
		}
	}

	private cosineSimilarity(a: Vector, b: Vector): number {
		let dotProduct = 0
		let normA = 0
		let normB = 0

		for (let i = 0; i < a.dimension; i++) {
			dotProduct += a.values[i] * b.values[i]
			normA += a.values[i] * a.values[i]
			normB += b.values[i] * b.values[i]
		}

		const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
		if (magnitude === 0) return 0

		return dotProduct / magnitude
	}
}
