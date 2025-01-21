import { InMemoryVectorStore } from "../in-memory"
import { Vector, VectorWithMetadata } from "../types"
import { CodeDefinition } from "../../types"

describe("InMemoryVectorStore", () => {
	let store: InMemoryVectorStore

	beforeEach(() => {
		store = new InMemoryVectorStore()
	})

	const createVector = (values: number[]): Vector => ({
		values,
		dimension: values.length,
	})

	const createMetadata = (name: string): CodeDefinition => ({
		type: "function",
		name,
		filePath: "test.ts",
		content: `function ${name}() {}`,
		startLine: 1,
		endLine: 1,
	})

	describe("add", () => {
		it("should add a vector successfully", async () => {
			const vector = createVector([1, 0, 0])
			const metadata = createMetadata("test")

			await store.add(vector, metadata)
			expect(store.size()).toBe(1)
		})

		it("should validate vector dimensions", async () => {
			const vector = { values: [1, 0], dimension: 3 }
			const metadata = createMetadata("test")

			await expect(store.add(vector, metadata)).rejects.toThrow("Vector dimension mismatch")
		})

		it("should validate vector dimensions match existing vectors", async () => {
			await store.add(createVector([1, 0, 0]), createMetadata("test1"))
			const vector2 = createVector([1, 0])

			await expect(store.add(vector2, createMetadata("test2"))).rejects.toThrow(
				"Vector dimension mismatch with store",
			)
		})
	})

	describe("addBatch", () => {
		it("should add multiple vectors successfully", async () => {
			const items: VectorWithMetadata[] = [
				{ vector: createVector([1, 0, 0]), metadata: createMetadata("test1") },
				{ vector: createVector([0, 1, 0]), metadata: createMetadata("test2") },
			]

			await store.addBatch(items)
			expect(store.size()).toBe(2)
		})
	})

	describe("search", () => {
		beforeEach(async () => {
			await store.addBatch([
				{ vector: createVector([1, 0, 0]), metadata: createMetadata("x") },
				{ vector: createVector([0, 1, 0]), metadata: createMetadata("y") },
				{ vector: createVector([0, 0, 1]), metadata: createMetadata("z") },
			])
		})

		it("should find exact matches", async () => {
			const results = await store.search(createVector([1, 0, 0]), 1)
			expect(results).toHaveLength(1)
			expect(results[0].metadata.name).toBe("x")
			expect(results[0].score).toBeCloseTo(1.0)
		})

		it("should find similar vectors", async () => {
			const results = await store.search(createVector([0.9, 0.1, 0]), 2)
			expect(results).toHaveLength(2)
			expect(results[0].metadata.name).toBe("x")
			expect(results[1].metadata.name).toBe("y")
		})

		it("should handle empty store", async () => {
			store.clear()
			const results = await store.search(createVector([1, 0, 0]), 1)
			expect(results).toHaveLength(0)
		})

		it("should respect k parameter", async () => {
			const results = await store.search(createVector([1, 0, 0]), 2)
			expect(results).toHaveLength(2)
		})
	})

	describe("clear", () => {
		it("should remove all vectors", async () => {
			await store.add(createVector([1, 0, 0]), createMetadata("test"))
			expect(store.size()).toBe(1)

			store.clear()
			expect(store.size()).toBe(0)
		})
	})
})
