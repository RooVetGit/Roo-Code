import { createHash } from "crypto"
import * as path from "path"
import * as os from "os"
import { IVectorStore } from "../interfaces/vector-store"
import { VectorStoreSearchResult } from "../interfaces"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants"
import * as fs from "fs"

export class LibSQLVectorStore implements IVectorStore {
	private readonly vectorSize: number
	private client: any = null
	private readonly tableName: string
	private readonly connectionUrl: string
	private readonly indexName: string
	private initialBackoffMs = 100
	private maxRetries = 3
	private libsqlModule: any = null

	constructor(workspacePath: string, basePath: string | undefined, vectorSize: number) {
		this.vectorSize = vectorSize
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		const resolvedBasePath = basePath ?? path.join(os.homedir(), ".roo", "libsql")
		const dbPath = path.join(resolvedBasePath, `ws_${hash.substring(0, 16)}.db`)
		this.connectionUrl = `file:${dbPath}`
		this.tableName = "code_vectors"
		this.indexName = `${this.tableName}_vector_idx`

		const dbDirectory = path.dirname(dbPath)
		fs.mkdirSync(dbDirectory, { recursive: true })
	}

	private async ensureClient(): Promise<void> {
		if (!this.client) {
			if (!this.libsqlModule) {
				this.libsqlModule = await import("@libsql/client")
			}

			this.client = this.libsqlModule.createClient({
				url: this.connectionUrl,
				concurrency: 3,
			})
			await this.initializePragmas()
		}
	}

	private async initializePragmas(): Promise<void> {
		if (!this.client) return

		try {
			await this.client.execute("PRAGMA journal_mode=TRUNCATE;")
			await this.client.execute("PRAGMA synchronous=NORMAL;")
			await this.client.execute("PRAGMA busy_timeout=5000;")
			await this.client.execute("PRAGMA temp_store=MEMORY;")
			await this.client.execute("PRAGMA page_size=4096;")
			await this.client.execute("PRAGMA cache_size=-16000;")
			await this.client.execute("PRAGMA mmap_size=67108864;")
			await this.client.execute("PRAGMA auto_vacuum=INCREMENTAL;")
			await this.client.execute("PRAGMA incremental_vacuum;")
		} catch (err) {
			console.warn("Failed to set pragmas:", err)
		}
	}

	private async executeWriteOperationWithRetry<T>(operation: () => Promise<T>, isTransaction = false): Promise<T> {
		await this.ensureClient()

		let attempts = 0
		let backoff = this.initialBackoffMs

		while (attempts < this.maxRetries) {
			try {
				return await operation()
			} catch (error: any) {
				if (
					error.code === "SQLITE_BUSY" ||
					(error.message && error.message.toLowerCase().includes("database is locked"))
				) {
					attempts++
					if (attempts >= this.maxRetries) {
						console.error(
							`LibSQLVector: Operation failed after ${this.maxRetries} attempts due to: ${error.message}`,
							error,
						)
						throw error
					}
					console.warn(
						`LibSQLVector: Attempt ${attempts} failed due to ${isTransaction ? "transaction " : ""}database lock. Retrying in ${backoff}ms...`,
					)
					await new Promise((resolve) => setTimeout(resolve, backoff))
					backoff *= 2
				} else {
					throw error
				}
			}
		}
		throw new Error("LibSQLVector: Max retries reached, but no error was re-thrown from the loop.")
	}

	public async initialize(): Promise<boolean> {
		await this.ensureClient()

		try {
			const exists = await this.tableExists()
			if (!exists) {
				await this.executeWriteOperationWithRetry(() => this.createTable())
				return true
			}

			const currentVectorSize = await this.getCurrentTableVectorSize()
			if (currentVectorSize !== this.vectorSize) {
				console.warn(
					`LibSQLVector: Existing table ${this.tableName} has vector size ${currentVectorSize}, but expected ${this.vectorSize}. Recreating table.`,
				)
				await this.executeWriteOperationWithRetry(async () => {
					await this.client!.execute(`DROP TABLE IF EXISTS ${this.tableName}`)
					await this.createTable()
				})
				return true
			}
			return false
		} catch (error) {
			console.error(`Failed to initialize vector store table ${this.tableName}:`, error)
			throw new Error(`LibsqlConnectionFailed ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	private async tableExists(): Promise<boolean> {
		await this.ensureClient()
		const result = await this.client!.execute({
			sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
			args: [this.tableName],
		})
		return result.rows.length > 0
	}

	private async createTable(): Promise<void> {
		await this.client!.execute({
			sql: `
                CREATE TABLE ${this.tableName} (
                    id TEXT PRIMARY KEY,
                    vector F32_BLOB(${this.vectorSize}),
                    filePath TEXT NOT NULL,
                    codeChunk TEXT,
                    startLine INTEGER,
                    endLine INTEGER
                ) WITHOUT ROWID
            `,
		})

		console.log(`Created table ${this.tableName} without vector index for faster bulk inserts`)
	}

	private async getCurrentTableVectorSize(): Promise<number | null> {
		const result = await this.client!.execute({
			sql: `PRAGMA table_info(${this.tableName})`,
		})
		const vectorColumn = result.rows.find((row: any) => row.name === "vector")
		if (vectorColumn && typeof vectorColumn.type === "string") {
			const match = vectorColumn.type.match(/F32_BLOB\((\d+)\)/)
			if (match && match[1]) {
				return parseInt(match[1], 10)
			}
		}
		return null
	}

	public async dropVectorIndex(): Promise<void> {
		await this.executeWriteOperationWithRetry(async () => {
			try {
				await this.client!.execute(`DROP INDEX IF EXISTS ${this.indexName}`)
				console.log(`Dropped vector index ${this.indexName}`)
			} catch (error) {
				console.warn(`Failed to drop vector index ${this.indexName}:`, error)
			}
		})
	}

	public async createVectorIndex(): Promise<void> {
		await this.executeWriteOperationWithRetry(async () => {
			const maxNeighbors = Math.max(10, Math.floor(Math.sqrt(this.vectorSize)))

			console.log(
				`Creating optimized vector index ${this.indexName} with ${maxNeighbors} neighbors (vs default ${Math.floor(3 * Math.sqrt(this.vectorSize))})`,
			)

			await this.client!.execute({
				sql: `CREATE INDEX ${this.indexName} ON ${this.tableName} (libsql_vector_idx(vector, 'compress_neighbors=float8', 'max_neighbors=${maxNeighbors}'))`,
			})

			console.log(`Successfully created vector index ${this.indexName}`)
		})
	}

	private async hasVectorIndex(): Promise<boolean> {
		await this.ensureClient()
		const result = await this.client!.execute({
			sql: `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
			args: [this.indexName],
		})
		return result.rows.length > 0
	}

	public async upsertPoints(
		points: Array<{
			id: string
			vector: number[]
			payload: Record<string, any>
		}>,
	): Promise<void> {
		await this.executeWriteOperationWithRetry(async () => {
			const statements = points.map((point) => {
				const vectorStr = JSON.stringify(point.vector)
				return {
					sql: `
						INSERT INTO ${this.tableName} (id, vector, filePath, codeChunk, startLine, endLine)
						VALUES (?, vector32(?), ?, ?, ?, ?)
						ON CONFLICT(id) DO UPDATE SET
							vector = vector32(?),
							filePath = ?,
							codeChunk = ?,
							startLine = ?,
							endLine = ?
					`,
					args: [
						point.id,
						vectorStr,
						point.payload.filePath,
						point.payload.codeChunk,
						point.payload.startLine,
						point.payload.endLine,
						vectorStr,
						point.payload.filePath,
						point.payload.codeChunk,
						point.payload.startLine,
						point.payload.endLine,
					],
				}
			})

			const chunkSize = 100
			for (let i = 0; i < statements.length; i += chunkSize) {
				const chunk = statements.slice(i, i + chunkSize)
				await this.client!.batch(chunk, "write")
				if (i > 0 && i % 1000 === 0) {
					await this.client!.execute("PRAGMA incremental_vacuum;")
				}
			}
		}, true)
	}

	public async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		await this.ensureClient()

		const hasIndex = await this.hasVectorIndex()
		if (!hasIndex) {
			console.warn(`Vector index ${this.indexName} does not exist. Creating it now for search operation...`)
			await this.createVectorIndex()
		}

		const vectorStr = JSON.stringify(queryVector)
		const k = Math.floor(Math.min((maxResults || DEFAULT_MAX_SEARCH_RESULTS) * 1.5, 100))
		const scoreThreshold = minScore ?? DEFAULT_SEARCH_MIN_SCORE

		try {
			let sql: string
			let args: any[]

			if (directoryPrefix) {
				const normalizedPrefix = path.normalize(directoryPrefix)
				const likePattern = normalizedPrefix.endsWith(path.sep)
					? `${normalizedPrefix}%`
					: `${normalizedPrefix}${path.sep}%`

				sql = `
					SELECT 
						t.id,
						(1 - vector_distance_cos(t.vector, vector32(?))) as score,
						t.filePath,
						t.codeChunk,
						t.startLine,
						t.endLine
					FROM vector_top_k('${this.indexName}', vector32(?), ?) AS ann
					JOIN ${this.tableName} AS t ON t.id = ann.id
					WHERE t.filePath LIKE ?
					AND (1 - vector_distance_cos(t.vector, vector32(?))) > ?
					ORDER BY score DESC
					LIMIT ?
				`
				args = [
					vectorStr,
					vectorStr,
					k,
					likePattern,
					vectorStr,
					scoreThreshold,
					maxResults || DEFAULT_MAX_SEARCH_RESULTS,
				]
			} else {
				sql = `
					SELECT 
						t.id,
						(1 - vector_distance_cos(t.vector, vector32(?))) as score,
						t.filePath,
						t.codeChunk,
						t.startLine,
						t.endLine
					FROM vector_top_k('${this.indexName}', vector32(?), ?) AS ann
					JOIN ${this.tableName} AS t ON t.id = ann.id
					WHERE (1 - vector_distance_cos(t.vector, vector32(?))) > ?
					ORDER BY score DESC
					LIMIT ?
				`
				args = [vectorStr, vectorStr, k, vectorStr, scoreThreshold, maxResults || DEFAULT_MAX_SEARCH_RESULTS]
			}

			const result = await this.client!.execute({ sql, args })

			return result.rows.map((row: any) => ({
				id: row.id as string,
				score: row.score as number,
				filePath: row.filePath as string,
				payload: {
					filePath: row.filePath as string,
					codeChunk: row.codeChunk as string,
					startLine: row.startLine as number,
					endLine: row.endLine as number,
				},
			}))
		} catch (error) {
			console.error("Failed to search points:", error)
			throw error
		}
	}

	public async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	public async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) return

		await this.executeWriteOperationWithRetry(async () => {
			const normalizedPaths = filePaths.map((filePath) => path.normalize(filePath))

			if (normalizedPaths.length > 10) {
				const statements = normalizedPaths.map((filePath) => ({
					sql: `DELETE FROM ${this.tableName} WHERE filePath = ?`,
					args: [filePath],
				}))

				const chunkSize = 50
				for (let i = 0; i < statements.length; i += chunkSize) {
					const chunk = statements.slice(i, i + chunkSize)
					await this.client!.batch(chunk, "write")
				}
			} else {
				await this.client!.execute({
					sql: `DELETE FROM ${this.tableName} WHERE filePath IN (${normalizedPaths.map(() => "?").join(",")})`,
					args: normalizedPaths,
				})
			}

			await this.client!.execute("PRAGMA incremental_vacuum;")
		})
	}

	public async deleteCollection(): Promise<void> {
		await this.executeWriteOperationWithRetry(async () => {
			if (await this.tableExists()) {
				await this.client!.execute(`DROP TABLE ${this.tableName}`)
				await this.client!.execute("VACUUM")
			}
		})
	}

	public async clearCollection(): Promise<void> {
		await this.executeWriteOperationWithRetry(async () => {
			if (await this.tableExists()) {
				await this.client!.execute(`DELETE FROM ${this.tableName}`)
				await this.client!.execute("PRAGMA incremental_vacuum;")
			}
		})
	}

	public async collectionExists(): Promise<boolean> {
		return this.tableExists()
	}
}
