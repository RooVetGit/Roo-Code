import * as path from "path"
import { VectorDBAdapter, VectorDBConfig } from "./base"
import { PointStruct, VectorStoreSearchResult } from "../../interfaces/vector-store"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../../constants"
import { t } from "../../../../i18n"
import { getWorkspacePath } from "../../../../utils/path"

// Dynamic imports for SQLite to handle optional dependency
let Database: any

/**
 * SQLite+Vector adapter for vector database operations
 * Uses sqlite-vss extension for vector similarity search
 */
export class SQLiteVectorAdapter extends VectorDBAdapter {
	private db: any
	private dbPath: string
	private initialized: boolean = false
	private tableName: string

	constructor(config: VectorDBConfig) {
		super(config)
		// Store database in workspace directory
		this.dbPath = path.join(config.workspacePath, ".roo-code-index.db")
		// Use sanitized collection name for table
		this.tableName = `vectors_${this.collectionName.replace(/[^a-zA-Z0-9_]/g, "_")}`
	}

	get providerName(): string {
		return "sqlite-vector"
	}

	get requiresExternalService(): boolean {
		return false // SQLite is embedded
	}

	/**
	 * Dynamically import SQLite modules
	 */
	private async loadSQLite() {
		if (!Database) {
			try {
				// @ts-ignore - Dynamic import for optional dependency
				const sqliteModule = await import("better-sqlite3")
				Database = sqliteModule.default
			} catch (error) {
				throw new Error(
					t("embeddings:vectorStore.sqliteNotInstalled", {
						errorMessage: error instanceof Error ? error.message : String(error),
					}),
				)
			}
		}
	}

	/**
	 * Load sqlite-vss extension
	 */
	private async loadVectorExtension() {
		try {
			// Load the vector extension
			// @ts-ignore - Dynamic loading
			const vssPath = require.resolve("sqlite-vss")
			this.db.loadExtension(vssPath)
		} catch (error) {
			throw new Error(
				t("embeddings:vectorStore.sqliteVssNotInstalled", {
					errorMessage: error instanceof Error ? error.message : String(error),
				}),
			)
		}
	}

	async initialize(): Promise<boolean> {
		try {
			await this.loadSQLite()

			// Open database connection
			this.db = new Database(this.dbPath)

			// Enable WAL mode for better concurrency
			this.db.pragma("journal_mode = WAL")

			// Load vector extension
			await this.loadVectorExtension()

			// Check if table exists
			const tableExists = this.db
				.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
				.get(this.tableName)

			let created = false

			if (!tableExists) {
				// Create tables
				this.db.exec(`
					CREATE TABLE IF NOT EXISTS ${this.tableName} (
						id TEXT PRIMARY KEY,
						file_path TEXT NOT NULL,
						code_chunk TEXT NOT NULL,
						start_line INTEGER NOT NULL,
						end_line INTEGER NOT NULL,
						path_segments TEXT NOT NULL
					);

					CREATE INDEX IF NOT EXISTS idx_${this.tableName}_file_path 
					ON ${this.tableName}(file_path);
				`)

				// Create virtual table for vector search
				this.db.exec(`
					CREATE VIRTUAL TABLE IF NOT EXISTS ${this.tableName}_vss USING vss0(
						vector(${this.vectorSize})
					);
				`)

				created = true
			} else {
				// Verify vector dimension
				const vssInfo = this.db
					.prepare(`SELECT sql FROM sqlite_master WHERE name = ?`)
					.get(`${this.tableName}_vss`)

				if (vssInfo && vssInfo.sql) {
					const dimensionMatch = vssInfo.sql.match(/vector\((\d+)\)/)
					const existingDimension = dimensionMatch ? parseInt(dimensionMatch[1]) : 0

					if (existingDimension !== this.vectorSize) {
						// Dimension mismatch - recreate tables
						console.warn(
							`[SQLiteVectorAdapter] Table ${this.tableName} exists with vector size ${existingDimension}, but expected ${this.vectorSize}. Recreating tables.`,
						)

						// Drop existing tables
						this.db.exec(`
							DROP TABLE IF EXISTS ${this.tableName}_vss;
							DROP TABLE IF EXISTS ${this.tableName};
						`)

						// Recreate tables
						this.db.exec(`
							CREATE TABLE ${this.tableName} (
								id TEXT PRIMARY KEY,
								file_path TEXT NOT NULL,
								code_chunk TEXT NOT NULL,
								start_line INTEGER NOT NULL,
								end_line INTEGER NOT NULL,
								path_segments TEXT NOT NULL
							);

							CREATE INDEX idx_${this.tableName}_file_path 
							ON ${this.tableName}(file_path);

							CREATE VIRTUAL TABLE ${this.tableName}_vss USING vss0(
								vector(${this.vectorSize})
							);
						`)

						created = true
					}
				}
			}

			this.initialized = true
			return created
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[SQLiteVectorAdapter] Failed to initialize SQLite:`, errorMessage)
			throw new Error(t("embeddings:vectorStore.sqliteInitFailed", { errorMessage }))
		}
	}

	async upsertPoints(points: PointStruct[]): Promise<void> {
		if (!this.initialized || !this.db) {
			throw new Error("SQLite not initialized")
		}

		const insertStmt = this.db.prepare(`
			INSERT OR REPLACE INTO ${this.tableName} 
			(id, file_path, code_chunk, start_line, end_line, path_segments)
			VALUES (?, ?, ?, ?, ?, ?)
		`)

		const insertVectorStmt = this.db.prepare(`
			INSERT OR REPLACE INTO ${this.tableName}_vss 
			(rowid, vector)
			VALUES ((SELECT rowid FROM ${this.tableName} WHERE id = ?), ?)
		`)

		const transaction = this.db.transaction((points: PointStruct[]) => {
			for (const point of points) {
				// Build path segments
				const pathSegments = point.payload?.filePath
					? point.payload.filePath
							.split(path.sep)
							.filter(Boolean)
							.reduce((acc: Record<string, string>, segment: string, index: number) => {
								acc[index.toString()] = segment
								return acc
							}, {})
					: {}

				// Insert metadata
				insertStmt.run(
					point.id,
					point.payload?.filePath || "",
					point.payload?.codeChunk || "",
					point.payload?.startLine || 0,
					point.payload?.endLine || 0,
					JSON.stringify(pathSegments),
				)

				// Insert vector
				// Convert vector to blob format expected by sqlite-vss
				const vectorBlob = Buffer.from(new Float32Array(point.vector).buffer)
				insertVectorStmt.run(point.id, vectorBlob)
			}
		})

		try {
			transaction(points)
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
		if (!this.initialized || !this.db) {
			throw new Error("SQLite not initialized")
		}

		try {
			// Convert query vector to blob
			const queryBlob = Buffer.from(new Float32Array(queryVector).buffer)

			// Build base query
			let query = `
				SELECT 
					t.id,
					t.file_path,
					t.code_chunk,
					t.start_line,
					t.end_line,
					t.path_segments,
					vss.distance
				FROM ${this.tableName}_vss vss
				INNER JOIN ${this.tableName} t ON t.rowid = vss.rowid
				WHERE vss_search(vss.vector, ?)
			`

			const params: any[] = [queryBlob]

			// Add directory filter if provided
			if (directoryPrefix) {
				const segments = directoryPrefix.split(path.sep).filter(Boolean)
				const conditions: string[] = []

				segments.forEach((segment, index) => {
					conditions.push(`json_extract(t.path_segments, '$."${index}"') = ?`)
					params.push(segment)
				})

				if (conditions.length > 0) {
					query += ` AND ${conditions.join(" AND ")}`
				}
			}

			// Add limit
			query += ` LIMIT ?`
			params.push(maxResults ?? DEFAULT_MAX_SEARCH_RESULTS)

			// Execute search
			const stmt = this.db.prepare(query)
			const results = stmt.all(...params)

			// Transform results
			return results
				.map((row: any) => {
					// Convert distance to similarity score
					// SQLite-vss returns L2 distance, convert to cosine similarity
					const distance = row.distance || 0
					const score = 1 / (1 + distance)

					// Skip results below minimum score
					if (score < (minScore ?? DEFAULT_SEARCH_MIN_SCORE)) {
						return null
					}

					// Parse path segments
					let pathSegments = {}
					try {
						pathSegments = JSON.parse(row.path_segments || "{}")
					} catch {
						// Ignore parse errors
					}

					const payload = {
						filePath: row.file_path,
						codeChunk: row.code_chunk,
						startLine: row.start_line,
						endLine: row.end_line,
						pathSegments,
					}

					if (this.isPayloadValid(payload)) {
						return {
							id: row.id,
							score,
							payload,
						}
					}
					return null
				})
				.filter((result: VectorStoreSearchResult | null): result is VectorStoreSearchResult => result !== null)
		} catch (error) {
			console.error("Failed to search points:", error)
			throw error
		}
	}

	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (!this.initialized || !this.db) {
			throw new Error("SQLite not initialized")
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

			// Delete from both tables
			const deleteStmt = this.db.prepare(`
				DELETE FROM ${this.tableName} WHERE file_path = ?
			`)

			const deleteVectorStmt = this.db.prepare(`
				DELETE FROM ${this.tableName}_vss 
				WHERE rowid IN (
					SELECT rowid FROM ${this.tableName} WHERE file_path = ?
				)
			`)

			const transaction = this.db.transaction((paths: string[]) => {
				for (const normalizedPath of paths) {
					deleteVectorStmt.run(normalizedPath)
					deleteStmt.run(normalizedPath)
				}
			})

			transaction(normalizedPaths)
		} catch (error) {
			console.error("Failed to delete points by file paths:", error)
			throw error
		}
	}

	async deleteCollection(): Promise<void> {
		try {
			if (this.db) {
				// Drop tables
				this.db.exec(`
					DROP TABLE IF EXISTS ${this.tableName}_vss;
					DROP TABLE IF EXISTS ${this.tableName};
				`)

				// Close database
				this.db.close()
				this.db = null
				this.initialized = false
			}
		} catch (error) {
			console.error(`[SQLiteVectorAdapter] Failed to delete collection ${this.collectionName}:`, error)
			throw error
		}
	}

	async clearCollection(): Promise<void> {
		if (!this.initialized || !this.db) {
			throw new Error("SQLite not initialized")
		}

		try {
			// Delete all records from both tables
			this.db.exec(`
				DELETE FROM ${this.tableName}_vss;
				DELETE FROM ${this.tableName};
			`)
		} catch (error) {
			console.error("Failed to clear collection:", error)
			throw error
		}
	}

	async collectionExists(): Promise<boolean> {
		try {
			if (!this.db) {
				await this.loadSQLite()
				this.db = new Database(this.dbPath)
			}

			const tableExists = this.db
				.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
				.get(this.tableName)

			return !!tableExists
		} catch {
			return false
		}
	}

	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			// Try to load SQLite
			await this.loadSQLite()

			// Try to create a test database
			const testDb = new Database(":memory:")

			// Try to load vector extension
			try {
				// @ts-ignore
				const vssPath = require.resolve("sqlite-vss")
				testDb.loadExtension(vssPath)
			} catch (error) {
				testDb.close()
				throw new Error(
					t("embeddings:vectorStore.sqliteVssNotInstalled", {
						errorMessage: error instanceof Error ? error.message : String(error),
					}),
				)
			}

			// Test vector operations
			testDb.exec(`CREATE VIRTUAL TABLE test_vss USING vss0(vector(3))`)
			testDb.close()

			return { valid: true }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			if (errorMessage.includes("Cannot find module")) {
				return {
					valid: false,
					error: t("embeddings:vectorStore.sqliteNotInstalled", { errorMessage }),
				}
			}

			return {
				valid: false,
				error: t("embeddings:vectorStore.sqliteInitFailed", { errorMessage }),
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
