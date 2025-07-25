import { QdrantClient, Schemas } from "@qdrant/js-client-rest"
import * as path from "path"
import { VectorDBAdapter, VectorDBConfig } from "./base"
import { PointStruct, VectorStoreSearchResult, Payload } from "../../interfaces/vector-store"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../../constants"
import { t } from "../../../../i18n"
import { getWorkspacePath } from "../../../../utils/path"

/**
 * Qdrant adapter for vector database operations
 */
export class QdrantAdapter extends VectorDBAdapter {
	private client: QdrantClient
	private readonly DISTANCE_METRIC = "Cosine"
	private readonly qdrantUrl: string

	constructor(config: VectorDBConfig) {
		super(config)

		// Parse the URL to determine the appropriate QdrantClient configuration
		const parsedUrl = this.parseQdrantUrl(config.url)
		this.qdrantUrl = parsedUrl

		try {
			const urlObj = new URL(parsedUrl)

			// Always use host-based configuration with explicit ports to avoid QdrantClient defaults
			let port: number
			let useHttps: boolean

			if (urlObj.port) {
				// Explicit port specified - use it and determine protocol
				port = Number(urlObj.port)
				useHttps = urlObj.protocol === "https:"
			} else {
				// No explicit port - use protocol defaults
				if (urlObj.protocol === "https:") {
					port = 443
					useHttps = true
				} else {
					// http: or other protocols default to port 80
					port = 80
					useHttps = false
				}
			}

			this.client = new QdrantClient({
				host: urlObj.hostname,
				https: useHttps,
				port: port,
				prefix: urlObj.pathname === "/" ? undefined : urlObj.pathname.replace(/\/+$/, ""),
				apiKey: config.apiKey,
				headers: {
					"User-Agent": "Roo-Code",
				},
			})
		} catch (urlError) {
			// If URL parsing fails, fall back to URL-based config
			this.client = new QdrantClient({
				url: parsedUrl,
				apiKey: config.apiKey,
				headers: {
					"User-Agent": "Roo-Code",
				},
			})
		}
	}

	get providerName(): string {
		return "qdrant"
	}

	get requiresExternalService(): boolean {
		return true
	}

	/**
	 * Parses and normalizes Qdrant server URLs to handle various input formats
	 */
	private parseQdrantUrl(url: string | undefined): string {
		// Handle undefined/null/empty cases
		if (!url || url.trim() === "") {
			return "http://localhost:6333"
		}

		const trimmedUrl = url.trim()

		// Check if it starts with a protocol
		if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://") && !trimmedUrl.includes("://")) {
			// No protocol - treat as hostname
			return this.parseHostname(trimmedUrl)
		}

		try {
			// Attempt to parse as complete URL - return as-is, let constructor handle ports
			const parsedUrl = new URL(trimmedUrl)
			return trimmedUrl
		} catch {
			// Failed to parse as URL - treat as hostname
			return this.parseHostname(trimmedUrl)
		}
	}

	/**
	 * Handles hostname-only inputs
	 */
	private parseHostname(hostname: string): string {
		if (hostname.includes(":")) {
			// Has port - add http:// prefix if missing
			return hostname.startsWith("http") ? hostname : `http://${hostname}`
		} else {
			// No port - add http:// prefix without port (let constructor handle port assignment)
			return `http://${hostname}`
		}
	}

	private async getCollectionInfo(): Promise<Schemas["CollectionInfo"] | null> {
		try {
			const collectionInfo = await this.client.getCollection(this.collectionName)
			return collectionInfo
		} catch (error: unknown) {
			if (error instanceof Error) {
				console.warn(
					`[QdrantAdapter] Warning during getCollectionInfo for "${this.collectionName}". Collection may not exist or another error occurred:`,
					error.message,
				)
			}
			return null
		}
	}

	async initialize(): Promise<boolean> {
		let created = false
		try {
			const collectionInfo = await this.getCollectionInfo()

			if (collectionInfo === null) {
				// Collection info not retrieved (assume not found or inaccessible), create it
				await this.client.createCollection(this.collectionName, {
					vectors: {
						size: this.vectorSize,
						distance: this.DISTANCE_METRIC,
					},
				})
				created = true
			} else {
				// Collection exists, check vector size
				const vectorsConfig = collectionInfo.config?.params?.vectors
				let existingVectorSize: number

				if (typeof vectorsConfig === "number") {
					existingVectorSize = vectorsConfig
				} else if (
					vectorsConfig &&
					typeof vectorsConfig === "object" &&
					"size" in vectorsConfig &&
					typeof vectorsConfig.size === "number"
				) {
					existingVectorSize = vectorsConfig.size
				} else {
					existingVectorSize = 0 // Fallback for unknown configuration
				}

				if (existingVectorSize === this.vectorSize) {
					created = false // Exists and correct
				} else {
					// Exists but wrong vector size, recreate with enhanced error handling
					created = await this._recreateCollectionWithNewDimension(existingVectorSize)
				}
			}

			// Create payload indexes
			await this._createPayloadIndexes()
			return created
		} catch (error: any) {
			const errorMessage = error?.message || error
			console.error(
				`[QdrantAdapter] Failed to initialize Qdrant collection "${this.collectionName}":`,
				errorMessage,
			)

			// If this is already a vector dimension mismatch error (identified by cause), re-throw it as-is
			if (error instanceof Error && error.cause !== undefined) {
				throw error
			}

			// Otherwise, provide a more user-friendly error message that includes the original error
			throw new Error(
				t("embeddings:vectorStore.qdrantConnectionFailed", { qdrantUrl: this.qdrantUrl, errorMessage }),
			)
		}
	}

	/**
	 * Recreates the collection with a new vector dimension, handling failures gracefully.
	 */
	private async _recreateCollectionWithNewDimension(existingVectorSize: number): Promise<boolean> {
		console.warn(
			`[QdrantAdapter] Collection ${this.collectionName} exists with vector size ${existingVectorSize}, but expected ${this.vectorSize}. Recreating collection.`,
		)

		let deletionSucceeded = false
		let recreationAttempted = false

		try {
			// Step 1: Attempt to delete the existing collection
			console.log(`[QdrantAdapter] Deleting existing collection ${this.collectionName}...`)
			await this.client.deleteCollection(this.collectionName)
			deletionSucceeded = true
			console.log(`[QdrantAdapter] Successfully deleted collection ${this.collectionName}`)

			// Step 2: Wait a brief moment to ensure deletion is processed
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Step 3: Verify the collection is actually deleted
			const verificationInfo = await this.getCollectionInfo()
			if (verificationInfo !== null) {
				throw new Error("Collection still exists after deletion attempt")
			}

			// Step 4: Create the new collection with correct dimensions
			console.log(
				`[QdrantAdapter] Creating new collection ${this.collectionName} with vector size ${this.vectorSize}...`,
			)
			recreationAttempted = true
			await this.client.createCollection(this.collectionName, {
				vectors: {
					size: this.vectorSize,
					distance: this.DISTANCE_METRIC,
				},
			})
			console.log(`[QdrantAdapter] Successfully created new collection ${this.collectionName}`)
			return true
		} catch (recreationError) {
			const errorMessage = recreationError instanceof Error ? recreationError.message : String(recreationError)

			// Provide detailed error context based on what stage failed
			let contextualErrorMessage: string
			if (!deletionSucceeded) {
				contextualErrorMessage = `Failed to delete existing collection with vector size ${existingVectorSize}. ${errorMessage}`
			} else if (!recreationAttempted) {
				contextualErrorMessage = `Deleted existing collection but failed verification step. ${errorMessage}`
			} else {
				contextualErrorMessage = `Deleted existing collection but failed to create new collection with vector size ${this.vectorSize}. ${errorMessage}`
			}

			console.error(
				`[QdrantAdapter] CRITICAL: Failed to recreate collection ${this.collectionName} for dimension change (${existingVectorSize} -> ${this.vectorSize}). ${contextualErrorMessage}`,
			)

			// Create a comprehensive error message for the user
			const dimensionMismatchError = new Error(
				t("embeddings:vectorStore.vectorDimensionMismatch", {
					errorMessage: contextualErrorMessage,
				}),
			)

			// Preserve the original error context
			dimensionMismatchError.cause = recreationError
			throw dimensionMismatchError
		}
	}

	/**
	 * Creates payload indexes for the collection, handling errors gracefully.
	 */
	private async _createPayloadIndexes(): Promise<void> {
		for (let i = 0; i <= 4; i++) {
			try {
				await this.client.createPayloadIndex(this.collectionName, {
					field_name: `pathSegments.${i}`,
					field_schema: "keyword",
				})
			} catch (indexError: any) {
				const errorMessage = (indexError?.message || "").toLowerCase()
				if (!errorMessage.includes("already exists")) {
					console.warn(
						`[QdrantAdapter] Could not create payload index for pathSegments.${i} on ${this.collectionName}. Details:`,
						indexError?.message || indexError,
					)
				}
			}
		}
	}

	async upsertPoints(points: PointStruct[]): Promise<void> {
		try {
			const processedPoints = points.map((point) => {
				if (point.payload?.filePath) {
					const segments = point.payload.filePath.split(path.sep).filter(Boolean)
					const pathSegments = segments.reduce(
						(acc: Record<string, string>, segment: string, index: number) => {
							acc[index.toString()] = segment
							return acc
						},
						{},
					)
					return {
						...point,
						payload: {
							...point.payload,
							pathSegments,
						},
					}
				}
				return point
			})

			await this.client.upsert(this.collectionName, {
				points: processedPoints,
				wait: true,
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
		try {
			let filter = undefined

			if (directoryPrefix) {
				const segments = directoryPrefix.split(path.sep).filter(Boolean)

				filter = {
					must: segments.map((segment, index) => ({
						key: `pathSegments.${index}`,
						match: { value: segment },
					})),
				}
			}

			const searchRequest = {
				query: queryVector,
				filter,
				score_threshold: minScore ?? DEFAULT_SEARCH_MIN_SCORE,
				limit: maxResults ?? DEFAULT_MAX_SEARCH_RESULTS,
				params: {
					hnsw_ef: 128,
					exact: false,
				},
				with_payload: {
					include: ["filePath", "codeChunk", "startLine", "endLine", "pathSegments"],
				},
			}

			const operationResult = await this.client.query(this.collectionName, searchRequest)
			const filteredPoints = operationResult.points.filter((p) => this.isPayloadValid(p.payload))

			return filteredPoints as VectorStoreSearchResult[]
		} catch (error) {
			console.error("Failed to search points:", error)
			throw error
		}
	}

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

	async deleteCollection(): Promise<void> {
		try {
			// Check if collection exists before attempting deletion to avoid errors
			if (await this.collectionExists()) {
				await this.client.deleteCollection(this.collectionName)
			}
		} catch (error) {
			console.error(`[QdrantAdapter] Failed to delete collection ${this.collectionName}:`, error)
			throw error // Re-throw to allow calling code to handle it
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
		const collectionInfo = await this.getCollectionInfo()
		return collectionInfo !== null
	}

	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			// Try to connect to Qdrant by checking collections
			await this.client.getCollections()
			return { valid: true }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			return {
				valid: false,
				error: t("embeddings:vectorStore.qdrantConnectionFailed", {
					qdrantUrl: this.qdrantUrl,
					errorMessage,
				}),
			}
		}
	}

	getConfigurationRequirements() {
		return {
			required: ["url", "vectorSize", "workspacePath"],
			optional: ["apiKey"],
			defaults: {
				url: "http://localhost:6333",
			},
		}
	}
}
