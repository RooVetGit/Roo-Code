import { createHash } from "crypto"
import * as path from "path"
import * as os from "os"
import sql from "node:sqlite"
import { getWorkspacePath } from "../../../utils/path"
import { IVectorStore } from "../interfaces/vector-store"
import { Payload, VectorStoreSearchResult } from "../interfaces"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants"
import { t } from "../../../i18n"

/**
 * Local implementation of the vector store using SQLite
 */
export class LocalVectorStore implements IVectorStore {
	private readonly vectorSize: number
	private readonly DISTANCE_METRIC = "Cosine"
	private readonly dbPath: string
	private db: sql.DatabaseSync | null = null
	private readonly collectionName: string
	private cachedCollectionId: number | null = null

	private readonly UPDATE_BATCH_SIZE = 1000
	private readonly SEARCH_BATCH_SIZE = 10000

	constructor(workspacePath: string, vectorSize: number, dbDirectory: string) {
		this.vectorSize = vectorSize
		const basename = path.basename(workspacePath)
		// Generate collection name from workspace path
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		this.collectionName = `${basename}-${hash.substring(0, 16)}`
		// Set up database path
		this.dbPath = path.join(dbDirectory, this.collectionName, `vector-store.db`)
	}

	private async getDb(): Promise<sql.DatabaseSync> {
		if (this.db) {
			return this.db
		}

		// Create parent directory if needed
		const fs = require("fs")
		const dir = path.dirname(this.dbPath)
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true })
		}

		this.db = new sql.DatabaseSync(this.dbPath)
		await this.initializeDatabase()
		return this.db
	}

	private async initializeDatabase(): Promise<void> {
		if (!this.db) return

		this.db.exec(`
			PRAGMA journal_mode = WAL;
			PRAGMA synchronous = NORMAL;
			PRAGMA cache_size = 100000;
			PRAGMA locking_mode = NORMAL;
			PRAGMA temp_store = MEMORY;
		`)
		// Create tables if they don't exist
		await this.db.exec(`
            CREATE TABLE IF NOT EXISTS collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                vector_size INTEGER NOT NULL,
                distance_metric TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                UNIQUE(collection_id, file_path)
            );

            CREATE TABLE IF NOT EXISTS vectors (
                id TEXT PRIMARY KEY,
                collection_id INTEGER NOT NULL,
                vector BLOB NOT NULL,
    			norm REAL NOT NULL,
                file_id INTEGER NOT NULL,
                code_chunk TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_vectors_collection_file_id ON vectors(collection_id, file_id);
        `)

		// Ensure our collection exists
		const existing = await this.db.prepare("SELECT id FROM collections WHERE name = ?").get(this.collectionName)

		if (!existing) {
			await this.db
				.prepare("INSERT INTO collections (name, vector_size, distance_metric) VALUES (?, ?, ?)")
				.run(this.collectionName, this.vectorSize, this.DISTANCE_METRIC)
		}
	}

	async initialize(): Promise<boolean> {
		try {
			await this.closeConnect()
			const db = await this.getDb()

			// Check if collection exists and has correct vector size
			const collection = await db
				.prepare("SELECT id, vector_size FROM collections WHERE name = ?")
				.get(this.collectionName)

			if (!collection) {
				// Create new collection
				await db
					.prepare("INSERT INTO collections (name, vector_size, distance_metric) VALUES (?, ?, ?)")
					.run(this.collectionName, this.vectorSize, this.DISTANCE_METRIC)
				const newCollection = await db
					.prepare("SELECT id FROM collections WHERE name = ?")
					.get(this.collectionName)
				this.cachedCollectionId = newCollection?.id != null ? Number(newCollection.id) : null
				return true
			} else if (collection.vector_size !== this.vectorSize) {
				// Recreate collection with correct vector size
				await db.prepare("DELETE FROM vectors WHERE collection_id = ?").run(collection.id)
				await db.prepare("DELETE FROM files WHERE collection_id = ?").run(collection.id)
				await db
					.prepare("UPDATE collections SET vector_size = ? WHERE id = ?")
					.run(this.vectorSize, collection.id)
				this.cachedCollectionId = collection.id != null ? Number(collection.id) : null
				return true
			}

			this.cachedCollectionId = collection.id != null ? Number(collection.id) : null
			return false
		} catch (error) {
			console.error(`[LocalVectorStore] Failed to initialize:`, error)
			throw new Error(t("embeddings:vectorStore.localStoreInitFailed", { errorMessage: error.message }))
		}
	}

	async upsertPoints(
		points: Array<{
			id: string
			vector: number[]
			payload: Record<string, any>
		}>,
	): Promise<void> {
		const db = await this.getDb()
		const collectionId = this.cachedCollectionId
		if (collectionId == null) {
			throw new Error(`Collection ${this.collectionName} not found`)
		}
		if (points.length === 0) {
			return
		}

		const valids = points.filter((point) => this.isPayloadValid(point.payload))
		const filePaths = valids.map((p) => p.payload.filePath)
		const uniqueFilePaths = [...new Set(filePaths)]

		try {
			await db.exec("BEGIN TRANSACTION")
			const filePathIn = uniqueFilePaths.map(() => "?").join(",")
			const existingFiles = await db
				.prepare(`SELECT id, file_path FROM files WHERE collection_id = ? AND file_path IN (${filePathIn})`)
				.all(collectionId, ...uniqueFilePaths)

			const existingPaths = new Set(existingFiles.map((f) => f.file_path))
			const newFilePaths = uniqueFilePaths.filter((p) => !existingPaths.has(p))

			if (newFilePaths.length > 0) {
				const placeholders = newFilePaths.map(() => "(?, ?)").join(",")
				const insertSql = `INSERT INTO files (collection_id, file_path) VALUES ${placeholders}`
				const insertParams = []
				for (const filePath of newFilePaths) {
					insertParams.push(collectionId, filePath)
				}
				await db.prepare(insertSql).run(...insertParams)
			}

			const allFiles = await db
				.prepare(`SELECT id, file_path FROM files WHERE collection_id = ? AND file_path IN (${filePathIn})`)
				.all(collectionId, ...uniqueFilePaths)
			const existingFilesFinal = allFiles
			const fileIdMap = new Map(existingFilesFinal.map((f) => [f.file_path, f.id]))

			const batchSize = this.UPDATE_BATCH_SIZE
			for (let i = 0; i < valids.length; i += batchSize) {
				const validBatch = valids.slice(i, i + batchSize)

				if (validBatch.length === 0) {
					continue
				}

				const placeholders = validBatch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(",")
				const sqlStr = `
					INSERT OR REPLACE INTO vectors
						(id, collection_id, vector, norm, file_id, code_chunk, start_line, end_line)
					VALUES ${placeholders}
				`

				const values: any[] = []
				for (const point of validBatch) {
					const vectorBuffer = Buffer.from(Float32Array.from(point.vector).buffer)
					const norm = Math.sqrt(point.vector.reduce((sum, val) => sum + val * val, 0))
					const fileId = fileIdMap.get(point.payload.filePath)
					if (typeof fileId !== "number") {
						throw new Error(`Failed to get file_id for filePath: ${point.payload.filePath}`)
					}
					values.push(
						point.id,
						collectionId,
						vectorBuffer,
						norm,
						fileId,
						point.payload.codeChunk,
						point.payload.startLine,
						point.payload.endLine,
					)
				}

				await db.prepare(sqlStr).run(...values)
			}

			await db.exec("COMMIT")
		} catch (error) {
			await db.exec("ROLLBACK")
			console.error("Failed to upsert points:", error)
			throw error
		}
	}

	private isPayloadValid(payload: Record<string, unknown> | null | undefined): payload is Payload {
		if (!payload) {
			return false
		}
		const validKeys = ["filePath", "codeChunk", "startLine", "endLine"]
		const hasValidKeys = validKeys.every((key) => key in payload)
		return hasValidKeys
	}

	async search(
		queryVector: number[],
		directoryPrefix?: string,
		minScore?: number,
		maxResults?: number,
	): Promise<VectorStoreSearchResult[]> {
		const db = await this.getDb()
		const collectionId = this.cachedCollectionId
		if (collectionId == null) {
			return []
		}
		const actualMinScore = minScore ?? DEFAULT_SEARCH_MIN_SCORE
		const actualMaxResults = maxResults ?? DEFAULT_MAX_SEARCH_RESULTS

		try {
			// Calculate query norm once
			const queryNorm = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0))

			// Get total count first to determine parallel strategy
			const countSql = `
				SELECT COUNT(1)  as total
				FROM vectors v
				${directoryPrefix ? "JOIN files f ON v.file_id = f.id" : ""}
				WHERE v.collection_id = ?
				${directoryPrefix ? "AND f.file_path LIKE ?" : ""}
			`
			const countParams = [collectionId, ...(directoryPrefix ? [`${directoryPrefix}%`] : [])]
			const countResult = await db.prepare(countSql).get(...countParams)
			const totalCount = Number(countResult?.total || 0)

			if (totalCount === 0) {
				return []
			}

			const cpuCores = os.cpus().length
			const maxParallelism = Math.min(8, Math.max(1, Math.ceil(cpuCores / 2)))
			const batchSize = this.SEARCH_BATCH_SIZE
			const totalBatches = Math.ceil(totalCount / batchSize)
			const actualParallelism = Math.min(maxParallelism, totalBatches)

			// Parallel batch processing with dynamic task scheduling
			const topResults: VectorStoreSearchResult[] = []
			let currentBatchIndex = 0
			const activeTasks = new Set<Promise<VectorStoreSearchResult[]>>()

			// Process batches function
			const processBatch = async (batchIndex: number): Promise<VectorStoreSearchResult[]> => {
				const offset = batchIndex * batchSize
				const candidateSql = `
					SELECT v.id, v.vector, v.norm
					FROM vectors v
					${directoryPrefix ? "JOIN files f ON v.file_id = f.id" : ""}
					WHERE v.collection_id = ?
					${directoryPrefix ? "AND f.file_path LIKE ?" : ""}
					LIMIT ? OFFSET ?
				`
				const candidateParams = [
					collectionId,
					...(directoryPrefix ? [`${directoryPrefix}%`] : []),
					batchSize,
					offset,
				]

				const candidateBatch = await db.prepare(candidateSql).all(...candidateParams)
				const batchResult = [] as VectorStoreSearchResult[]

				for (const r of candidateBatch) {
					// Type safety checks
					if (!r.vector || !r.norm || !r.id) {
						continue
					}

					const vectorBuffer = r.vector as Buffer
					const norm = Number(r.norm)
					const id = String(r.id)

					const float32Array = new Float32Array(
						vectorBuffer.buffer,
						vectorBuffer.byteOffset,
						vectorBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
					)

					let dot = 0
					for (let j = 0; j < queryVector.length; j++) {
						dot += queryVector[j] * float32Array[j]
					}
					const score = dot / (queryNorm * norm || 1)

					if (score >= actualMinScore) {
						batchResult.push({ id, score, payload: null })
					}
				}
				return batchResult
			}
			// Start initial parallel tasks
			for (let i = 0; currentBatchIndex < totalBatches; i++) {
				const task = processBatch(currentBatchIndex++)
				activeTasks.add(task)
				if (activeTasks.size > actualParallelism) {
					const r = await Promise.race(activeTasks)
					if (r?.length > 0) {
						topResults.push(...r)
					}
				}
			}
			const results = await Promise.all(activeTasks)
			for (const result of results) {
				if (result?.length > 0) {
					topResults.push(...result)
				}
			}

			if (topResults.length === 0) {
				return []
			}

			// Sort final results descending
			topResults.sort((a, b) => b.score - a.score)
			if (topResults.length > actualMaxResults) {
				topResults.splice(actualMaxResults)
			}

			const ids = topResults.map((r) => r.id)
			const placeholders = ids.map(() => "?").join(",")
			const payloadSql = `
					SELECT
						v.id,
						f.file_path as filePath,
						v.code_chunk as codeChunk,
						v.start_line as startLine,
						v.end_line as endLine
					FROM vectors v
					JOIN files f ON v.file_id = f.id
					WHERE v.id IN (${placeholders})
				`
			const payloads = await db.prepare(payloadSql).all(...ids)

			// Map payloads to results with proper type conversion
			const payloadMap = new Map(
				payloads.map((p) => [
					p.id,
					{
						filePath: String(p.filePath),
						codeChunk: String(p.codeChunk),
						startLine: Number(p.startLine),
						endLine: Number(p.endLine),
					},
				]),
			)
			return topResults.map((r) => {
				const payload = payloadMap.get(r.id)
				if (!payload) {
					throw new Error(`Missing payload for vector ${r.id}`)
				}
				return {
					id: String(r.id),
					score: r.score,
					payload,
				}
			})
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

		const db = await this.getDb()
		const collectionId = this.cachedCollectionId
		if (collectionId == null) {
			return
		}

		try {
			await db.exec("BEGIN TRANSACTION")

			const workspaceRoot = getWorkspacePath()
			const normalizedPaths = filePaths.map((fp) =>
				path.normalize(path.resolve(workspaceRoot, fp)).substring(workspaceRoot.length + 1),
			)

			const placeholders = normalizedPaths.map(() => "?").join(",")
			const fileRows = await db
				.prepare(`SELECT id FROM files WHERE collection_id = ? AND file_path IN (${placeholders})`)
				.all(collectionId, ...normalizedPaths)

			const fileIds = fileRows.map((row: any) => row.id)
			if (fileIds.length > 0) {
				const fileIdPlaceholders = fileIds.map(() => "?").join(",")
				await db
					.prepare(`DELETE FROM vectors WHERE collection_id = ? AND file_id IN (${fileIdPlaceholders})`)
					.run(collectionId, ...fileIds)
				await db.prepare(`DELETE FROM files WHERE id IN (${fileIdPlaceholders})`).run(...fileIds)
			}

			await db.exec("COMMIT")
		} catch (error) {
			await db.exec("ROLLBACK")
			console.error("Failed to delete points by file paths:", error)
			throw error
		}
	}

	async deleteCollection(): Promise<void> {
		await this.closeConnect()
		try {
			const fs = require("fs")
			if (fs.existsSync(this.dbPath)) {
				fs.rmSync(this.dbPath)
			}
		} catch (error) {
			this.clearCollection()
			throw error
		}
	}

	async clearCollection(): Promise<void> {
		const db = await this.getDb()
		try {
			const collectionId = this.cachedCollectionId
			if (collectionId != null) {
				await db.prepare("DELETE FROM vectors WHERE collection_id = ?").run(collectionId)
				await db.prepare("DELETE FROM files WHERE collection_id = ?").run(collectionId)
				await this.resizeCollection()
			}
		} catch (error) {
			console.error("Failed to clear collection:", error)
			throw error
		}
	}

	async collectionExists(): Promise<boolean> {
		const db = await this.getDb()
		const collection = await db.prepare("SELECT id FROM collections WHERE name = ?").get(this.collectionName)
		if (collection) {
			this.cachedCollectionId = collection.id != null ? Number(collection.id) : null
		}
		return !!collection
	}
	async resizeCollection(): Promise<void> {
		const db = await this.getDb()
		await db.exec(`VACUUM;`)
	}

	private async closeConnect(): Promise<void> {
		if (this.db) {
			this.db.close()
			this.db = null
		}
	}
}
