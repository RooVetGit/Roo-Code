import { Vector, VectorSearchResult, VectorStore, VectorWithMetadata } from "./types"
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

		try {
			this.table = await this.connection.openTable(tableName)
			await this.updateSize()
		} catch (error) {
			this.table = await this.connection.createEmptyTable(tableName, this.schema)
			this._size = 0
			this.indexCreated = false
			await this.updateSize()
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
		const records = vectors.map(({ vector, metadata }) => ({
			vector: vector.values,
			id: this.generateId(metadata),
			metadata: this.serializeMetadata(metadata),
			contentHash: metadata.contentHash,
		}))

		await this.table.add(records)
		await this.updateSize()
		await this.createIndexIfNeeded()
	}

	async search(queryVector: Vector, k: number): Promise<VectorSearchResult[]> {
		const reranker = await lancedb.rerankers.RRFReranker.create(k)
		const results = await this.table.vectorSearch(queryVector.values).limit(k).rerank(reranker).toArray()

		return results.map((r) => ({
			vector: {
				values: r.vector,
				dimension: r.vector.length,
			},
			score: r.relevance || 0,
			metadata: this.parseMetadata(r.metadata) as CodeDefinition,
		}))
	}

	async load(): Promise<void> {
		// No-op for LanceDB as data is persisted automatically
	}

	async clear(): Promise<void> {
		const tableName = `${this.tablePrefix}-${this.workspaceId}`
		try {
			await this.connection.dropTable(tableName)
			console.log(`Successfully dropped table: ${tableName}`)
		} catch (error) {
			if (error instanceof Error && error.message.includes("Table not found")) {
				console.log(`Table ${tableName} already removed`)
			} else {
				throw error
			}
		}

		// Reset internal state
		this.table = null as unknown as Table
		this._size = 0
		this.indexCreated = false
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
		// Add null check for table
		if (!this.table) {
			return { exists: false, hash: undefined }
		}

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
