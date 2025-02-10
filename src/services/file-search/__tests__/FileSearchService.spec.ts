// npx vitest src/services/file-search/__tests__/FileSearchService.spec.ts

import path from "path"
import { describe, expect, test, beforeAll } from "vitest"

import { FileSearchService } from "../FileSearchService"

describe("FileSearchService", () => {
	const service = new FileSearchService(path.join(process.cwd(), "node_modules"))

	beforeAll(async () => {
		await service.indexFiles({ gitignore: false, ignore: undefined })
	})

	test("it indexes files", async () => {
		expect(service.count).toBeGreaterThan(25_000)
	})

	test("it searches for files", async () => {
		const results = await service.search("zod")
		console.log(results.map((result) => [result.target, result.score]))
		expect(results.length).toBe(25)
		expect(results.every((result) => result.target.includes("zod"))).toBe(true)
		expect(results.every((result) => result.score > 0.5)).toBe(true)

		const results2 = await service.search("zod/index.d.ts")
		console.log(results2.map((result) => [result.target, result.score]))
		expect(results2.length).toBeGreaterThan(0)
		expect(results2.some((result) => result.target.includes("zod/index.d.ts"))).toBe(true)
	})
})
