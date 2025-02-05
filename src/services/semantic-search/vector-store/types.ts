import { CodeDefinition } from "../types"
import { SearchResult as AppSearchResult } from "../types"

export interface StoreSearchResult {
	score: number
	metadata: CodeDefinition
}

export interface VectorStore {
	/**
	 * Add a document with its metadata to the store
	 */
	add(metadata: CodeDefinition): Promise<void>

	/**
	 * Add multiple documents with their metadata to the store
	 */
	addBatch(items: CodeDefinition[]): Promise<void>

	/**
	 * Search for the k most similar documents to the query
	 */
	search(query: string, k: number): Promise<StoreSearchResult[]>

	/**
	 * Clear all documents from the store
	 */
	clear(): Promise<void>
}
