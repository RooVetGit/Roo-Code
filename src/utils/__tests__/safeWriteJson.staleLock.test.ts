import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { safeWriteJson } from "../safeWriteJson"

describe("safeWriteJson - stale lock handling", () => {
	let tempDir: string
	let testFilePath: string

	beforeEach(async () => {
		// Create a temporary directory for testing
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "safe-write-json-stale-lock-test-"))
		testFilePath = path.join(tempDir, "test.json")
	})

	afterEach(async () => {
		// Clean up temporary directory
		await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
		// Clean up any stray lock files
		try {
			await fs.unlink(`${testFilePath}.lock`)
		} catch {
			// Ignore if doesn't exist
		}
	})

	it("should create file before acquiring lock if file doesn't exist", async () => {
		// Ensure file doesn't exist
		await expect(fs.access(testFilePath)).rejects.toThrow()

		// Write data
		const testData = { test: "data" }
		await safeWriteJson(testFilePath, testData)

		// Verify file was created with correct content
		const content = await fs.readFile(testFilePath, "utf8")
		expect(JSON.parse(content)).toEqual(testData)
	})

	it("should handle missing target file by creating it first", async () => {
		// Ensure file doesn't exist
		await expect(fs.access(testFilePath)).rejects.toThrow()

		// Write data - should succeed by creating the file first
		const testData = { test: "data for missing file" }
		await safeWriteJson(testFilePath, testData)

		// Verify file was created with correct content
		const content = await fs.readFile(testFilePath, "utf8")
		expect(JSON.parse(content)).toEqual(testData)
	})

	it("should work normally when file already exists", async () => {
		// Create file first
		const initialData = { initial: "content" }
		await fs.writeFile(testFilePath, JSON.stringify(initialData))

		// Write new data
		const newData = { updated: "content" }
		await safeWriteJson(testFilePath, newData)

		// Verify file was updated
		const content = await fs.readFile(testFilePath, "utf8")
		expect(JSON.parse(content)).toEqual(newData)
	})

	it("should handle concurrent writes correctly", async () => {
		// Create file first
		await fs.writeFile(testFilePath, JSON.stringify({ initial: "data" }))

		// Attempt concurrent writes
		const writes = []
		for (let i = 0; i < 5; i++) {
			writes.push(safeWriteJson(testFilePath, { count: i }))
		}

		// All writes should complete without error
		await expect(Promise.all(writes)).resolves.toBeDefined()

		// File should contain data from one of the writes
		const content = await fs.readFile(testFilePath, "utf8")
		const data = JSON.parse(content)
		expect(data).toHaveProperty("count")
		expect(typeof data.count).toBe("number")
	})

	it("should handle temporary files correctly", async () => {
		// Create initial file
		const initialData = { initial: "data", important: true }
		await fs.writeFile(testFilePath, JSON.stringify(initialData))

		// Write new data multiple times to ensure temp files are cleaned up
		for (let i = 0; i < 3; i++) {
			const newData = { updated: "content", iteration: i }
			await safeWriteJson(testFilePath, newData)

			// Verify file was updated
			const content = await fs.readFile(testFilePath, "utf8")
			expect(JSON.parse(content)).toEqual(newData)
		}

		// Check that no temp files remain in the directory
		const files = await fs.readdir(tempDir)
		const tempFiles = files.filter((f) => f.includes(".tmp") || f.includes(".bak"))
		expect(tempFiles).toHaveLength(0)
	})
})
