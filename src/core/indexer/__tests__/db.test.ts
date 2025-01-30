// OPENAI_API_KEY=... npx jest src/core/indexer/__tests__/db.test.ts

import { Tables, getTable } from "../db"

describe("db", () => {
	describe("search", () => {
		it("should return the closest match for a query", async () => {
			const table = await getTable(Tables.Words)
			const results = await table.search("greetings").limit(1).toArray()
			expect(results.length).toBe(1)
			expect(results[0].text).toBe("hello world")
		})
	})
})
