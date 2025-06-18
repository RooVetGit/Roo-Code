import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest"
import { safeReadJson } from "../safeReadJson"
import { Readable } from "stream" // For typing mock stream

// First import the original modules to use their types
import * as fsPromisesOriginal from "fs/promises"
import * as fsOriginal from "fs"

// Set up mocks before imports
vi.mock("proper-lockfile", () => ({
	lock: vi.fn(),
	check: vi.fn(),
	unlock: vi.fn(),
}))

vi.mock("fs/promises", async () => {
	const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises")
	return {
		...actual,
		writeFile: vi.fn(actual.writeFile),
		readFile: vi.fn(actual.readFile),
		access: vi.fn(actual.access),
		mkdir: vi.fn(actual.mkdir),
		mkdtemp: vi.fn(actual.mkdtemp),
		rm: vi.fn(actual.rm),
	}
})

vi.mock("fs", async () => {
	const actualFs = await vi.importActual<typeof import("fs")>("fs")
	return {
		...actualFs,
		createReadStream: vi.fn((path: string, options?: any) => actualFs.createReadStream(path, options)),
	}
})

// Now import the mocked versions
import * as fs from "fs/promises"
import * as fsSyncActual from "fs"
import * as path from "path"
import * as os from "os"
import * as properLockfile from "proper-lockfile"

describe("safeReadJson", () => {
	let originalConsoleError: typeof console.error
	let tempTestDir: string = ""
	let currentTestFilePath = ""

	beforeAll(() => {
		// Store original console.error
		originalConsoleError = console.error

		// Replace with filtered version that suppresses output from the module
		console.error = function (...args) {
			// Check if call originated from safeReadJson.ts
			if (new Error().stack?.includes("safeReadJson.ts")) {
				// Suppress output but allow spy recording
				return
			}

			// Pass through all other calls (from tests)
			return originalConsoleError.apply(console, args)
		}
	})

	afterAll(() => {
		// Restore original behavior
		console.error = originalConsoleError
	})

	vi.useRealTimers() // Use real timers for this test suite

	beforeEach(async () => {
		// Create a unique temporary directory for each test
		const tempDirPrefix = path.join(os.tmpdir(), "safeReadJson-test-")
		tempTestDir = await fs.mkdtemp(tempDirPrefix)
		currentTestFilePath = path.join(tempTestDir, "test-data.json")
	})

	afterEach(async () => {
		if (tempTestDir) {
			try {
				await fs.rm(tempTestDir, { recursive: true, force: true })
			} catch (err) {
				console.error("Failed to clean up temp directory", err)
			}
			tempTestDir = ""
		}

		// Reset all mocks
		vi.resetAllMocks()
	})

	// Helper function to write a JSON file for testing
	const writeJsonFile = async (filePath: string, data: any): Promise<void> => {
		await fs.writeFile(filePath, JSON.stringify(data), "utf8")
	}

	// Success Scenarios
	test("should successfully read a JSON file", async () => {
		const testData = { message: "Hello, world!" }
		await writeJsonFile(currentTestFilePath, testData)

		const result = await safeReadJson(currentTestFilePath)
		expect(result).toEqual(testData)
	})

	test("should throw an error for a non-existent file", async () => {
		const nonExistentPath = path.join(tempTestDir, "non-existent.json")

		await expect(safeReadJson(nonExistentPath)).rejects.toThrow(/ENOENT/)
	})

	test("should read a specific path from a JSON file", async () => {
		const testData = {
			user: {
				name: "John",
				age: 30,
				address: {
					city: "New York",
					zip: "10001",
				},
			},
			settings: {
				theme: "dark",
				notifications: true,
			},
		}
		await writeJsonFile(currentTestFilePath, testData)

		// Test reading a specific path
		const result = await safeReadJson(currentTestFilePath, "user.address.city")
		expect(result).toBe("New York")
	})

	test("should read multiple paths from a JSON file", async () => {
		const testData = {
			user: {
				name: "John",
				age: 30,
			},
			settings: {
				theme: "dark",
				notifications: true,
			},
		}
		await writeJsonFile(currentTestFilePath, testData)

		// Test reading multiple paths
		const result = await safeReadJson(currentTestFilePath, ["user.name", "settings.theme"])
		expect(result).toEqual(["John", "dark"])
	})

	// Failure Scenarios
	test("should handle JSON parsing errors", async () => {
		// Write invalid JSON
		await fs.writeFile(currentTestFilePath, "{ invalid: json", "utf8")

		await expect(safeReadJson(currentTestFilePath)).rejects.toThrow()
	})

	test("should handle file access errors", async () => {
		const accessSpy = vi.spyOn(fs, "access")
		accessSpy.mockImplementationOnce(async () => {
			const err = new Error("Simulated EACCES Error") as NodeJS.ErrnoException
			err.code = "EACCES" // Simulate a permissions error
			throw err
		})

		await expect(safeReadJson(currentTestFilePath)).rejects.toThrow("Simulated EACCES Error")

		accessSpy.mockRestore()
	})

	test("should handle stream errors", async () => {
		await writeJsonFile(currentTestFilePath, { test: "data" })

		// Mock createReadStream to simulate a failure during streaming
		;(fsSyncActual.createReadStream as ReturnType<typeof vi.fn>).mockImplementationOnce(
			(_path: any, _options: any) => {
				const stream = new Readable({
					read() {
						this.emit("error", new Error("Simulated Stream Error"))
					},
				})
				return stream as fsSyncActual.ReadStream
			},
		)

		await expect(safeReadJson(currentTestFilePath)).rejects.toThrow("Simulated Stream Error")
	})

	test("should handle lock acquisition failures", async () => {
		await writeJsonFile(currentTestFilePath, { test: "data" })

		// Mock proper-lockfile to simulate a lock acquisition failure
		const lockSpy = vi.spyOn(properLockfile, "lock").mockRejectedValueOnce(new Error("Failed to get lock"))

		await expect(safeReadJson(currentTestFilePath)).rejects.toThrow("Failed to get lock")

		expect(lockSpy).toHaveBeenCalledWith(expect.stringContaining(currentTestFilePath), expect.any(Object))

		lockSpy.mockRestore()
	})

	test("should release lock even if an error occurs during reading", async () => {
		await writeJsonFile(currentTestFilePath, { test: "data" })

		// Mock createReadStream to simulate a failure during streaming
		;(fsSyncActual.createReadStream as ReturnType<typeof vi.fn>).mockImplementationOnce(
			(_path: any, _options: any) => {
				const stream = new Readable({
					read() {
						this.emit("error", new Error("Simulated Stream Error"))
					},
				})
				return stream as fsSyncActual.ReadStream
			},
		)

		await expect(safeReadJson(currentTestFilePath)).rejects.toThrow("Simulated Stream Error")

		// Lock should be released, meaning the .lock file should not exist
		const lockPath = `${path.resolve(currentTestFilePath)}.lock`
		await expect(fs.access(lockPath)).rejects.toThrow(expect.objectContaining({ code: "ENOENT" }))
	})

	// Edge Cases
	test("should handle empty JSON files", async () => {
		await fs.writeFile(currentTestFilePath, "", "utf8")

		await expect(safeReadJson(currentTestFilePath)).rejects.toThrow()
	})

	test("should handle large JSON files", async () => {
		// Create a large JSON object
		const largeData: Record<string, number> = {}
		for (let i = 0; i < 10000; i++) {
			largeData[`key${i}`] = i
		}

		await writeJsonFile(currentTestFilePath, largeData)

		const result = await safeReadJson(currentTestFilePath)
		expect(result).toEqual(largeData)
	})

	test("should handle path selection for non-existent paths", async () => {
		const testData = { user: { name: "John" } }
		await writeJsonFile(currentTestFilePath, testData)

		// Test reading a non-existent path
		const result = await safeReadJson(currentTestFilePath, "user.address")
		expect(result).toBeUndefined()
	})
})
