import { createHash } from "crypto"
import * as path from "path"
import { Connection, Table } from "@lancedb/lancedb"
import { IVectorStore } from "../interfaces/vector-store"
import { Payload, VectorStoreSearchResult } from "../interfaces"
import { DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_MIN_SCORE } from "../constants"
import { t } from "../../../i18n"
import { LanceDBManager } from "../../lancedb-manager"
import * as vscode from "vscode"
const fs = require("fs")
/**
 * Local implementation of the vector store using LanceDB
 */
export class LocalVectorStore implements IVectorStore {
	private readonly vectorSize: number
	private readonly dbPath: string
	private readonly workspacePath: string
	private db: Connection | null = null
	private table: Table | null = null
	private readonly vectorTableName = "vector"
	private readonly metadataTableName = "metadata"
	private lancedbManager: LanceDBManager
	private lancedbModule: any = null

	constructor(
		workspacePath: string,
		vectorSize: number,
		dbDirectory: string,
		extensionContext: vscode.ExtensionContext,
	) {
		this.vectorSize = vectorSize
		this.workspacePath = workspacePath
		const basename = path.basename(workspacePath)
		// Generate database directory name from workspace path
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		const dbName = `${basename}-${hash.substring(0, 16)}`
		// Set up database path
		this.dbPath = path.join(dbDirectory, dbName)
		this.lancedbManager = new LanceDBManager(extensionContext)
	}

	/**
	 * 动态加载 LanceDB 模块
	 */
	private async loadLanceDBModule(): Promise<any> {
		if (this.lancedbModule) {
			return this.lancedbModule
		}

		// 确保 LanceDB 依赖可用
		await this.lancedbManager.ensureLanceDBAvailable()

		const nodeModulesPath = this.lancedbManager.getNodeModulesPath()

		// Add the custom node_modules path to the module search paths
		// This should be done before requiring the module
		if (!module.paths.includes(nodeModulesPath)) {
			module.paths.unshift(nodeModulesPath)
		}

		try {
			// 动态导入 LanceDB
			this.lancedbModule = require("@lancedb/lancedb")
			return this.lancedbModule
		} catch (error) {
			console.error("Failed to load LanceDB module:", error)
			throw new Error(t("embeddings:vectorStore.lancedbLoadFailed", { errorMessage: error.message }))
		}
	}

	private async getDb(): Promise<any> {
		if (this.db) {
			return this.db
		}

		// 加载 LanceDB 模块
		const lancedb = await this.loadLanceDBModule()

		// Create parent directory if needed
		if (!fs.existsSync(this.dbPath)) {
			fs.mkdirSync(this.dbPath, { recursive: true })
		}

		this.db = await lancedb.connect(this.dbPath)
		return this.db
	}

	private async getTable(): Promise<Table> {
		if (this.table) {
			return this.table
		}

		const db = await this.getDb()

		try {
			// Try to open existing table
			const table = await db.openTable(this.vectorTableName)
			this.table = table
			return table
		} catch (error) {
			// Table doesn't exist, will be created in initialize()
			// Return null for now
			throw new Error(`Table ${this.vectorTableName} does not exist`)
		}
	}

	async initialize(): Promise<boolean> {
		try {
			await this.closeConnect()
			const db = await this.getDb()

			// Check if table exists
			const tableNames = await db.tableNames()
			const tableExists = tableNames.includes(this.vectorTableName)
			const metadataTableExists = tableNames.includes(this.metadataTableName)

			if (!tableExists) {
				// Create new table with sample data to define schema
				const sampleData = [
					{
						id: "sample",
						vector: new Array(this.vectorSize).fill(0),
						filePath: "sample",
						codeChunk: "sample",
						startLine: 0,
						endLine: 0,
					},
				]

				this.table = await db.createTable(this.vectorTableName, sampleData)

				// Delete the sample data
				if (this.table) {
					await this.table.delete("id = 'sample'")
				}

				// Create metadata table to store vector size
				const metadataData = [
					{
						key: "vector_size",
						value: this.vectorSize,
					},
				]
				await db.createTable(this.metadataTableName, metadataData)

				return true
			}

			this.table = await db.openTable(this.vectorTableName)

			// Check vector size from metadata table
			let needsRecreation = false
			if (metadataTableExists) {
				try {
					const metadataTable = await db.openTable(this.metadataTableName)
					const metadataResults = await metadataTable.query().where("key = 'vector_size'").toArray()

					if (metadataResults.length > 0) {
						const storedVectorSize = metadataResults[0].value
						if (storedVectorSize !== this.vectorSize) {
							needsRecreation = true
						}
					} else {
						// No vector size metadata found, assume recreation needed
						needsRecreation = true
					}
				} catch (error) {
					console.warn("Failed to read metadata table, assuming recreation needed:", error)
					needsRecreation = true
				}
			} else {
				// No metadata table exists, assume recreation needed
				needsRecreation = true
			}

			if (needsRecreation) {
				// Vector size mismatch or missing metadata, recreate table
				await db.dropTable(this.vectorTableName)
				if (metadataTableExists) {
					await db.dropTable(this.metadataTableName)
				}

				const sampleData = [
					{
						id: "sample",
						vector: new Array(this.vectorSize).fill(0),
						filePath: "sample",
						codeChunk: "sample",
						startLine: 0,
						endLine: 0,
					},
				]

				this.table = await db.createTable(this.vectorTableName, sampleData)
				if (this.table) {
					await this.table.delete("id = 'sample'")
				}

				// Create metadata table with current vector size
				const metadataData = [
					{
						key: "vector_size",
						value: this.vectorSize,
					},
				]
				await db.createTable(this.metadataTableName, metadataData)

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
		if (points.length === 0) {
			return
		}

		const table = await this.getTable()
		const valids = points.filter((point) => this.isPayloadValid(point.payload))

		if (valids.length === 0) {
			return
		}

		try {
			// Convert points to LanceDB format
			const lanceData = valids.map((point) => ({
				id: point.id,
				vector: point.vector,
				filePath: point.payload.filePath,
				codeChunk: point.payload.codeChunk,
				startLine: point.payload.startLine,
				endLine: point.payload.endLine,
			}))

			// Delete existing points with same IDs first
			const existingIds = lanceData.map((d) => d.id)
			if (existingIds.length > 0) {
				const idFilter = existingIds.map((id) => `id = '${id}'`).join(" OR ")
				await table.delete(idFilter)
			}

			// Insert new data
			await table.add(lanceData)
		} catch (error) {
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
		try {
			const table = await this.getTable()
			const actualMinScore = minScore ?? DEFAULT_SEARCH_MIN_SCORE
			const actualMaxResults = maxResults ?? DEFAULT_MAX_SEARCH_RESULTS

			// Build filter condition
			let filter = ""
			if (directoryPrefix) {
				// Use backticks for column name and escape single quotes in directoryPrefix
				filter = `\`filePath\` LIKE '${directoryPrefix}%'`
			}
			// Perform vector search
			let searchQuery = table.vectorSearch(queryVector)
			if (filter !== "") {
				searchQuery = searchQuery.where(filter)
			}
			searchQuery = searchQuery.limit(actualMaxResults).refineFactor(3).distanceRange(actualMinScore)

			const list = await searchQuery.toArray()
			const results = list
				.filter((result: any) => result._distance >= actualMinScore)
				.sort((a: any, b: any) => b._distance - a._distance)
				.slice(0, actualMaxResults)
				.map((result: any) => ({
					id: result.id,
					score: result._distance,
					payload: {
						filePath: result.filePath,
						codeChunk: result.codeChunk,
						startLine: result.startLine,
						endLine: result.endLine,
					} as Payload,
				}))
			// Filter by minimum score and convert to expected format
			return results
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
			const table = await this.getTable()
			const workspaceRoot = this.workspacePath
			const normalizedPaths = filePaths.map((fp) =>
				path.normalize(path.resolve(workspaceRoot, fp)).substring(workspaceRoot.length + 1),
			)

			// Create filter condition for multiple file paths
			const filterCondition = normalizedPaths
				.map((fp) => {
					// Escape single quotes in file path
					return `\`filePath\` = '${fp}'`
				})
				.join(" OR ")
			await table.delete(filterCondition)
		} catch (error) {
			console.error("Failed to delete points by file paths:", error)
			throw error
		}
	}

	async deleteCollection(): Promise<void> {
		await this.closeConnect()
		try {
			if (fs.existsSync(this.dbPath)) {
				fs.rmSync(this.dbPath, { recursive: true, force: true })
			}
		} catch (error) {
			// If file deletion fails, try to clear the collection and metadata table
			try {
				const db = await this.getDb()
				const tableNames = await db.tableNames()

				if (tableNames.includes(this.vectorTableName)) {
					await db.dropTable(this.vectorTableName)
				}

				if (tableNames.includes(this.metadataTableName)) {
					await db.dropTable(this.metadataTableName)
				}
			} catch (clearError) {
				console.error("Failed to clear collection and metadata:", clearError)
			}
			throw error
		}
	}

	async clearCollection(): Promise<void> {
		try {
			const table = await this.getTable()
			// Delete all records from the table
			await table.delete("true") // Delete all records

			// Also clear metadata table
			try {
				const db = await this.getDb()
				const tableNames = await db.tableNames()

				if (tableNames.includes(this.metadataTableName)) {
					const metadataTable = await db.openTable(this.metadataTableName)
					await metadataTable.delete("true")
				}
			} catch (metadataError) {
				console.warn("Failed to clear metadata table:", metadataError)
			}
		} catch (error) {
			console.error("Failed to clear collection:", error)
			throw error
		}
	}

	async collectionExists(): Promise<boolean> {
		try {
			const db = await this.getDb()
			const tableNames = await db.tableNames()
			return tableNames.includes(this.vectorTableName)
		} catch (error) {
			return false
		}
	}

	private async closeConnect(): Promise<void> {
		if (this.table) {
			this.table = null
		}
		if (this.db) {
			await this.db.close()
			this.db = null
		}
	}
}
