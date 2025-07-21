import { createHash } from "crypto"
import * as path from "path"
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

            CREATE TABLE IF NOT EXISTS vectors (
                id TEXT PRIMARY KEY,
                collection_id INTEGER NOT NULL,
                vector BLOB NOT NULL,
				norm REAL NOT NULL,
                file_path TEXT NOT NULL,
                code_chunk TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_vectors_collection ON vectors(collection_id);
            CREATE INDEX IF NOT EXISTS idx_vectors_file_path ON vectors(file_path);
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
				return true
			} else if (collection.vector_size !== this.vectorSize) {
				// Recreate collection with correct vector size
				await db.prepare("DELETE FROM vectors WHERE collection_id = ?").run(collection.id)
				await db
					.prepare("UPDATE collections SET vector_size = ? WHERE id = ?")
					.run(this.vectorSize, collection.id)
				return true
			}

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
		const collection = await db.prepare("SELECT id FROM collections WHERE name = ?").get(this.collectionName)

		if (!collection) {
			throw new Error(`Collection ${this.collectionName} not found`)
		}

		try {
			await db.exec("BEGIN TRANSACTION")

			for (const point of points) {
				if (!this.isPayloadValid(point.payload)) {
					continue
				}

				// Convert vector to binary format
				const vectorBuffer = Buffer.from(Float32Array.from(point.vector).buffer)
				const norm = Math.sqrt(point.vector.reduce((sum, val) => sum + val * val, 0))

				await db
					.prepare(
						`INSERT OR REPLACE INTO vectors
				                (id, collection_id, vector, norm, file_path, code_chunk, start_line, end_line)
				                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.run(
						point.id,
						collection.id,
						vectorBuffer,
						norm,
						point.payload.filePath,
						point.payload.codeChunk,
						point.payload.startLine,
						point.payload.endLine,
					)
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
		const collection = await db.prepare("SELECT id FROM collections WHERE name = ?").get(this.collectionName)

		if (!collection) {
			return []
		}
		const actualMinScore = minScore ?? DEFAULT_SEARCH_MIN_SCORE
		const actualMaxResults = maxResults ?? DEFAULT_MAX_SEARCH_RESULTS
		try {
			// Calculate query norm once
			const queryNorm = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0))

			// Batch processing to reduce memory footprint
			const batchSize = 10000
			let offset = 0
			let candidateBatch: any[]
			let topResults: VectorStoreSearchResult[] = []

			do {
				const candidateSql = `
					SELECT id, vector, norm
					FROM vectors
					WHERE collection_id = ?
					${directoryPrefix ? "AND file_path LIKE ?" : ""}
					LIMIT ? OFFSET ?
				`
				const candidateParams = [
					collection.id,
					...(directoryPrefix ? [`${directoryPrefix}%`] : []),
					batchSize,
					offset,
				]
				candidateBatch = await db.prepare(candidateSql).all(...candidateParams)

				for (const r of candidateBatch) {
					const float32Array = new Float32Array(
						r.vector.buffer,
						r.vector.byteOffset,
						r.vector.byteLength / Float32Array.BYTES_PER_ELEMENT,
					)

					let dot = 0
					for (let j = 0; j < queryVector.length; j++) {
						dot += queryVector[j] * float32Array[j]
					}
					const score = dot / (queryNorm * r.norm || 1)

					if (score >= actualMinScore) {
						const result = { id: r.id, score, payload: null }
						topResults.push(result)
					}
				}

				offset += batchSize
			} while (candidateBatch.length === batchSize)

			if (topResults.length === 0) {
				return []
			}

			// Sort final results descending
			topResults.sort((a, b) => b.score - a.score)
			if (topResults.length > actualMaxResults) {
				topResults = topResults.slice(0, actualMaxResults)
			}

			const ids = topResults.map((r) => r.id)
			const placeholders = ids.map(() => "?").join(",")
			const payloadSql = `
					SELECT
						id,
						file_path as filePath,
						code_chunk as codeChunk,
						start_line as startLine,
						end_line as endLine
					FROM vectors
					WHERE id IN (${placeholders})
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
		const collection = await db.prepare("SELECT id FROM collections WHERE name = ?").get(this.collectionName)

		if (!collection) {
			return
		}

		try {
			await db.exec("BEGIN TRANSACTION")

			for (const filePath of filePaths) {
				const workspaceRoot = getWorkspacePath()
				const normalizedPath = path
					.normalize(path.resolve(workspaceRoot, filePath))
					.substring(workspaceRoot.length + 1)

				await db
					.prepare("DELETE FROM vectors WHERE collection_id = ? AND file_path = ?")
					.run(collection.id, normalizedPath)
			}

			await db.exec("COMMIT")
		} catch (error) {
			await db.exec("ROLLBACK")
			console.error("Failed to delete points by file paths:", error)
			throw error
		}
	}

	async deleteCollection(): Promise<void> {
		if (this.db) {
			this.db.close()
			this.db = null
		}
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
			const collection = await db.prepare("SELECT id FROM collections WHERE name = ?").get(this.collectionName)

			if (collection) {
				await db.prepare("DELETE FROM vectors WHERE collection_id = ?").run(collection.id)
			}
		} catch (error) {
			console.error("Failed to clear collection:", error)
			throw error
		}
	}

	async collectionExists(): Promise<boolean> {
		const db = await this.getDb()
		const collection = await db.prepare("SELECT id FROM collections WHERE name = ?").get(this.collectionName)
		return !!collection
	}
}
