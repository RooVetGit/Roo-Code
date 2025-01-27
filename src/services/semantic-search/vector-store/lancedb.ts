import { Vector, VectorStore, VectorWithMetadata } from "./types"
import * as lancedb from "@lancedb/lancedb"
import { Connection, Table } from "@lancedb/lancedb"
import * as arrow from "apache-arrow"
import * as path from "path"
import { CodeDefinition } from "../types"
import { SearchResult, CodeSearchResult } from "../types"

export class LanceDBVectorStore implements VectorStore {
	private connection!: Connection
	private table!: Table
	private tablePrefix = "vectors"
	private dbPath: string
	private workspaceId: string
	private readonly VECTOR_DIMENSION = 384
	private indexCreated = false

	private readonly schema = new arrow.Schema([
		new arrow.Field("id", new arrow.Utf8()),
		new arrow.Field(
			"vector",
			new arrow.FixedSizeList(this.VECTOR_DIMENSION, new arrow.Field("value", new arrow.Float32())),
		),
		new arrow.Field("metadata", new arrow.Utf8()),
		new arrow.Field("contentHash", new arrow.Utf8()),
	])

	constructor(storageDir: string, workspaceId: string) {
		this.dbPath = path.join(storageDir, "lancedb")
		//Only alphanumeric characters, underscored, hyphens and periods are allowed
		this.workspaceId = workspaceId.replace(/[^a-zA-Z0-9._-]/g, "_")
	}

	async initialize(): Promise<void> {
		this.connection = await lancedb.connect(this.dbPath)
		const tableName = `${this.tablePrefix}-${this.workspaceId}`
		console.log(`Initializing LanceDB connection. Path: ${this.dbPath}, Table: ${tableName}`)

		try {
			this.table = await this.connection.openTable(tableName)
			console.log(`Opened existing table: ${tableName}`)

			// Add explicit count with filter to verify data
			const rowCount = await this.table.countRows() // force exact count
			console.log(`Direct table count: ${rowCount} records`)

			await this.updateSize()
			console.log(`Initial table size: ${this._size} records`)
		} catch (error) {
			console.log(
				`Creating new table: ${tableName} (${error instanceof Error ? error.message : "Unknown error"})`,
			)
			this.table = await this.connection.createEmptyTable(tableName, this.schema)
			await this.updateSize()
			console.log(`Created new empty table. Initial size: ${this._size}`)
		}
	}

	async add(vector: Vector, metadata: CodeDefinition): Promise<void> {
		await this.table.add([
			{
				vector: vector.values,
				id: this.generateId(metadata),
				metadata: this.serializeMetadata(metadata),
				contentHash: metadata.contentHash,
			},
		])
		await this.updateSize()
		await this.createIndexIfNeeded()
	}

	async addBatch(vectors: VectorWithMetadata[]): Promise<void> {
		console.log(`Adding batch of ${vectors.length} vectors to store`)
		const records = vectors.map(({ vector, metadata }) => ({
			vector: vector.values,
			id: this.generateId(metadata),
			metadata: this.serializeMetadata(metadata),
			contentHash: metadata.contentHash,
		}))

		console.log(
			"Sample record IDs:",
			records.slice(0, 3).map((r) => r.id),
		)

		await this.table.add(records)

		await this.updateSize()
		console.log(`Batch added. New store size: ${this._size} records`)

		// Verify data persistence by doing a count
		const verifyCount = await this.table.countRows()
		console.log(`Verification count after add: ${verifyCount} records`)

		await this.createIndexIfNeeded()
	}

	async search(queryVector: Vector, k: number): Promise<SearchResult[]> {
		const reranker = await lancedb.rerankers.RRFReranker.create(k)
		const results = await this.table.vectorSearch(queryVector.values).limit(k).rerank(reranker).toArray()

		console.log(JSON.stringify(results, null, 2))

		return results.map((row: any) => {
			const metadata = this.parseMetadata(row.metadata)
			const result: CodeSearchResult = {
				type: "code",
				score: row.relevance || 0,
				filePath: metadata.filePath,
				content: metadata.content,
				startLine: metadata.startLine,
				endLine: metadata.endLine,
				name: metadata.name,
				codeType: metadata.type,
				vector: {
					values: row.vector,
					dimension: this.VECTOR_DIMENSION,
				},
				metadata,
			}
			return result
		})
	}

	async load(): Promise<void> {
		// No-op for LanceDB as data is persisted automatically
	}

	clear(): void {
		this.connection.dropTable(`${this.tablePrefix}-${this.workspaceId}`)
	}

	private _size = 0

	size(): number {
		return this._size
	}

	private async updateSize(): Promise<void> {
		if (!this.table) {
			this._size = 0
			return
		}
		const prevSize = this._size
		this._size = await this.table.countRows()
		console.log(`Size updated: ${prevSize} -> ${this._size} records`)

		// Additional verification
		if (this._size === 0 && prevSize > 0) {
			console.warn("WARNING: Size dropped to 0 from previous size of", prevSize)
			// Try to verify if table actually exists and has data
			try {
				const verifyCount = await this.table.countRows()
				console.log(`Verification count: ${verifyCount}`)
			} catch (error) {
				console.error("Error verifying count:", error)
			}
		}
	}

	private generateId(metadata: CodeDefinition): string {
		const contentHash = this.createContentHash(metadata.content)
		return `${metadata.filePath}-${contentHash}`
	}

	private createContentHash(content: string): string {
		// Using a more robust hash function to minimize collisions
		let hash = 5381
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i)
			hash = (hash << 5) + hash + char // hash * 33 + char
		}
		return hash.toString(16)
	}

	private serializeMetadata(metadata: CodeDefinition): string {
		return JSON.stringify(metadata)
	}

	private parseMetadata(metadataStr: string): CodeDefinition {
		return JSON.parse(metadataStr)
	}

	private async createIndexIfNeeded(): Promise<void> {
		if (!this.indexCreated && this._size >= 256) {
			await this.table.createIndex("vector", {
				config: lancedb.Index.ivfPq({
					numPartitions: Math.min(256, Math.floor(this._size / 50)),
					numSubVectors: Math.floor(this.VECTOR_DIMENSION / 4),
					distanceType: "cosine",
				}),
			})
			this.indexCreated = true
		}
	}

	async deleteByFilePath(filePath: string): Promise<void> {
		// Escape special characters in file path for LIKE query
		const escapedPath = filePath.replace(/[%_]/g, "\\$&")

		// Delete all records where ID starts with the file path followed by hyphen
		await this.table.delete(`id LIKE '${escapedPath}-%'`)
		await this.updateSize()
		console.log(`Deleted all segments for file: ${filePath}`)
	}

	// Add helper method to check if file has segments
	async hasFileSegments(filePath: string): Promise<{ exists: boolean; hash?: string }> {
		const results = await this.table
			.query()
			.where(`metadata LIKE '%${filePath}%'`)
			.limit(1)
			.select(["contentHash"])
			.toArray()

		return {
			exists: results.length > 0,
			hash: results.length > 0 ? results[0].contentHash : undefined,
		}
	}

	async getFileHash(filePath: string): Promise<string | undefined> {
		const results = await this.table
			.query()
			.where(`metadata LIKE '%${filePath}%'`)
			.limit(1)
			.select(["contentHash"])
			.toArray()

		return results.length > 0 ? results[0].contentHash : undefined
	}
}