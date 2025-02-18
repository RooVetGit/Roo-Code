// npx jest src/services/code-indexer/__tests__/code-search.test.ts

import path from "path"

import nock from "nock"

import { CodeSearch } from "../code-search"

describe("CodeSearch", () => {
	let savedKey: string | undefined

	beforeAll(() => {
		savedKey = process.env.OPENAI_API_KEY
		process.env.OPENAI_API_KEY = "fake"

		nock.back.fixtures = path.join(__dirname, "..", "__fixtures__")
		// You can re-record the fixtures by setting the mode to "record"
		// and running the tests with a real `OPENAI_API_KEY` in the environment.
		nock.back.setMode("lockdown")
	})

	afterAll(() => {
		process.env.OPENAI_API_KEY = savedKey
		nock.back.setMode("wild")
	})

	describe("indexFile", () => {
		it("should index a file", async () => {
			const { nockDone } = await nock.back("indexFile.json")

			const filepath = path.join(__dirname, "..", "__fixtures__", "test.py")
			const codeSearch = await CodeSearch.getInstance()
			const chunks = await codeSearch.indexFile(filepath)

			expect(chunks.length).toBeGreaterThan(0)
			const persistedChunk = await codeSearch.find(chunks[0].uuid)
			expect(persistedChunk).toBeDefined()
			expect(persistedChunk!.uuid).toBe(chunks[0].uuid)

			nockDone()
		})
	})

	describe("search", () => {
		it("should find matches in indexed files", async () => {
			const { nockDone } = await nock.back("search.json")

			const filepath = path.join(__dirname, "..", "__fixtures__", "test.ts")
			const codeSearch = await CodeSearch.getInstance()
			await codeSearch.indexFile(filepath)

			const results = await codeSearch.search({
				query: "testFunction",
				distanceThreshold: 0.3,
			})

			expect(results[0]).toMatchObject({
				chunk: expect.stringContaining("testFunction()"),
				start: 73,
				end: 115,
				type: "function_declaration",
				filepath: expect.stringContaining("__fixtures__/test.ts"),
			})

			nockDone()
		})
	})
})
