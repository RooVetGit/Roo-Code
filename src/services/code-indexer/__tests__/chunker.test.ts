// npx jest src/services/code-indexer/__tests__/chunker.test.ts

import path from "path"

import { getChunks } from "../chunker"

describe("chunker", () => {
	describe("getChunks", () => {
		it("should chunk TypeScript code correctly", async () => {
			const filepath = path.join(__dirname, "..", "__fixtures__", "test.ts")
			const chunks = await getChunks(filepath)

			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some(({ type }) => type === "class_declaration")).toBe(true)
			expect(chunks.some(({ type }) => type === "method_definition")).toBe(true)
			expect(chunks.some(({ type }) => type === "function_declaration")).toBe(true)
			expect(chunks.some(({ type }) => type === "arrow_function")).toBe(true)

			chunks.forEach((chunk) => {
				expect(chunk.chunk).toBeTruthy()
				expect(chunk.start).toBeDefined()
				expect(chunk.end).toBeDefined()
				expect(chunk.filepath).toBe(filepath)
			})
		})

		it("should chunk Python code correctly", async () => {
			const filepath = path.join(__dirname, "..", "__fixtures__", "test.py")
			const chunks = await getChunks(filepath)

			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks.some(({ type }) => type === "class_definition")).toBe(true)
			expect(chunks.some(({ type }) => type === "function_definition")).toBe(true)

			chunks.forEach((chunk) => {
				expect(chunk.chunk).toBeTruthy()
				expect(chunk.start).toBeDefined()
				expect(chunk.end).toBeDefined()
				expect(chunk.filepath).toBe(filepath)
			})
		})
	})
})
