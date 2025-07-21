import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { LibSQLVectorStore } from "../libsql-client"
import * as path from "path"
import * as fs from "fs"

const getWorkspacePath = () => "/mock/workspace/path"

describe("LibSQLVectorStore", () => {
	let vectorStore: LibSQLVectorStore
	const testVectorSize = 3
	const testWorkspacePath = getWorkspacePath()
	const testBasePath = path.join(__dirname, "temp_test_dbs")

	beforeAll(async () => {
		if (fs.existsSync(testBasePath)) {
			fs.rmSync(testBasePath, { recursive: true, force: true })
		}
		fs.mkdirSync(testBasePath, { recursive: true })

		vectorStore = new LibSQLVectorStore(testWorkspacePath, testBasePath, testVectorSize)
		await vectorStore.initialize()
	})

	afterAll(async () => {
		await vectorStore.deleteCollection()
		if (fs.existsSync(testBasePath)) {
			fs.rmSync(testBasePath, { recursive: true, force: true })
		}
	})

	describe("Initialization", () => {
		beforeEach(async () => {
			await vectorStore.deleteCollection()
		})

		it("should initialize with new table when none exists", async () => {
			const wasCreated = await vectorStore.initialize()
			expect(wasCreated).toBe(true)
		})

		it("should not create table when one already exists", async () => {
			await vectorStore.initialize()
			const wasCreated = await vectorStore.initialize()
			expect(wasCreated).toBe(false)
		})
	})

	describe("Vector Operations", () => {
		beforeEach(async () => {
			await vectorStore.deleteCollection()
			await vectorStore.initialize()
		})

		it("should upsert points with valid payload", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 2, 3],
					payload: {
						filePath: "test/file.ts",
						codeChunk: "test code",
						startLine: 1,
						endLine: 5,
					},
				},
			]

			await vectorStore.upsertPoints(points)

			const results = await vectorStore.search([1, 2, 3])
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("test1")
		})

		it("should search for similar vectors", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 0, 0],
					payload: {
						filePath: "test/file1.ts",
						codeChunk: "test code 1",
						startLine: 1,
						endLine: 5,
					},
				},
				{
					id: "test2",
					vector: [0, 1, 0],
					payload: {
						filePath: "test/file2.ts",
						codeChunk: "test code 2",
						startLine: 6,
						endLine: 10,
					},
				},
			]

			await vectorStore.upsertPoints(points)

			const results = await vectorStore.search([1, 0, 0])
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("test1")
		})

		it("should filter by directory prefix", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 0, 0],
					payload: {
						filePath: path.join("src", "file1.ts"),
						codeChunk: "test code 1",
						startLine: 1,
						endLine: 5,
					},
				},
				{
					id: "test2",
					vector: [0, 1, 0],
					payload: {
						filePath: path.join("test", "file2.ts"),
						codeChunk: "test code 2",
						startLine: 6,
						endLine: 10,
					},
				},
			]

			await vectorStore.upsertPoints(points)

			const results = await vectorStore.search([1, 0, 0], path.join("src"))
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("test1")
		})

		it("should respect score threshold", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 0, 0],
					payload: {
						filePath: "test/file1.ts",
						codeChunk: "test code 1",
						startLine: 1,
						endLine: 5,
					},
				},
				{
					id: "test2",
					vector: [0.5, 0.5, 0],
					payload: {
						filePath: "test/file2.ts",
						codeChunk: "test code 2",
						startLine: 6,
						endLine: 10,
					},
				},
			]

			await vectorStore.upsertPoints(points)

			const results = await vectorStore.search([1, 0, 0], undefined, 0.9)
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("test1")
		})

		it("should respect max results limit", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 0, 0],
					payload: {
						filePath: "test/file1.ts",
						codeChunk: "test code 1",
						startLine: 1,
						endLine: 5,
					},
				},
				{
					id: "test2",
					vector: [0.9, 0.1, 0],
					payload: {
						filePath: "test/file2.ts",
						codeChunk: "test code 2",
						startLine: 6,
						endLine: 10,
					},
				},
			]

			await vectorStore.upsertPoints(points)

			const results = await vectorStore.search([1, 0, 0], undefined, undefined, 1)
			expect(results).toHaveLength(1)
		})

		it("should correctly store and retrieve generated pathSegments", async () => {
			const filePath = path.join("src", "components", "ui", "Button.tsx")
			const points = [
				{
					id: "test-path-segments",
					vector: [0.1, 0.2, 0.3],
					payload: {
						filePath: filePath,
						codeChunk: "export const Button = () => {};",
						startLine: 1,
						endLine: 3,
					},
				},
			]

			await vectorStore.upsertPoints(points)

			const results = await vectorStore.search([0.1, 0.2, 0.3], path.join("src", "components"))
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("test-path-segments")
			expect(results[0].payload!.filePath).toBe(filePath)

			const resultsExact = await vectorStore.search([0.1, 0.2, 0.3], filePath)
			expect(resultsExact).toHaveLength(1)
			expect(resultsExact[0].id).toBe("test-path-segments")
		})

		it("should update existing points when upserting with same ID", async () => {
			const initialPoints = [
				{
					id: "update-test",
					vector: [1, 1, 1],
					payload: {
						filePath: "update/file.ts",
						codeChunk: "initial code",
						startLine: 1,
						endLine: 1,
					},
				},
			]
			await vectorStore.upsertPoints(initialPoints)

			const updatedPoints = [
				{
					id: "update-test",
					vector: [2, 2, 2],
					payload: {
						filePath: "update/file.ts",
						codeChunk: "updated code",
						startLine: 2,
						endLine: 2,
					},
				},
			]
			await vectorStore.upsertPoints(updatedPoints)

			const results = await vectorStore.search([2, 2, 2])
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("update-test")
			expect(results[0].payload!.codeChunk).toBe("updated code")
			expect(results[0].payload!.startLine).toBe(2)
			expect(results[0].payload!.endLine).toBe(2)
		})

		it("should filter by directory prefix with trailing slash", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 0, 0],
					payload: {
						filePath: path.join("src", "folder", "file1.ts"),
						codeChunk: "test code 1",
						startLine: 1,
						endLine: 5,
					},
				},
				{
					id: "test2",
					vector: [0, 1, 0],
					payload: {
						filePath: path.join("test", "folder", "file2.ts"),
						codeChunk: "test code 2",
						startLine: 6,
						endLine: 10,
					},
				},
			]

			await vectorStore.upsertPoints(points)

			const results = await vectorStore.search([1, 0, 0], path.join("src", "folder") + path.sep)
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("test1")
		})
	})

	describe("File Operations", () => {
		beforeEach(async () => {
			await vectorStore.deleteCollection()
			await vectorStore.initialize()
		})

		it("should delete points by file path", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 0, 0],
					payload: {
						filePath: "test/file1.ts",
						codeChunk: "test code 1",
						startLine: 1,
						endLine: 5,
					},
				},
				{
					id: "test2",
					vector: [0, 1, 0],
					payload: {
						filePath: "test/file2.ts",
						codeChunk: "test code 2",
						startLine: 6,
						endLine: 10,
					},
				},
			]

			await vectorStore.upsertPoints(points)
			await vectorStore.deletePointsByFilePath("test/file1.ts")

			const results = await vectorStore.search([1, 0, 0])
			expect(results).toHaveLength(0)
		})

		it("should delete points by multiple file paths", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 0, 0],
					payload: {
						filePath: "test/file1.ts",
						codeChunk: "test code 1",
						startLine: 1,
						endLine: 5,
					},
				},
				{
					id: "test2",
					vector: [0, 1, 0],
					payload: {
						filePath: "test/file2.ts",
						codeChunk: "test code 2",
						startLine: 6,
						endLine: 10,
					},
				},
			]

			await vectorStore.upsertPoints(points)
			await vectorStore.deletePointsByMultipleFilePaths(["test/file1.ts", "test/file2.ts"])

			const results = await vectorStore.search([1, 0, 0])
			expect(results).toHaveLength(0)
		})

		it("should handle empty array when deleting points by multiple file paths", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 2, 3],
					payload: {
						filePath: "test/file.ts",
						codeChunk: "test code",
						startLine: 1,
						endLine: 5,
					},
				},
			]
			await vectorStore.upsertPoints(points)

			const executeSpy = vi.spyOn(vectorStore["client"], "execute")

			await expect(vectorStore.deletePointsByMultipleFilePaths([])).resolves.not.toThrow()
			expect(executeSpy).not.toHaveBeenCalled()

			const results = await vectorStore.search([1, 2, 3])
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("test1")

			executeSpy.mockRestore()
		})
	})

	describe("Collection Management", () => {
		beforeEach(async () => {
			await vectorStore.deleteCollection()
			await vectorStore.initialize()
		})

		it("should clear collection", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 2, 3],
					payload: {
						filePath: "test/file.ts",
						codeChunk: "test code",
						startLine: 1,
						endLine: 5,
					},
				},
			]

			await vectorStore.upsertPoints(points)
			await vectorStore.clearCollection()

			const results = await vectorStore.search([1, 2, 3])
			expect(results).toHaveLength(0)
		})

		it("should delete collection", async () => {
			await vectorStore.deleteCollection()
			const exists = await vectorStore.collectionExists()
			expect(exists).toBe(false)
		})

		it("should return true when collection exists", async () => {
			const exists = await vectorStore.collectionExists()
			expect(exists).toBe(true)
		})
	})

	describe("Error Handling", () => {
		it("should throw when searching non-existent collection", async () => {
			await vectorStore.deleteCollection()
			await expect(vectorStore.search([1, 2, 3])).rejects.toThrow()
		})

		it("should throw when upserting with invalid vector dimensions", async () => {
			const points = [
				{
					id: "test1",
					vector: [1, 2, 3, 4],
					payload: {
						filePath: "test/file.ts",
						codeChunk: "test code",
						startLine: 1,
						endLine: 5,
					},
				},
			]

			await expect(vectorStore.upsertPoints(points)).rejects.toThrow()
		})

		it("should re-throw error when createTable fails", async () => {
			const mockCreateTable = vi
				.spyOn(vectorStore as any, "createTable")
				.mockRejectedValue(new Error("vectorStore.libsqlConnectionFailed"))

			await expect(vectorStore.initialize()).rejects.toThrow("vectorStore.libsqlConnectionFailed")
			expect(mockCreateTable).toHaveBeenCalled()

			mockCreateTable.mockRestore()
		})

		it("should handle empty array when upserting points", async () => {
			await vectorStore.initialize()

			await expect(vectorStore.upsertPoints([])).resolves.not.toThrow()

			const results = await vectorStore.search([1, 2, 3])
			expect(results).toHaveLength(0)
		})

		it("should handle points missing filePath", async () => {
			await vectorStore.initialize()

			const points = [
				{
					id: "no-filepath",
					vector: [1, 2, 3],
					payload: {
						filePath: "",
						codeChunk: "test code",
						startLine: 1,
						endLine: 5,
					},
				},
			]

			await expect(vectorStore.upsertPoints(points)).resolves.not.toThrow()

			const results = await vectorStore.search([1, 2, 3])
			expect(results).toHaveLength(1)
			expect(results[0].payload?.pathSegments).toBeUndefined()
		})

		it("should throw when search query fails", async () => {
			const mockExecute = vi
				.spyOn(vectorStore["client"], "execute")
				.mockRejectedValue(new Error("Simulated database query failure during search"))

			await expect(vectorStore.search([1, 2, 3])).rejects.toThrow(
				"Simulated database query failure during search",
			)
			expect(mockExecute).toHaveBeenCalled()

			mockExecute.mockRestore()
		})

		it("should throw when deletePointsByMultipleFilePaths fails", async () => {
			const mockTransaction = vi.spyOn(vectorStore["client"], "transaction").mockImplementation(() => {
				throw new Error("Simulated database transaction failure during delete")
			})

			await expect(vectorStore.deletePointsByMultipleFilePaths(["test/file1.ts"])).rejects.toThrow(
				"Simulated database transaction failure during delete",
			)
			expect(mockTransaction).toHaveBeenCalled()

			mockTransaction.mockRestore()
		})

		it("should throw when collectionExists fails", async () => {
			const mockExecute = vi
				.spyOn(vectorStore["client"], "execute")
				.mockRejectedValue(new Error("Simulated database query failure during collectionExists"))

			await expect(vectorStore.collectionExists()).rejects.toThrow(
				"Simulated database query failure during collectionExists",
			)
			expect(mockExecute).toHaveBeenCalled()

			mockExecute.mockRestore()
		})

		it("should handle SQLITE_BUSY errors with retry logic and eventually throw after max retries", async () => {
			const originalMaxRetries = (vectorStore as any).maxRetries
			;(vectorStore as any).maxRetries = 3

			let callCount = 0
			const mockTransaction = vi.spyOn(vectorStore["client"], "transaction").mockImplementation(async () => {
				callCount++
				if (callCount <= (vectorStore as any).maxRetries) {
					const error: any = new Error("database is locked")
					error.code = "SQLITE_BUSY"
					throw error
				}
				return {
					execute: vi.fn(),
					commit: vi.fn(),
					rollback: vi.fn(),
				} as any
			})

			const points = [
				{
					id: "retry-test",
					vector: [1, 2, 3],
					payload: {
						filePath: "test/retry.ts",
						codeChunk: "retry code",
						startLine: 1,
						endLine: 5,
					},
				},
			]

			await expect(vectorStore.upsertPoints(points)).rejects.toThrow("database is locked")
			expect(mockTransaction).toHaveBeenCalledTimes((vectorStore as any).maxRetries)

			mockTransaction.mockRestore()
			;(vectorStore as any).maxRetries = originalMaxRetries
		}, 10000)
	})
})
