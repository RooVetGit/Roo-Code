import { WorkspaceCache } from "../workspace-cache"
import * as vscode from "vscode"

// Mock VSCode API
jest.mock("vscode", () => ({
	ExtensionContext: jest.fn(),
	Memento: jest.fn(),
	globalState: {
		get: jest.fn(),
		update: jest.fn().mockResolvedValue(undefined),
	},
}))

describe("WorkspaceCache", () => {
	let cache: WorkspaceCache
	let mockContext: { globalState: { get: jest.Mock; update: jest.Mock } }

	beforeEach(() => {
		mockContext = {
			globalState: {
				get: jest.fn(),
				update: jest.fn().mockResolvedValue(undefined),
			},
		}
		cache = new WorkspaceCache(mockContext as any)
	})

	it("should cache and retrieve vectors", async () => {
		const definition = {
			content: "test",
			filePath: "test.ts",
			type: "function",
			name: "test",
			startLine: 1,
			endLine: 1,
		}

		const vector = {
			values: [1, 2, 3],
			dimension: 3,
		}

		await cache.set(definition, vector)
		const cached = await cache.get(definition)
		expect(cached).toEqual(vector)
	})

	it("should handle cache misses", async () => {
		const definition = {
			content: "test",
			filePath: "test.ts",
			type: "function",
			name: "test",
			startLine: 1,
			endLine: 1,
		}

		const cached = await cache.get(definition)
		expect(cached).toBeUndefined()
	})

	it("should clear the cache", async () => {
		const definition = {
			content: "test",
			filePath: "test.ts",
			type: "function",
			name: "test",
			startLine: 1,
			endLine: 1,
		}

		const vector = {
			values: [1, 2, 3],
			dimension: 3,
		}

		await cache.set(definition, vector)
		await cache.clear()
		const cached = await cache.get(definition)
		expect(cached).toBeUndefined()
	})

	it("should invalidate cache entries", async () => {
		const definition = {
			content: "test",
			filePath: "test.ts",
			type: "function",
			name: "test",
			startLine: 1,
			endLine: 1,
		}

		const vector = {
			values: [1, 2, 3],
			dimension: 3,
		}

		await cache.set(definition, vector)
		await cache.invalidate(definition)
		const cached = await cache.get(definition)
		expect(cached).toBeUndefined()
	})
})
