import { SemanticSearchService, SemanticSearchConfig } from ".."
import * as vscode from "vscode"
import { MemoryMonitor } from "../memory/monitor"
import { CodeDefinition } from "../types"
import * as path from "path"
import * as os from "os"
import * as fs from "fs"

// Mock VSCode API
jest.mock("vscode", () => ({
	ExtensionContext: jest.fn(),
	Memento: jest.fn(),
	globalState: {
		get: jest.fn(),
		update: jest.fn().mockResolvedValue(undefined),
	},
}))

const mockContext = {
	globalState: {
		get: jest.fn(),
		update: jest.fn(),
	},
} as unknown as vscode.ExtensionContext

describe("Memory Management", () => {
	let service: SemanticSearchService

	beforeEach(() => {
		service = new SemanticSearchService({
			storageDir: "/tmp",
			maxMemoryBytes: 100, // Very small limit for testing
			context: mockContext,
		})
	})

	it("should throw when memory limit is exceeded", async () => {
		const testFile = "/test/file.ts"
		await expect(service.addToIndex(testFile)).rejects.toThrow("Memory usage exceeded limit")
	})
})

describe("Memory monitoring", () => {
	let tempDir: string
	let service: SemanticSearchService
	let config: any
	let mockContext: { globalState: { get: jest.Mock; update: jest.Mock } }

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "semantic-search-test-"))
		mockContext = {
			globalState: {
				get: jest.fn(),
				update: jest.fn().mockResolvedValue(undefined),
			},
		}
		config = {
			storageDir: tempDir,
			context: mockContext as any,
			maxMemoryBytes: 1024 * 1024, // 1MB limit for testing
		}
		service = new SemanticSearchService(config)
	})

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true })
	})

	it("should track memory usage", async () => {
		const stats = await service.getMemoryStats()
		expect(stats.totalVectorMemory).toBe(0)
		expect(stats.totalMetadataMemory).toBe(0)
		expect(stats.totalCacheMemory).toBe(0)
	})

	it("should enforce memory limits", async () => {
		// Create a large vector that will exceed memory limit
		const vector = {
			values: new Array(10000).fill(1),
			dimension: 10000,
		}
		const testFile = path.join(tempDir, "test.ts")
		await expect(service.addToIndex(testFile)).rejects.toThrow("Memory usage exceeded limit")
	})
})
