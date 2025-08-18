import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { getStorageBasePath } from "../storage"

// Mock VSCode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
	window: {
		showErrorMessage: vi.fn(),
	},
}))

// Mock i18n
vi.mock("../../i18n", () => ({
	t: vi.fn((key: string) => key),
}))

describe("getStorageBasePath", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "storage-test-"))
		vi.clearAllMocks()
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
		vi.restoreAllMocks()
	})

	it("should handle concurrent storage validations without race conditions", async () => {
		const customPath = path.join(tempDir, "custom-storage")
		const defaultPath = path.join(tempDir, "default-storage")

		// Mock VSCode configuration to return custom path
		const mockConfig = {
			get: vi.fn().mockReturnValue(customPath),
			has: vi.fn().mockReturnValue(true),
			inspect: vi.fn(),
			update: vi.fn(),
		} as any

		const vscode = await import("vscode")
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig)

		// Create the custom storage directory
		await fs.mkdir(customPath, { recursive: true })

		// Run multiple concurrent storage validations
		const concurrentCalls = Array(10)
			.fill(null)
			.map(() => getStorageBasePath(defaultPath))

		// All should succeed and return the custom path
		const results = await Promise.all(concurrentCalls)

		// Verify all calls succeeded
		expect(results).toHaveLength(10)
		results.forEach((result) => {
			expect(result).toBe(customPath)
		})

		// Verify no leftover test files (all should be cleaned up with unique names)
		const dirContents = await fs.readdir(customPath)
		const testFiles = dirContents.filter((file) => file.startsWith(".write_test"))
		expect(testFiles).toHaveLength(0)
	})
})
