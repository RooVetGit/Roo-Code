import { CodeDefinition } from "../types"

export interface Vector {
	values: number[]
	dimension: number
}

export interface VectorWithMetadata {
	vector: Vector
	metadata: CodeDefinition
	score?: number
}

export interface SearchResult extends VectorWithMetadata {
	score: number
}

export interface VectorStore {
	/**
	 * Add a vector with its associated metadata to the store
	 */
	add(vector: Vector, metadata: any): Promise<void>

	/**
	 * Add multiple vectors with their associated metadata to the store
	 */
	addBatch(items: VectorWithMetadata[]): Promise<void>

	/**
	 * Search for the k nearest neighbors of the query vector
	 */
	search(queryVector: Vector, k: number): Promise<SearchResult[]>

	/**
	 * Get the total number of vectors in the store
	 */
	size(): number

	/**
	 * Clear all vectors from the store
	 */
	clear(): void

	/**
	 * Save the vector store to disk (if supported)
	 */
	save?(path: string): Promise<void>

	/**
	 * Load the vector store from disk (if supported)
	 */
	load?(path: string): Promise<void>
}
