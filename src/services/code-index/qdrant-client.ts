import { QdrantClient } from "@qdrant/js-client-rest"
import { createHash } from "crypto"
import * as path from "path"
import { getWorkspacePath } from "../../utils/path"
import { Payload, QdrantSearchResult } from "./types"

export class CodeIndexQdrantClient {
	private readonly QDRANT_URL = "http://localhost:6333"
	private readonly VECTOR_SIZE = 1536
	private readonly DISTANCE_METRIC = "Cosine"

	private client: QdrantClient
	private readonly collectionName: string

	constructor(workspacePath: string, url?: string) {
		this.client = new QdrantClient({
			url: url || this.QDRANT_URL,
		})

		// Generate collection name from workspace path
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		this.collectionName = `ws-${hash.substring(0, 16)}`
	}

	async initialize(): Promise<void> {
		try {
			const collections = await this.client.getCollections()
			const collectionExists = collections.collections.some(
				(collection) => collection.name === this.collectionName,
			)

			if (!collectionExists) {
				await this.client.createCollection(this.collectionName, {
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
			await this.client.upsert(this.collectionName, {
				points,
				wait: true,
			})
		} catch (error) {
			console.error("Failed to upsert points:", error)
			throw error
		}
	}

	private isPayloadValid(payload: Record<string, unknown>): payload is Payload {
		return "filePath" in payload && "codeChunk" in payload && "startLine" in payload && "endLine" in payload
	}

	async search(queryVector: number[], limit: number = 10): Promise<QdrantSearchResult[]> {
		try {
			const result = await this.client.search(this.collectionName, {
				vector: queryVector,
				limit,
			})
			result.filter((r) => this.isPayloadValid(r.payload!))

			return result as QdrantSearchResult[]
		} catch (error) {
			console.error("Failed to search points:", error)
			throw error
		}
	}

	async deletePointsByFilePath(filePath: string): Promise<void> {
		try {
			const workspaceRoot = getWorkspacePath()
			const absolutePath = path.resolve(workspaceRoot, filePath)
			const normalizedAbsolutePath = path.normalize(absolutePath)

			await this.client.delete(this.collectionName, {
				filter: {
					must: [
						{
							key: "filePath",
							match: {
								value: normalizedAbsolutePath,
							},
						},
					],
				},
				wait: true,
			})
		} catch (error) {
			console.error("Failed to delete points by file path:", error)
			throw error
		}
	}

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
