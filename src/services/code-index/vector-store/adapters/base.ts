import { IVectorStore, PointStruct, VectorStoreSearchResult } from "../../interfaces/vector-store"
import { createHash } from "crypto"

/**
 * Configuration options for vector database adapters
 */
export interface VectorDBConfig {
	workspacePath: string
	vectorSize: number
	apiKey?: string
	url?: string
	[key: string]: any // Allow adapter-specific configuration
}

/**
 * Abstract base class for vector database adapters.
 * All vector database implementations should extend this class.
 */
export abstract class VectorDBAdapter implements IVectorStore {
	protected readonly collectionName: string
	protected readonly vectorSize: number
	protected readonly workspacePath: string

	constructor(protected readonly config: VectorDBConfig) {
		this.workspacePath = config.workspacePath
		this.vectorSize = config.vectorSize

		// Generate collection name from workspace path
		const hash = createHash("sha256").update(config.workspacePath).digest("hex")
		this.collectionName = `ws-${hash.substring(0, 16)}`
	}

	/**
	 * Get the name of the vector database provider
	 */
	abstract get providerName(): string

	/**
	 * Check if the adapter requires an external service
	 */
	abstract get requiresExternalService(): boolean

	/**
	 * Initializes the vector store
	 * @returns Promise resolving to boolean indicating if a new collection was created
	 */
	abstract initialize(): Promise<boolean>

	/**
	 * Upserts points into the vector store
	 * @param points Array of points to upsert
	 */
	abstract upsertPoints(points: PointStruct[]): Promise<void>

	/**
	 * Searches for similar vectors
	 * @param queryVector Vector to search for
	 * @param directoryPrefix Optional directory prefix to filter results
	 * @param minScore Optional minimum score threshold
	 * @param maxResults Optional maximum number of results to return
	 * @returns Promise resolving to search results
	 */
	abstract search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]>

	/**
	 * Deletes points by file path
	 * @param filePath Path of the file to delete points for
	 */
	abstract deletePointsByFilePath(filePath: string): Promise<void>

	/**
	 * Deletes points by multiple file paths
	 * @param filePaths Array of file paths to delete points for
	 */
	abstract deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void>

	/**
	 * Clears all points from the collection
	 */
	abstract clearCollection(): Promise<void>

	/**
	 * Deletes the entire collection
	 */
	abstract deleteCollection(): Promise<void>

	/**
	 * Checks if the collection exists
	 * @returns Promise resolving to boolean indicating if the collection exists
	 */
	abstract collectionExists(): Promise<boolean>

	/**
	 * Validates the adapter configuration
	 * @returns Promise resolving to validation result
	 */
	abstract validateConfiguration(): Promise<{ valid: boolean; error?: string }>

	/**
	 * Gets adapter-specific configuration requirements
	 * @returns Configuration requirements for the adapter
	 */
	abstract getConfigurationRequirements(): {
		required: string[]
		optional: string[]
		defaults: Record<string, any>
	}

	/**
	 * Helper method to validate payload structure
	 */
	protected isPayloadValid(payload: Record<string, unknown> | null | undefined): boolean {
		if (!payload) {
			return false
		}
		const validKeys = ["filePath", "codeChunk", "startLine", "endLine"]
		return validKeys.every((key) => key in payload)
	}
}
