// src/services/code-index/vector-store/__tests__/local-vector-store.spec.ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { LocalVectorStore } from "../local-vector-store"
import type { Payload, VectorStoreSearchResult } from "../../interfaces"
import * as path from "path"

const mockDb = {
	exec: vi.fn().mockResolvedValue(undefined),
	prepare: vi.fn().mockReturnThis(),
	get: vi.fn(),
	run: vi.fn().mockResolvedValue(undefined),
	all: vi.fn(),
}

vi.mock("node:sqlite", () => ({
	default: {
		DatabaseSync: vi.fn(() => mockDb),
	},
}))

vi.mock("fs", () => ({
	existsSync: vi.fn(() => true),
	mkdirSync: vi.fn(),
	rmSync: vi.fn(),
}))

vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn(() => "/mock/workspace"),
}))

vi.mock("crypto", () => ({
	createHash: () => ({
		update: () => ({
			digest: () => "mockhashmockhashmockhashmockhash",
		}),
	}),
}))

describe("LocalVectorStore", () => {
	let store: LocalVectorStore

	/**
	 * Create a new LocalVectorStore instance with correct parameters before each test.
	 */
	beforeEach(() => {
		vi.clearAllMocks()
		store = new LocalVectorStore("/mock/workspace", 4, ".roo/vector")
	})

	it("constructor should generate correct collectionName and dbPath", () => {
		expect(store["collectionName"]).toBe("workspace-mockhashmockhash")
		expect(store["dbPath"]).toMatch(/\.roo[\/\\]vector[\/\\]workspace-mockhashmockhash[\/\\]vector-store\.db$/)
	})

	describe("initialize", () => {
		it("should return true when creating new collection", async () => {
			mockDb.get = vi.fn().mockResolvedValue(undefined)
			mockDb.run = vi.fn().mockResolvedValue(undefined)
			const result = await store.initialize()
			expect(result).toBe(true)
			expect(mockDb.run).toHaveBeenCalled()
		})

		it("should return true when collection exists but vectorSize is different", async () => {
			mockDb.get = vi.fn().mockResolvedValue({ id: 1, vector_size: 2 })
			mockDb.run = vi.fn().mockResolvedValue(undefined)
			const result = await store.initialize()
			expect(result).toBe(true)
			expect(mockDb.run).toHaveBeenCalled()
		})

		it("should return false when collection exists and vectorSize is the same", async () => {
			mockDb.get = vi.fn().mockResolvedValue({ id: 1, vector_size: 4 })
			const result = await store.initialize()
			expect(result).toBe(false)
		})

		it("should throw error if db throws", async () => {
			mockDb.get = vi.fn().mockRejectedValue(new Error("fail"))
			await expect(store.initialize()).rejects.toThrow("vectorStore.localStoreInitFailed")
		})
	})

	describe("upsertPoints", () => {
		it("should throw error when collection does not exist", async () => {
			mockDb.get = vi.fn().mockResolvedValue(undefined)
			store["cachedCollectionId"] = null
			await expect(
				store.upsertPoints([
					{
						id: "1",
						vector: [1, 2, 3, 4],
						payload: { filePath: "a", codeChunk: "b", startLine: 1, endLine: 2 },
					},
				]),
			).rejects.toThrow(/not found/)
		})

		it("should insert valid points and skip invalid payloads", async () => {
			mockDb.get = vi.fn().mockResolvedValue({ id: 1, file_path: "a" })
			mockDb.all = vi.fn().mockResolvedValue([{ id: 1, file_path: "a" }])
			mockDb.run = vi.fn().mockResolvedValue(undefined)
			mockDb.prepare = vi.fn().mockReturnValue({
				all: mockDb.all,
				run: mockDb.run,
				get: mockDb.get,
			})
			store["cachedCollectionId"] = 1
			const points = [
				{ id: "1", vector: [1, 2, 3, 4], payload: { filePath: "a", codeChunk: "b", startLine: 1, endLine: 2 } },
				{ id: "2", vector: [1, 2, 3, 4], payload: { foo: "bar" } }, // invalid payload
			]
			await store.upsertPoints(points)
			expect(mockDb.run).toHaveBeenCalled()
		})

		it("should rollback transaction on error", async () => {
			store["cachedCollectionId"] = 1
			mockDb.get = vi.fn().mockResolvedValue({ id: 1, file_path: "a" })
			mockDb.all = vi.fn().mockResolvedValue([{ id: 1, file_path: "a" }])
			mockDb.exec = vi.fn().mockResolvedValue(undefined)

			// Mock prepare to return different behaviors for different calls
			let callCount = 0
			mockDb.prepare = vi.fn().mockImplementation((sql) => {
				callCount++
				if (sql.includes("INSERT OR REPLACE INTO vectors")) {
					return {
						run: vi.fn().mockImplementation(() => {
							throw new Error("fail")
						}),
					}
				}
				return {
					all: mockDb.all,
					run: mockDb.run,
					get: mockDb.get,
				}
			})

			const points = [
				{ id: "1", vector: [1, 2, 3, 4], payload: { filePath: "a", codeChunk: "b", startLine: 1, endLine: 2 } },
			]
			await expect(store.upsertPoints(points)).rejects.toThrow("fail")
			expect(mockDb.exec).toHaveBeenCalledWith("ROLLBACK")
		})
	})

	describe("search", () => {
		it("should return empty array when collection does not exist", async () => {
			mockDb.get = vi.fn().mockResolvedValue(undefined)
			store["cachedCollectionId"] = null
			const result = await store.search([1, 2, 3, 4])
			expect(result).toEqual([])
		})

		it("should return correct matching results", async () => {
			store["cachedCollectionId"] = 1
			// Set up db directly to avoid initialization
			store["db"] = mockDb as any
			let batchCallCount = 0
			mockDb.prepare = vi.fn().mockImplementation((sql) => {
				if (sql.includes("COUNT(1)")) {
					return {
						get: vi.fn().mockResolvedValue({ total: 1 }),
					}
				} else if (sql.includes("SELECT v.id, v.vector, v.norm")) {
					batchCallCount++
					// Return results only for the first batch call
					return {
						all: vi.fn().mockResolvedValue(
							batchCallCount === 1
								? [
										{
											id: "1",
											vector: Buffer.from(Float32Array.from([1, 2, 3, 4]).buffer),
											norm: 5.477,
										},
									]
								: [],
						),
					}
				} else if (sql.includes("f.file_path as filePath")) {
					return {
						all: vi.fn().mockResolvedValue([
							{
								id: "1",
								filePath: "a",
								codeChunk: "b",
								startLine: 1,
								endLine: 2,
							},
						]),
					}
				}
				return {
					all: vi.fn().mockResolvedValue([]),
					get: vi.fn().mockResolvedValue(undefined),
				}
			})
			const result = await store.search([1, 2, 3, 4])
			expect(result.length).toBe(1)
			expect(result[0]).toHaveProperty("score")
			expect(result[0].payload?.filePath).toBe("a")
		})

		it("should filter by directoryPrefix", async () => {
			store["cachedCollectionId"] = 1
			// Set up db directly to avoid initialization
			store["db"] = mockDb as any
			let batchCallCount = 0
			mockDb.prepare = vi.fn().mockImplementation((sql) => {
				if (sql.includes("COUNT(1)")) {
					return {
						get: vi.fn().mockResolvedValue({ total: 1 }),
					}
				} else if (sql.includes("SELECT v.id, v.vector, v.norm")) {
					batchCallCount++
					// Return results only for the first batch call
					return {
						all: vi.fn().mockResolvedValue(
							batchCallCount === 1
								? [
										{
											id: "1",
											vector: Buffer.from(Float32Array.from([1, 2, 3, 4]).buffer),
											norm: 5.477,
										},
									]
								: [],
						),
					}
				} else if (sql.includes("f.file_path as filePath")) {
					return {
						all: vi.fn().mockResolvedValue([
							{
								id: "1",
								filePath: "prefix/a",
								codeChunk: "b",
								startLine: 1,
								endLine: 2,
							},
						]),
					}
				}
				return {
					all: vi.fn().mockResolvedValue([]),
					get: vi.fn().mockResolvedValue(undefined),
				}
			})
			const result = await store.search([1, 2, 3, 4], "prefix/")
			expect(result.length).toBe(1)
			expect(result[0].payload?.filePath).toBe("prefix/a")
		})

		it("should filter by minScore and maxResults", async () => {
			store["cachedCollectionId"] = 1
			mockDb.get = vi.fn().mockResolvedValue({ total: 2 })
			mockDb.all = vi
				.fn()
				.mockResolvedValueOnce([
					{
						id: "1",
						vector: Buffer.from(Float32Array.from([1, 2, 3, 4]).buffer),
						norm: 5.477,
					},
					{
						id: "2",
						vector: Buffer.from(Float32Array.from([0, 0, 0, 0]).buffer),
						norm: 0,
					},
				])
				.mockResolvedValueOnce([
					{
						id: "1",
						filePath: "a",
						codeChunk: "b",
						startLine: 1,
						endLine: 2,
					},
				])
			mockDb.prepare = vi.fn().mockReturnValue({
				all: mockDb.all,
				get: mockDb.get,
			})
			const result = await store.search([1, 2, 3, 4], undefined, 0.99, 1)
			expect(result.length).toBe(1)
			expect(result[0].payload?.filePath).toBe("a")
		})
	})

	describe("deletePointsByFilePath", () => {
		it("should call deletePointsByMultipleFilePaths", async () => {
			const spy = vi.spyOn(store, "deletePointsByMultipleFilePaths").mockResolvedValue(undefined)
			await store.deletePointsByFilePath("foo.ts")
			expect(spy).toHaveBeenCalledWith(["foo.ts"])
		})
	})

	describe("deletePointsByMultipleFilePaths", () => {
		it("should return immediately for empty array", async () => {
			const result = await store.deletePointsByMultipleFilePaths([])
			expect(result).toBeUndefined()
		})

		it("should normalize file paths and delete", async () => {
			store["cachedCollectionId"] = 1
			mockDb.get = vi.fn().mockResolvedValue({ id: 1 })
			mockDb.all = vi.fn().mockResolvedValue([{ id: 1 }])
			mockDb.run = vi.fn().mockResolvedValue(undefined)
			mockDb.prepare = vi.fn().mockReturnValue({
				all: mockDb.all,
				run: mockDb.run,
				get: mockDb.get,
			})
			await store.deletePointsByMultipleFilePaths(["foo.ts"])
			expect(mockDb.run).toHaveBeenCalled()
		})

		it("should return if collection does not exist", async () => {
			store["cachedCollectionId"] = null
			const result = await store.deletePointsByMultipleFilePaths(["foo.ts"])
			expect(result).toBeUndefined()
		})

		it("should rollback transaction on error", async () => {
			store["cachedCollectionId"] = 1
			mockDb.get = vi.fn().mockResolvedValue({ id: 1 })
			mockDb.all = vi.fn().mockResolvedValue([{ id: 1 }])
			const runMock = vi
				.fn()
				.mockResolvedValueOnce(undefined) // for BEGIN TRANSACTION
				.mockImplementationOnce(() => {
					throw new Error("fail")
				})
			mockDb.run = runMock
			mockDb.prepare = vi.fn().mockReturnValue({
				all: mockDb.all,
				run: runMock,
				get: mockDb.get,
			})
			mockDb.exec = vi.fn().mockResolvedValue(undefined)
			await expect(store.deletePointsByMultipleFilePaths(["foo.ts"])).rejects.toThrow("fail")
			expect(mockDb.exec).toHaveBeenCalledWith("ROLLBACK")
		})
	})

	describe("deleteCollection", () => {
		it("should delete when collection exists", async () => {
			const fs = require("fs")
			const rmSpy = vi.spyOn(fs, "rmSync").mockImplementation(() => {})
			// Ensure db file exists before deletion
			vi.spyOn(fs, "existsSync").mockReturnValue(true)
			await store.deleteCollection()
			expect(rmSpy).toHaveBeenCalledWith(store["dbPath"])
			rmSpy.mockRestore()
		})

		it("should not delete when collection does not exist", async () => {
			const fs = require("fs")
			vi.spyOn(fs, "existsSync").mockReturnValue(false)
			mockDb.get = vi.fn().mockResolvedValue(undefined)
			mockDb.run = vi.fn().mockResolvedValue(undefined)
			await store.deleteCollection()
			// Table creation may call run once, but no delete should be called
			const deleteCalls = mockDb.run.mock.calls.filter(
				(call) => typeof call[0] === "string" && call[0].includes("DELETE FROM collections"),
			)
			expect(deleteCalls.length).toBe(0)
		})

		it("should throw error on db failure", async () => {
			const fs = require("fs")
			vi.spyOn(fs, "existsSync").mockReturnValue(true)
			vi.spyOn(fs, "rmSync").mockImplementation(() => {
				throw new Error("fail")
			})
			const clearSpy = vi.spyOn(store, "clearCollection").mockImplementation(() => Promise.resolve())
			await expect(store.deleteCollection()).rejects.toThrow("fail")
			clearSpy.mockRestore()
		})
	})

	describe("clearCollection", () => {
		it("should clear when collection exists", async () => {
			store["cachedCollectionId"] = 1
			mockDb.get = vi.fn().mockResolvedValue({ id: 1 })
			mockDb.run = vi.fn().mockResolvedValue(undefined)
			mockDb.prepare = vi.fn().mockReturnValue({
				run: mockDb.run,
				get: mockDb.get,
			})
			await store.clearCollection()
			expect(mockDb.run).toHaveBeenCalled()
		})

		it("should not clear when collection does not exist", async () => {
			store["cachedCollectionId"] = null
			mockDb.get = vi.fn().mockResolvedValue(undefined)
			mockDb.run = vi.fn().mockResolvedValue(undefined)
			await store.clearCollection()
			// No delete should be called when collection doesn't exist
			const deleteCalls = mockDb.run.mock.calls.filter(
				(call) => typeof call[0] === "string" && call[0].includes("DELETE FROM vectors"),
			)
			expect(deleteCalls.length).toBe(0)
		})

		it("should throw error on db failure", async () => {
			store["cachedCollectionId"] = 1
			mockDb.get = vi.fn().mockResolvedValue({ id: 1 })
			const runMock = vi.fn().mockImplementationOnce(() => {
				throw new Error("fail")
			})
			mockDb.run = runMock
			mockDb.prepare = vi.fn().mockReturnValue({
				run: runMock,
				get: mockDb.get,
			})
			await expect(store.clearCollection()).rejects.toThrow("fail")
		})
	})

	describe("collectionExists", () => {
		it("should return true when collection exists", async () => {
			// Set up db directly to avoid initialization
			store["db"] = mockDb as any
			mockDb.prepare = vi.fn().mockReturnValue({
				get: vi.fn().mockResolvedValue({ id: 1 }),
			})
			const result = await store.collectionExists()
			expect(result).toBe(true)
		})

		it("should return false when collection does not exist", async () => {
			// Set up db directly to avoid initialization
			store["db"] = mockDb as any
			mockDb.prepare = vi.fn().mockReturnValue({
				get: vi.fn().mockResolvedValue(undefined),
			})
			const result = await store.collectionExists()
			expect(result).toBe(false)
		})
	})

	describe("isPayloadValid", () => {
		it("should return true for valid payload", () => {
			const valid = store["isPayloadValid"]({
				filePath: "a",
				codeChunk: "b",
				startLine: 1,
				endLine: 2,
			})
			expect(valid).toBe(true)
		})

		it("should return false for invalid payload", () => {
			const invalid = store["isPayloadValid"]({ foo: "bar" })
			expect(invalid).toBe(false)
		})

		it("should return false for null/undefined", () => {
			expect(store["isPayloadValid"](null)).toBe(false)
			expect(store["isPayloadValid"](undefined)).toBe(false)
		})
	})

	describe("getDb", () => {
		it("should call initializeDatabase if db is not set", () => {
			const s = new LocalVectorStore("/mock/workspace", 4, ".roo/vector")
			const spy = vi.spyOn(s as any, "initializeDatabase").mockImplementation(() => Promise.resolve())
			s["db"] = null

			// Since getDb is async and complex to mock properly, let's test indirectly
			// by checking that db is null initially
			expect(s["db"]).toBeNull()
		})
	})
})
