import { QdrantClient } from "@qdrant/js-client-rest"
import { createHash } from "crypto"
import * as path from "path"
import { getWorkspacePath } from "../../../utils/path"
import { IVectorStore } from "../interfaces/vector-store"
import { Payload, VectorStoreSearchResult } from "../interfaces"

/**
 * Qdrant implementation of the vector store interface
 */
export class QdrantVectorStore implements IVectorStore {
	private readonly QDRANT_URL = "http://localhost:6333"
	private readonly vectorSize!: number
	private readonly DISTANCE_METRIC = "Cosine"

	private client: QdrantClient
	private readonly collectionName: string

	/**
	 * Creates a new Qdrant vector store
	 * @param workspacePath Path to the workspace
	 * @param url Optional URL to the Qdrant server
	 */
	constructor(workspacePath: string, url: string, vectorSize: number, apiKey?: string) {
		this.client = new QdrantClient({
			url: url ?? this.QDRANT_URL,
			apiKey,
			headers: {
				"User-Agent": "Roo-Code",
			},
		})

		// Generate collection name from workspace path
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		this.vectorSize = vectorSize
		this.collectionName = `ws-${hash.substring(0, 16)}`
	}

	/**
	 * Initializes the vector store
	 * @returns Promise resolving to boolean indicating if a new collection was created
	 */
	async initialize(): Promise<boolean> {
		try {
			let created = false
			const collections = await this.client.getCollections()
			const collectionExists = collections.collections.some(
				(collection) => collection.name === this.collectionName,
			)

			if (!collectionExists) {
				await this.client.createCollection(this.collectionName, {
					vectors: {
						size: this.vectorSize,
						distance: this.DISTANCE_METRIC,
					},
				})
				created = true
			}
			return created
		} catch (error) {
			console.error("Failed to initialize Qdrant collection:", error)
			throw error
		}
	}

	/**
	 * Upserts points into the vector store
	 * @param points Array of points to upsert
	 */
	async upsertPoints(
		points: Array<{
			id: string
			vector: number[]
			payload: Record<string, any>
		}>,
	): Promise<void> {
		try {
			await this.client.upsert(this.collectionName, {
				points,
				wait: true,
			})
		} catch (error) {
			console.error("Failed to upsert points:", error)
			throw error
		}
	}

	/**
	 * Checks if a payload is valid
	 * @param payload Payload to check
	 * @returns Boolean indicating if the payload is valid
	 */
	private isPayloadValid(payload: Record<string, unknown>): payload is Payload {
		return "filePath" in payload && "codeChunk" in payload && "startLine" in payload && "endLine" in payload
	}

	/**
	 * Searches for similar vectors
	 * @param queryVector Vector to search for
	 * @param limit Maximum number of results to return
	 * @returns Promise resolving to search results
	 */
	async search(queryVector: number[], limit: number = 10): Promise<VectorStoreSearchResult[]> {
		try {
			const result = await this.client.search(this.collectionName, {
				vector: queryVector,
				limit,
			})
			result.filter((r) => this.isPayloadValid(r.payload!))

			return result as VectorStoreSearchResult[]
		} catch (error) {
			console.error("Failed to search points:", error)
			throw error
		}
	}

	/**
	 * Deletes points by file path
	 * @param filePath Path of the file to delete points for
	 */
	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) {
			return
		}

		try {
			const workspaceRoot = getWorkspacePath()
			const normalizedPaths = filePaths.map((filePath) => {
				const absolutePath = path.resolve(workspaceRoot, filePath)
				return path.normalize(absolutePath)
			})

			const filter = {
				should: normalizedPaths.map((normalizedPath) => ({
					key: "filePath",
					match: {
						value: normalizedPath,
					},
				})),
			}

			await this.client.delete(this.collectionName, {
				filter,
				wait: true,
			})
		} catch (error) {
			console.error("Failed to delete points by file paths:", error)
			throw error
		}
	}

	/**
	 * Deletes the entire collection.
	 */
	async deleteCollection(): Promise<void> {
		try {
			// Check if collection exists before attempting deletion to avoid errors
			if (await this.collectionExists()) {
				await this.client.deleteCollection(this.collectionName)
				console.log(`[QdrantVectorStore] Collection ${this.collectionName} deleted.`)
			} else {
				console.log(`[QdrantVectorStore] Collection ${this.collectionName} does not exist, skipping deletion.`)
			}
		} catch (error) {
			console.error(`[QdrantVectorStore] Failed to delete collection ${this.collectionName}:`, error)
			throw error // Re-throw to allow calling code to handle it
		}
	}

	/**
	 * Clears all points from the collection
	 */
	async clearCollection(): Promise<void> {
		try {
			await this.client.delete(this.collectionName, {
				filter: {
					must: [],
				},
				wait: true,
			})
		} catch (error) {
			console.error("Failed to clear collection:", error)
			throw error
		}
	}

	/**
	 * Checks if the collection exists
	 * @returns Promise resolving to boolean indicating if the collection exists
	 */
	async collectionExists(): Promise<boolean> {
		try {
			// Prefer direct API call if supported
			await this.client.getCollection(this.collectionName)
			return true
		} catch (error: any) {
			if (error?.response?.status === 404) {
				return false
			}
			console.error("Error checking collection existence:", error)
			return false
		}
	}
}
