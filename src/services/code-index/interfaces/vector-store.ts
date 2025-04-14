/**
 * Interface for vector database clients
 */
export interface IVectorStore {
	/**
	 * Initializes the vector store
	 * @returns Promise resolving to boolean indicating if a new collection was created
	 */
	initialize(): Promise<boolean>

	/**
	 * Upserts points into the vector store
	 * @param points Array of points to upsert
	 */
	upsertPoints(
		points: Array<{
			id: string
			vector: number[]
			payload: Record<string, any>
		}>,
	): Promise<void>

	/**
	 * Searches for similar vectors
	 * @param queryVector Vector to search for
	 * @param limit Maximum number of results to return
	 * @returns Promise resolving to search results
	 */
	search(queryVector: number[], limit?: number): Promise<VectorStoreSearchResult[]>

	/**
	 * Deletes points by file path
	 * @param filePath Path of the file to delete points for
	 */
	deletePointsByFilePath(filePath: string): Promise<void>

	/**
	 * Clears all points from the collection
	 */
	clearCollection(): Promise<void>

	/**
	 * Checks if the collection exists
	 * @returns Promise resolving to boolean indicating if the collection exists
	 */
	collectionExists(): Promise<boolean>
}

export interface VectorStoreSearchResult {
	id: string | number
	score: number
	payload?: Payload | null
}

export interface Payload {
	filePath: string
	codeChunk: string
	startLine: number
	endLine: number
	[key: string]: any
}
