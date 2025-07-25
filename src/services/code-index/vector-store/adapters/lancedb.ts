import * as path from "path"
import { VectorDBAdapter, VectorDBConfig } from "./base"
import { PointStruct, VectorStoreSearchResult } from "../../interfaces/vector-store"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../../constants"
import { t } from "../../../../i18n"
import { getWorkspacePath } from "../../../../utils/path"

// Dynamic imports for LanceDB to handle optional dependency
let lancedb: any
let Table: any

/**
 * LanceDB adapter for vector database operations
 * LanceDB is an embedded vector database that doesn't require a separate service
 */
export class LanceDBAdapter extends VectorDBAdapter {
	private db: any
	private table: any
	private dbPath: string
	private initialized: boolean = false

	constructor(config: VectorDBConfig) {
		super(config)
		// Store data in a .lancedb directory within the workspace
		this.dbPath = path.join(config.workspacePath, ".lancedb")
	}

	get providerName(): string {
		return "lancedb"
	}

	get requiresExternalService(): boolean {
		return false // LanceDB is embedded
	}

	/**
	 * Dynamically import LanceDB modules
	 */
	private async loadLanceDB() {
		if (!lancedb) {
			try {
				// @ts-ignore - Dynamic import for optional dependency
				const lancedbModule = await import("@lancedb/lancedb")
				lancedb = lancedbModule.connect
				Table = lancedbModule.Table
			} catch (error) {
				throw new Error(
					t("embeddings:vectorStore.lancedbNotInstalled", {
						errorMessage: error instanceof Error ? error.message : String(error),
					}),
				)
			}
		}
	}

	async initialize(): Promise<boolean> {
		try {
			await this.loadLanceDB()

			// Connect to LanceDB (creates directory if it doesn't exist)
			this.db = await lancedb(this.dbPath)

			// Check if table exists
			const tables = await this.db.tableNames()
			const tableExists = tables.includes(this.collectionName)

			if (!tableExists) {
				// Create new table with schema
				const schema = {
					id: "string",
					vector: `fixed_size_list<${this.vectorSize}>[float32]`,
					filePath: "string",
					codeChunk: "string",
					startLine: "int32",
					endLine: "int32",
					pathSegments: "string", // JSON string for path segments
				}

				// Create empty table with schema
				await this.db.createEmptyTable(this.collectionName, schema)
				this.table = await this.db.openTable(this.collectionName)
				this.initialized = true
				return true // New collection created
			} else {
				// Open existing table
				this.table = await this.db.openTable(this.collectionName)

				// Verify vector dimension matches
				const tableSchema = await this.table.schema
				const vectorField = tableSchema.fields.find((f: any) => f.name === "vector")

				if (vectorField) {
					// Extract dimension from field type
					const dimensionMatch = vectorField.dataType.toString().match(/fixed_size_list<(\d+)>/)
					const existingDimension = dimensionMatch ? parseInt(dimensionMatch[1]) : 0

					if (existingDimension !== this.vectorSize) {
						// Dimension mismatch - need to recreate table
						console.warn(
							`[LanceDBAdapter] Table ${this.collectionName} exists with vector size ${existingDimension}, but expected ${this.vectorSize}. Recreating table.`,
						)

						// Drop and recreate table
						await this.db.dropTable(this.collectionName)

						const schema = {
							id: "string",
							vector: `fixed_size_list<${this.vectorSize}>[float32]`,
							filePath: "string",
							codeChunk: "string",
							startLine: "int32",
							endLine: "int32",
							pathSegments: "string",
						}

						await this.db.createEmptyTable(this.collectionName, schema)
						this.table = await this.db.openTable(this.collectionName)
						this.initialized = true
						return true // Recreated collection
					}
				}

				this.initialized = true
				return false // Existing collection used
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[LanceDBAdapter] Failed to initialize LanceDB:`, errorMessage)
			throw new Error(t("embeddings:vectorStore.lancedbInitFailed", { errorMessage }))
		}
	}

	async upsertPoints(points: PointStruct[]): Promise<void> {
		if (!this.initialized || !this.table) {
			throw new Error("LanceDB not initialized")
		}

		try {
			// Transform points to LanceDB format
			const records = points.map((point) => {
				const pathSegments = point.payload?.filePath
					? point.payload.filePath
							.split(path.sep)
							.filter(Boolean)
							.reduce((acc: Record<string, string>, segment: string, index: number) => {
								acc[index.toString()] = segment
								return acc
							}, {})
					: {}

				return {
					id: point.id,
					vector: Array.from(point.vector), // Ensure it's a regular array
					filePath: point.payload?.filePath || "",
					codeChunk: point.payload?.codeChunk || "",
					startLine: point.payload?.startLine || 0,
					endLine: point.payload?.endLine || 0,
					pathSegments: JSON.stringify(pathSegments),
				}
			})

			// Add records to table
			await this.table.add(records)
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
		if (!this.initialized || !this.table) {
			throw new Error("LanceDB not initialized")
		}

		try {
			// Build query
			let query = this.table.vectorSearch(Array.from(queryVector)).limit(maxResults ?? DEFAULT_MAX_SEARCH_RESULTS)

			// LanceDB uses distance, not similarity score
			// For cosine distance: 0 = identical, 2 = opposite
			// Convert minScore (0-1 similarity) to maxDistance (0-2 distance)
			const maxDistance = minScore !== undefined ? 2 * (1 - minScore) : 2 * (1 - DEFAULT_SEARCH_MIN_SCORE)
			query = query.where(`distance <= ${maxDistance}`)

			// Apply directory filter if provided
			if (directoryPrefix) {
				const segments = directoryPrefix.split(path.sep).filter(Boolean)

				// Build filter for path segments
				// LanceDB doesn't support JSON queries directly, so we'll filter in post-processing
				// For now, use a simple filePath prefix filter
				const normalizedPrefix = segments.join(path.sep)
				query = query.where(`filePath LIKE '${normalizedPrefix}%'`)
			}

			// Execute search
			const results = await query.execute()

			// Transform results to our format
			return results
				.map((result: any) => {
					// Convert distance to similarity score
					const score = 1 - result._distance / 2

					// Parse path segments
					let pathSegments = {}
					try {
						pathSegments = JSON.parse(result.pathSegments || "{}")
					} catch {
						// Ignore parse errors
					}

					return {
						id: result.id,
						score: score,
						payload: {
							filePath: result.filePath,
							codeChunk: result.codeChunk,
							startLine: result.startLine,
							endLine: result.endLine,
							pathSegments,
						},
					}
				})
				.filter((result: VectorStoreSearchResult) => {
					// Additional filtering for directory prefix if needed
					if (directoryPrefix) {
						const segments = directoryPrefix.split(path.sep).filter(Boolean)
						const resultSegments = result.payload?.pathSegments || {}

						// Check if all prefix segments match
						return segments.every((segment, index) => resultSegments[index.toString()] === segment)
					}
					return true
				})
				.filter((result: VectorStoreSearchResult) => this.isPayloadValid(result.payload))
		} catch (error) {
			console.error("Failed to search points:", error)
			throw error
		}
	}

	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (!this.initialized || !this.table) {
			throw new Error("LanceDB not initialized")
		}

		if (filePaths.length === 0) {
			return
		}

		try {
			const workspaceRoot = getWorkspacePath()
			const normalizedPaths = filePaths.map((filePath) => {
				const absolutePath = path.resolve(workspaceRoot, filePath)
				return path.normalize(absolutePath)
			})

			// Delete records matching any of the file paths
			for (const normalizedPath of normalizedPaths) {
				await this.table.delete(`filePath = '${normalizedPath}'`)
			}
		} catch (error) {
			console.error("Failed to delete points by file paths:", error)
			throw error
		}
	}

	async deleteCollection(): Promise<void> {
		try {
			if (this.db && (await this.collectionExists())) {
				await this.db.dropTable(this.collectionName)
				this.table = null
				this.initialized = false
			}
		} catch (error) {
			console.error(`[LanceDBAdapter] Failed to delete collection ${this.collectionName}:`, error)
			throw error
		}
	}

	async clearCollection(): Promise<void> {
		if (!this.initialized || !this.table) {
			throw new Error("LanceDB not initialized")
		}

		try {
			// Delete all records
			await this.table.delete("1 = 1") // Delete where true (all records)
		} catch (error) {
			console.error("Failed to clear collection:", error)
			throw error
		}
	}

	async collectionExists(): Promise<boolean> {
		try {
			if (!this.db) {
				await this.loadLanceDB()
				this.db = await lancedb(this.dbPath)
			}

			const tables = await this.db.tableNames()
			return tables.includes(this.collectionName)
		} catch {
			return false
		}
	}

	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			// Try to load LanceDB
			await this.loadLanceDB()

			// Try to connect
			const testDb = await lancedb(this.dbPath)

			// List tables to verify connection works
			await testDb.tableNames()

			return { valid: true }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			if (errorMessage.includes("Cannot find module")) {
				return {
					valid: false,
					error: t("embeddings:vectorStore.lancedbNotInstalled", { errorMessage }),
				}
			}

			return {
				valid: false,
				error: t("embeddings:vectorStore.lancedbConnectionFailed", { errorMessage }),
			}
		}
	}

	getConfigurationRequirements() {
		return {
			required: ["vectorSize", "workspacePath"],
			optional: [],
			defaults: {},
		}
	}
}
