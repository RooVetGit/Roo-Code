import { createClient, type Client as LibSQLClient } from "@libsql/client"
import { createHash } from "crypto"
import * as path from "path"
import * as os from "os"
import { IVectorStore } from "../interfaces/vector-store"
import { VectorStoreSearchResult } from "../interfaces"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants"
import { t } from "../../../i18n"
import * as fs from "fs"

export class LibSQLVectorStore implements IVectorStore {
	private readonly vectorSize: number
	private client: LibSQLClient
	private readonly tableName: string
	private readonly connectionUrl: string
	private initialBackoffMs = 100
	private maxRetries = 3

	constructor(workspacePath: string, basePath: string | undefined, vectorSize: number) {
		this.vectorSize = vectorSize
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		const resolvedBasePath = basePath ?? path.join(os.homedir(), ".roo", "libsql")
		const dbPath = path.join(resolvedBasePath, `ws_${hash.substring(0, 16)}.db`)
		this.connectionUrl = `file:${dbPath}`
		this.tableName = "code_vectors"

		const dbDirectory = path.dirname(dbPath)
		fs.mkdirSync(dbDirectory, { recursive: true })

		this.client = createClient({ url: this.connectionUrl })
		this.client.execute("PRAGMA journal_mode=WAL;").catch((err) => console.warn("Failed to set WAL mode:", err))
		this.client
			.execute("PRAGMA busy_timeout=5000;")
			.catch((err) => console.warn("Failed to set busy timeout:", err))
	}

	private async executeWriteOperationWithRetry<T>(operation: () => Promise<T>, isTransaction = false): Promise<T> {
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

	async initialize(): Promise<boolean> {
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
					await this.client.execute(`DROP TABLE IF EXISTS ${this.tableName}`)
					await this.createTable()
				})
				return true
			}
			return false
		} catch (error) {
			console.error(`Failed to initialize vector store table ${this.tableName}:`, error)
			throw new Error(
				t("embeddings:vectorStore.libsqlConnectionFailed", {
					errorMessage: error instanceof Error ? error.message : String(error),
				}),
			)
		}
	}

	private async tableExists(): Promise<boolean> {
		const result = await this.client.execute({
			sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
			args: [this.tableName],
		})
		return result.rows.length > 0
	}

	private async createTable(): Promise<void> {
		await this.client.execute({
			sql: `
                CREATE TABLE ${this.tableName} (
                    id TEXT PRIMARY KEY,
                    vector F32_BLOB(${this.vectorSize}),
                    filePath TEXT,
                    codeChunk TEXT,
                    startLine INTEGER,
                    endLine INTEGER,
                    pathSegments TEXT
                )
            `,
		})

		await this.client.execute({
			sql: `CREATE INDEX ${this.tableName}_vector_idx ON ${this.tableName} (libsql_vector_idx(vector))`,
		})
	}

	private async getCurrentTableVectorSize(): Promise<number | null> {
		const result = await this.client.execute({
			sql: `PRAGMA table_info(${this.tableName})`,
		})
		const vectorColumn = result.rows.find((row) => row.name === "vector")
		if (vectorColumn && typeof vectorColumn.type === "string") {
			const match = vectorColumn.type.match(/F32_BLOB\((\d+)\)/)
			if (match && match[1]) {
				return parseInt(match[1], 10)
			}
		}
		return null
	}

	async upsertPoints(
		points: Array<{
			id: string
			vector: number[]
			payload: Record<string, any>
		}>,
	): Promise<void> {
		await this.executeWriteOperationWithRetry(async () => {
			const tx = await this.client.transaction("write")
			try {
				for (const point of points) {
					let pathSegments = {}
					if (point.payload?.filePath) {
						const segments = path.normalize(point.payload.filePath).split(path.sep).filter(Boolean)
						pathSegments = segments.reduce(
							(acc: Record<string, string>, segment: string, index: number) => {
								acc[index.toString()] = segment
								return acc
							},
							{},
						)
					}

					await tx.execute({
						sql: `
                            INSERT INTO ${this.tableName} (id, vector, filePath, codeChunk, startLine, endLine, pathSegments)
                            VALUES (?, vector32(?), ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                vector = vector32(?),
                                filePath = ?,
                                codeChunk = ?,
                                startLine = ?,
                                endLine = ?,
                                pathSegments = ?
                        `,
						args: [
							point.id,
							JSON.stringify(point.vector),
							point.payload.filePath,
							point.payload.codeChunk,
							point.payload.startLine,
							point.payload.endLine,
							JSON.stringify(pathSegments),
							JSON.stringify(point.vector),
							point.payload.filePath,
							point.payload.codeChunk,
							point.payload.startLine,
							point.payload.endLine,
							JSON.stringify(pathSegments),
						],
					})
				}
				await tx.commit()
			} catch (error) {
				await tx.rollback()
				throw error
			}
		}, true)
	}

	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		const vectorStr = JSON.stringify(queryVector)
		const k = Math.min((maxResults || DEFAULT_MAX_SEARCH_RESULTS) * 10, 1000)
		const scoreThreshold = minScore ?? DEFAULT_SEARCH_MIN_SCORE

		try {
			let filterQuery = ""
			const filterArgs: any[] = []

			if (directoryPrefix) {
				const segments = path.normalize(directoryPrefix).split(path.sep).filter(Boolean)
				segments.forEach((segment, index) => {
					filterQuery += ` AND json_extract(pathSegments, '$.${index}') = ?`
					filterArgs.push(segment)
				})
			}

			const result = await this.client.execute({
				sql: `
                    SELECT 
                        t.id,
                        (1 - vector_distance_cos(t.vector, vector32(?))) as score,
                        t.filePath,
                        t.codeChunk,
                        t.startLine,
                        t.endLine
                    FROM vector_top_k('${this.tableName}_vector_idx', vector32(?), ?) AS ann
                    JOIN ${this.tableName} AS t ON t.rowid = ann.id
                    WHERE 1=1 ${filterQuery}
                    AND (1 - vector_distance_cos(t.vector, vector32(?))) > ?
                    ORDER BY score DESC
                    LIMIT ?
                `,
				args: [
					vectorStr,
					vectorStr,
					k,
					...filterArgs,
					vectorStr,
					scoreThreshold,
					maxResults || DEFAULT_MAX_SEARCH_RESULTS,
				],
			})

			return result.rows.map((row) => ({
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

	async deletePointsByFilePath(filePath: string): Promise<void> {
		return this.deletePointsByMultipleFilePaths([filePath])
	}

	async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (filePaths.length === 0) return

		await this.executeWriteOperationWithRetry(async () => {
			const tx = await this.client.transaction("write")
			try {
				const normalizedPaths = filePaths.map((filePath) => path.normalize(filePath))

				await tx.execute({
					sql: `
                        DELETE FROM ${this.tableName}
                        WHERE filePath IN (${normalizedPaths.map(() => "?").join(",")})
                    `,
					args: normalizedPaths,
				})
				await tx.commit()
			} catch (error) {
				await tx.rollback()
				throw error
			}
		}, true)
	}

	async deleteCollection(): Promise<void> {
		await this.executeWriteOperationWithRetry(async () => {
			if (await this.tableExists()) {
				await this.client.execute(`DROP TABLE ${this.tableName}`)
				await this.client.execute(`VACUUM`)
			}
		})
	}

	async clearCollection(): Promise<void> {
		await this.executeWriteOperationWithRetry(async () => {
			if (await this.tableExists()) {
				await this.client.execute(`DELETE FROM ${this.tableName}`)
			}
		})
	}

	async collectionExists(): Promise<boolean> {
		return this.tableExists()
	}
}
