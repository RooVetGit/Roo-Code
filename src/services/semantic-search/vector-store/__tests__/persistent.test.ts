import { PersistentVectorStore } from "../persistent"
import { Vector, VectorWithMetadata } from "../types"
import { CodeDefinition } from "../../types"
import * as vscode from "vscode"

describe("PersistentVectorStore", () => {
	let store: PersistentVectorStore
	let getMock: jest.Mock
	let updateMock: jest.Mock
	let mockStorage: { get: jest.Mock; update: jest.Mock }

	beforeEach(async () => {
		getMock = jest.fn().mockReturnValue([])
		updateMock = jest.fn().mockResolvedValue(undefined)
		mockStorage = {
			get: getMock,
			update: updateMock,
		}
		store = await PersistentVectorStore.create(mockStorage, "semantic-search-vectors")
	})

	const createVector = (values: number[]): Vector => ({
		values,
		dimension: values.length,
	})

	const createMetadata = (name: string): CodeDefinition => ({
		type: "function",
		name,
		filePath: "/test/file.ts",
		content: "test content",
		startLine: 1,
		endLine: 1,
		language: "typescript",
	})

	describe("persistence", () => {
		it("should save vectors to storage on add", async () => {
			const vector = createVector([1, 0, 0])
			const metadata = createMetadata("test")

			await store.add(vector, metadata)

			expect(updateMock).toHaveBeenCalledWith(
				"semantic-search-vectors",
				expect.arrayContaining([
					expect.objectContaining({
						vector,
						metadata,
					}),
				]),
			)
		})

		it("should save vectors to storage on addBatch", async () => {
			const items: VectorWithMetadata[] = [
				{ vector: createVector([1, 0, 0]), metadata: createMetadata("test1") },
				{ vector: createVector([0, 1, 0]), metadata: createMetadata("test2") },
			]

			await store.addBatch(items)

			expect(updateMock).toHaveBeenCalledWith("semantic-search-vectors", expect.arrayContaining(items))
		})

		it("should load vectors from storage", async () => {
			const vector: Vector = { values: [1, 2, 3], dimension: 3 }
			const metadata = {
				filePath: "test.ts",
				content: "test",
				type: "function",
				name: "test",
				startLine: 1,
				endLine: 1,
			}
			mockStorage.get = jest.fn().mockReturnValue([{ vector, metadata }])

			store = await PersistentVectorStore.create(mockStorage, "semantic-search-vectors")
			expect(store.size()).toBe(1)
		})

		it("should clear storage when cleared", async () => {
			store.clear()

			expect(updateMock).toHaveBeenCalledWith("semantic-search-vectors", [])
		})

		it("should persist vectors across instances", async () => {
			const vector: Vector = { values: [1, 2, 3], dimension: 3 }
			const metadata = {
				filePath: "test.ts",
				content: "test",
				type: "function",
				name: "test",
				startLine: 1,
				endLine: 1,
			}

			await store.add(vector, metadata)
			expect(store.size()).toBe(1)

			// Create new instance with same storage
			const newStore = await PersistentVectorStore.create(mockStorage, "semantic-search-vectors")
			expect(newStore.size()).toBe(1)

			const results = await newStore.search(vector, 1)
			expect(results).toHaveLength(1)
			expect(results[0].metadata).toEqual(metadata)
		})

		it("should clear vectors from storage", async () => {
			const vector: Vector = { values: [1, 2, 3], dimension: 3 }
			const metadata = {
				filePath: "test.ts",
				content: "test",
				type: "function",
				name: "test",
				startLine: 1,
				endLine: 1,
			}

			await store.add(vector, metadata)
			store.clear()

			// Update mock to return empty array after clearing
			getMock.mockReturnValue([])

			const newStore = await PersistentVectorStore.create(mockStorage, "semantic-search-vectors")
			expect(newStore.size()).toBe(0)
		})
	})

	describe("search functionality", () => {
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

		it("should respect k parameter", async () => {
			const results = await store.search(createVector([1, 0, 0]), 2)
			expect(results).toHaveLength(2)
		})
	})
})
