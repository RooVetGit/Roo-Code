// npx vitest run services/code-index/vector-store/__tests__/local-vector-store.spec.ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { LocalVectorStore } from "../local-vector-store"
import fs from "fs"


// LanceDB and fs mocks with all required properties, all as any
const mockTable: any = {
	delete: vi.fn().mockResolvedValue(undefined),
	add: vi.fn().mockResolvedValue(undefined),
	query: vi.fn().mockReturnThis(),
	where: vi.fn().mockReturnThis(),
	toArray: vi.fn().mockResolvedValue([]),
	vectorSearch: vi.fn().mockReturnThis(),
	limit: vi.fn().mockReturnThis(),
	refineFactor: vi.fn().mockReturnThis(),
	postfilter: vi.fn().mockReturnThis(),
	openTable: vi.fn().mockResolvedValue(undefined),
	name: "vector",
	isOpen: true,
	close: vi.fn(),
	display: vi.fn(),
	schema: {},
	count: vi.fn(),
	get: vi.fn(),
	create: vi.fn(),
	drop: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	find: vi.fn(),
	remove: vi.fn(),
	createIndex: vi.fn(),
	dropIndex: vi.fn(),
	indexes: [],
	columns: [],
	primaryKey: "id",
	metadata: {},
	batch: vi.fn(),
	distanceRange: vi.fn().mockReturnThis(),
}

const mockDb: any = {
	openTable: vi.fn().mockResolvedValue(mockTable),
	createTable: vi.fn().mockResolvedValue(mockTable),
	dropTable: vi.fn().mockResolvedValue(undefined),
	tableNames: vi.fn().mockResolvedValue(["vector", "metadata"]),
	close: vi.fn().mockResolvedValue(undefined),
	isOpen: true,
	display: vi.fn(),
	createEmptyTable: vi.fn(),
	dropAllTables: vi.fn(),
}

const mockLanceDBModule = {
	connect: vi.fn().mockResolvedValue(mockDb),
}
const mockLanceDBManager = {
	ensureLanceDBAvailable: vi.fn().mockResolvedValue(undefined),
	getNodeModulesPath: vi.fn().mockReturnValue("/mock/node_modules"),
}

const mockExtensionContext = {}

vi.mock("crypto", () => ({
	createHash: () => ({
		update: () => ({
			digest: () => "mockhashmockhashmockhashmockhash",
		}),
	}),
}))
vi.mock("../../../../services/lancedb-manager", () => ({
	LanceDBManager: vi.fn(() => mockLanceDBManager),
}))
vi.mock("vscode", () => ({
	window: {
		withProgress: vi.fn(),
	},
	ProgressLocation: {
		Notification: 1,
	},
}))
vi.mock("@lancedb/lancedb", () => mockLanceDBModule)

describe("LocalVectorStore", () => {
	let store: LocalVectorStore

	beforeEach(() => {
		vi.clearAllMocks()
		store = new LocalVectorStore("/mock/workspace", 4, ".roo/vector", mockExtensionContext as any)
		store["lancedbModule"] = mockLanceDBModule
		store["lancedbManager"] = mockLanceDBManager as any
	})

	it("constructor should generate correct dbPath", () => {
		expect(store["dbPath"]).toMatch(/\.roo[\/\\]vector[\/\\]workspace-mockhashmockhash/)
	})

	describe("initialize", () => {
		it("should create new tables if not exist", async () => {
			mockDb.tableNames.mockResolvedValue([])
			mockDb.createTable.mockResolvedValue(mockTable)
			mockTable.delete.mockResolvedValue(undefined)
			const result = await store.initialize()
			expect(result).toBe(true)
			expect(mockDb.createTable).toHaveBeenCalled()
		})

		it("should recreate tables if vectorSize mismatch", async () => {
			mockDb.tableNames.mockResolvedValue(["vector", "metadata"])
			const metadataTable: any = {
				query: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				toArray: vi.fn().mockResolvedValue([{ key: "vector_size", value: 2 }]),
				name: "metadata",
				isOpen: true,
				close: vi.fn(),
				display: vi.fn(),
			}
			mockDb.openTable.mockImplementation(async (name: string) => {
				if (name === "metadata") return metadataTable
				return mockTable
			})
			mockDb.dropTable.mockResolvedValue(undefined)
			mockDb.createTable.mockResolvedValue(mockTable)
			mockTable.delete.mockResolvedValue(undefined)
			const result = await store.initialize()
			expect(result).toBe(true)
			expect(mockDb.dropTable).toHaveBeenCalled()
			expect(mockDb.createTable).toHaveBeenCalled()
		})

		it("should return false if vectorSize matches", async () => {
			mockDb.tableNames.mockResolvedValue(["vector", "metadata"])
			const metadataTable: any = {
				query: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				toArray: vi.fn().mockResolvedValue([{ key: "vector_size", value: 4 }]),
				name: "metadata",
				isOpen: true,
				close: vi.fn(),
				display: vi.fn(),
			}
			mockDb.openTable.mockImplementation(async (name: string) => {
				if (name === "metadata") return metadataTable
				return mockTable
			})
			const result = await store.initialize()
			expect(result).toBe(false)
		})

		it("should throw error if db throws", async () => {
			mockDb.tableNames.mockRejectedValue(new Error("fail"))
			await expect(store.initialize()).rejects.toThrow(/localStoreInitFailed/)
		})
	})

	describe("upsertPoints", () => {
		it("should insert valid points and skip invalid payloads", async () => {
			store["table"] = mockTable
			const points = [
				{ id: "1", vector: [1, 2, 3, 4], payload: { filePath: "a", codeChunk: "b", startLine: 1, endLine: 2 } },
				{ id: "2", vector: [1, 2, 3, 4], payload: { foo: "bar" } },
			]
			await store.upsertPoints(points)
			expect(mockTable.add).toHaveBeenCalled()
		})

		it("should not insert if no valid points", async () => {
			store["table"] = mockTable
			const points = [{ id: "2", vector: [1, 2, 3, 4], payload: { foo: "bar" } }]
			await store.upsertPoints(points)
			expect(mockTable.add).not.toHaveBeenCalled()
		})

		it("should throw error on table failure", async () => {
			store["table"] = mockTable
			mockTable.add.mockRejectedValue(new Error("fail"))
			const points = [
				{ id: "1", vector: [1, 2, 3, 4], payload: { filePath: "a", codeChunk: "b", startLine: 1, endLine: 2 } },
			]
			await expect(store.upsertPoints(points)).rejects.toThrow("fail")
		})
	})

	describe("search", () => {
		beforeEach(() => {
			store["table"] = mockTable
			mockTable.vectorSearch.mockReturnThis()
			mockTable.where.mockReturnThis()
			mockTable.limit.mockReturnThis()
			mockTable.refineFactor.mockReturnThis()
			mockTable.postfilter.mockReturnThis()
		})
		it("should return correct results", async () => {
			const mockResults = [
				{
					id: "1",
					_distance: 1.23,
					filePath: "a",
					codeChunk: "b",
					startLine: 1,
					endLine: 2,
				},
			]
			store["table"] = mockTable
			mockTable.vectorSearch.mockReturnThis()
			mockTable.where.mockReturnThis()
			mockTable.limit.mockReturnThis()
			mockTable.refineFactor.mockReturnThis()
			mockTable.postfilter.mockReturnThis()
			mockTable.toArray.mockResolvedValue(mockResults)
			const result = await store.search([1, 2, 3, 4])
			expect(result.length).toBe(1)
			expect(result[0]).toHaveProperty("score", 1.23)
			expect(result[0]?.payload?.filePath).toBe("a")
		})

		it("should filter by directoryPrefix", async () => {
			const mockResults = [
				{ id: "1", _distance: 2, filePath: "src/a.ts", codeChunk: "b", startLine: 1, endLine: 2 },
			]
			mockTable.toArray.mockResolvedValue(mockResults)
			const result = await store.search([1, 2, 3, 4], "src/")
			expect(result.length).toBe(1)
			expect(result[0].payload?.filePath).toBe("src/a.ts")
		})

		it("should respect minScore and maxResults", async () => {
			const mockResults = [
				{ id: "1", _distance: 0.5, filePath: "a", codeChunk: "b", startLine: 1, endLine: 2 },
				{ id: "2", _distance: 2, filePath: "b", codeChunk: "c", startLine: 3, endLine: 4 },
				{ id: "3", _distance: 3, filePath: "c", codeChunk: "d", startLine: 5, endLine: 6 },
			]
			mockTable.toArray.mockResolvedValue(mockResults)
			const result = await store.search([1, 2, 3, 4], undefined, 2, 1)
			expect(result.length).toBe(1)
			expect(result[0].score).toBe(3)
		})

		it("should return empty array if no results", async () => {
			mockTable.toArray.mockResolvedValue([])
			const result = await store.search([1, 2, 3, 4])
			expect(result).toEqual([])
		})

		it("should throw error if getTable fails", async () => {
			store["getTable"] = vi.fn().mockRejectedValue(new Error("fail"))
			await expect(store.search([1, 2, 3, 4])).rejects.toThrow("fail")
		})

		it("should throw error if searchQuery.toArray fails", async () => {
			mockTable.toArray.mockRejectedValue(new Error("fail"))
			await expect(store.search([1, 2, 3, 4])).rejects.toThrow("fail")
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
			store["table"] = mockTable
			mockTable.delete.mockResolvedValue(undefined)
			await store.deletePointsByMultipleFilePaths(["foo.ts"])
			expect(mockTable.delete).toHaveBeenCalled()
		})

		it("should throw error on table failure", async () => {
			store["table"] = mockTable
			mockTable.delete.mockRejectedValue(new Error("fail"))
			await expect(store.deletePointsByMultipleFilePaths(["foo.ts"])).rejects.toThrow("fail")
		})
	})

	describe("deleteCollection", () => {
		it("should delete when collection exists", async () => {
			vi.spyOn(fs, "existsSync").mockReturnValue(true)
			vi.spyOn(fs, "rmSync").mockImplementation(() => {})
			await store.deleteCollection()
			expect(fs.rmSync).toHaveBeenCalledWith(store["dbPath"], { recursive: true, force: true })
		})

		it("should not delete when collection does not exist", async () => {
			vi.spyOn(fs, "existsSync").mockReturnValue(false)
			await store.deleteCollection()
			expect(fs.rmSync).not.toHaveBeenCalled()
		})

		it("should throw error on fs failure", async () => {
			vi.spyOn(fs, "existsSync").mockReturnValue(true)
			vi.spyOn(fs, "rmSync").mockImplementation(() => {
				throw new Error("fail")
			})
			await expect(store.deleteCollection()).rejects.toThrow("fail")
		})
	})

	describe("clearCollection", () => {
		it("should clear when collection exists", async () => {
			store["table"] = mockTable
			mockTable.delete.mockResolvedValue(undefined)
			await store.clearCollection()
			expect(mockTable.delete).toHaveBeenCalledWith("true")
		})

		it("should throw error on table failure", async () => {
			store["table"] = mockTable
			mockTable.delete.mockRejectedValue(new Error("fail"))
			await expect(store.clearCollection()).rejects.toThrow("fail")
		})
	})

	describe("collectionExists", () => {
		it("should return true when collection exists", async () => {
			mockDb.tableNames.mockResolvedValue(["vector"])
			store["db"] = mockDb
			const result = await store.collectionExists()
			expect(result).toBe(true)
		})

		it("should return false when collection does not exist", async () => {
			mockDb.tableNames.mockResolvedValue([])
			store["db"] = mockDb
			const result = await store.collectionExists()
			expect(result).toBe(false)
		})

		it("should return false on error", async () => {
			mockDb.tableNames.mockRejectedValue(new Error("fail"))
			store["db"] = mockDb
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
		it("should call LanceDB connect if db is not set", async () => {
			store["db"] = null
			await store["getDb"]()
			expect(mockLanceDBModule.connect).toHaveBeenCalledWith(store["dbPath"])
		})
	})
})
