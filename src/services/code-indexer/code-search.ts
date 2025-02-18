import { connect, Connection, Table } from "@lancedb/lancedb"
import "@lancedb/lancedb/embedding/openai"
import { LanceSchema, getRegistry } from "@lancedb/lancedb/embedding"
import { Utf8, Int32 } from "apache-arrow"
import { v4 as uuid } from "uuid"

import { CodeChunk, getChunks } from "./chunker"

export type IndexedCodeChunk = CodeChunk & {
	uuid: string
}

export type CodeSearchResult = IndexedCodeChunk & {
	vector: Float32Array
	_distance: number
}

export class CodeSearch {
	public readonly dbPath: string = "./lancedb"
	public readonly tableName: string = "code_chunks"

	private connection?: Connection

	private _table?: Table

	public get table() {
		if (!this._table) {
			throw new Error("Table not initialized.")
		}

		return this._table
	}

	public async initialize() {
		this.connection = await connect(this.dbPath)

		const fnCreator = getRegistry().get("openai")

		if (!fnCreator) {
			throw new Error("OpenAI embedding function not found.")
		}

		const embeddingFn = fnCreator.create({
			model: "text-embedding-ada-002",
		})

		try {
			this._table = await this.connection.openTable(this.tableName)
		} catch {
			const schema = LanceSchema({
				uuid: new Utf8(),
				chunk: embeddingFn.sourceField(new Utf8()),
				start: new Int32(),
				end: new Int32(),
				type: new Utf8(),
				filepath: new Utf8(),
				vector: embeddingFn.vectorField(),
			})

			this._table = await this.connection.createEmptyTable(this.tableName, schema, { mode: "overwrite" })

			this.table.createIndex("uuid")
		}
	}

	public async indexFile(filepath: string) {
		const chunks = await getChunks(filepath)

		const records = chunks.map((chunk) => ({
			uuid: uuid(),
			...chunk,
		}))

		await this.table.add(records)
		return records
	}

	public async find(uuid: string): Promise<IndexedCodeChunk | undefined> {
		const result = await this.table.query().where(`uuid == '${uuid}'`).limit(1).toArray()

		return result[0]
	}

	public async search({
		query,
		limit = 5,
		distanceThreshold,
	}: {
		query: string
		limit?: number
		distanceThreshold?: number
	}): Promise<CodeSearchResult[]> {
		const results = await this.table.search(query).limit(limit).toArray()

		return distanceThreshold ? results.filter(({ _distance }) => _distance <= distanceThreshold) : results
	}

	public async clear() {
		if (this.connection) {
			await this.connection.dropTable(this.tableName)
			await this.initialize()
		}
	}

	private static instance: CodeSearch

	public static async getInstance() {
		if (!this.instance) {
			this.instance = new CodeSearch()
			await this.instance.initialize()
		}

		return this.instance
	}
}
