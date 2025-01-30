import path from "path"
import os from "os"

import * as lancedb from "@lancedb/lancedb"
import "@lancedb/lancedb/embedding/openai"
import { LanceSchema, getRegistry } from "@lancedb/lancedb/embedding"
import { Utf8 } from "apache-arrow"

export enum Tables {
	Words = "words",
}

const databaseDir = path.join(os.tmpdir(), "lancedb")

let db: lancedb.Connection | undefined = undefined

export const initDb = async () => {
	console.log("initDb", databaseDir)
	const db = await lancedb.connect(databaseDir)

	const fnCreator = getRegistry().get("openai")

	if (!fnCreator) {
		throw new Error("Embedding function not found.")
	}

	const embeddingFn = fnCreator.create({
		model: "text-embedding-ada-002",
		apiKey: process.env.OPENAI_API_KEY,
	})

	try {
		await getTable(Tables.Words)
	} catch (e) {
		const table = await db.createEmptyTable(
			Tables.Words,
			LanceSchema({
				text: embeddingFn.sourceField(new Utf8()),
				vector: embeddingFn.vectorField(),
			}),
			{ mode: "overwrite" },
		)

		await table.add([{ text: "hello world" }, { text: "goodbye world" }])
	}

	return db
}

export const getDb = async () => {
	if (!db) {
		db = await lancedb.connect(databaseDir)
	}

	return db
}

export const getTable = async (name: Tables) => (await getDb()).openTable(name)
