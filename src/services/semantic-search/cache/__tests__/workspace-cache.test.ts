import { WorkspaceCache } from "../workspace-cache"
import { CodeDefinition } from "../../types"
import { Vector } from "../../vector-store/types"
import { Storage } from "../../types"

// Mock VSCode API
jest.mock("vscode", () => ({
	ExtensionContext: jest.fn(),
	Memento: jest.fn(),
	globalState: {
		get: jest.fn(),
		update: jest.fn().mockResolvedValue(undefined),
	},
}))

class MockStorage implements Storage {
	private store = new Map<string, any>()

	get<T>(key: string): T | undefined {
		return this.store.get(key)
	}

	update(key: string, value: any): Thenable<void> {
		this.store.set(key, value)
		return Promise.resolve()
	}
}

describe("WorkspaceCache", () => {
	let cache: WorkspaceCache
	let mockContext: { globalState: { get: jest.Mock; update: jest.Mock } }
	let storage: MockStorage
	let vector: Vector
	let definition: CodeDefinition

	beforeEach(() => {
		mockContext = {
			globalState: {
				get: jest.fn(),
				update: jest.fn().mockResolvedValue(undefined),
			},
		}
		storage = new MockStorage()
		cache = new WorkspaceCache(storage)
		vector = { values: [1, 2, 3], dimension: 3 }
		definition = {
			type: "function",
			name: "test",
			filePath: "/test/file.ts",
			content: "test content",
			startLine: 1,
			endLine: 1,
			language: "typescript",
		}
	})

	it("should store and retrieve vectors", async () => {
		await cache.set(definition, vector)
		const cached = await cache.get(definition)
		expect(cached).toEqual(vector)
	})

	it("should return undefined for non-existent entries", async () => {
		const nonExistent: CodeDefinition = {
			...definition,
			name: "nonexistent",
			language: "typescript",
		}
		const cached = await cache.get(nonExistent)
		expect(cached).toBeUndefined()
	})

	it("should update existing entries", async () => {
		const newVector = { values: [4, 5, 6], dimension: 3 }
		await cache.set(definition, vector)
		await cache.set(definition, newVector)
		const cached = await cache.get(definition)
		expect(cached).toEqual(newVector)
	})

	it("should invalidate entries", async () => {
		await cache.set(definition, vector)
		await cache.invalidate(definition)
		const cached = await cache.get(definition)
		expect(cached).toBeUndefined()
	})

	it("should clear all entries", async () => {
		const def1 = { ...definition, name: "test1", language: "typescript" }
		const def2 = { ...definition, name: "test2", language: "typescript" }

		await cache.set(def1, vector)
		await cache.set(def2, vector)
		await cache.clear()

		expect(await cache.get(def1)).toBeUndefined()
		expect(await cache.get(def2)).toBeUndefined()
	})
})
