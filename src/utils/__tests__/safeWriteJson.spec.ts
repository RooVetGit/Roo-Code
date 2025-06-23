import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest"
import type { MockInstance, MockedObject } from "vitest"
import { Writable } from "stream" // For typing mock stream

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
		rename: vi.fn(actual.rename),
		unlink: vi.fn(actual.unlink),
		access: vi.fn(actual.access),
		mkdtemp: vi.fn(actual.mkdtemp),
		rm: vi.fn(actual.rm),
		readdir: vi.fn(actual.readdir),
		mkdir: vi.fn(actual.mkdir),
	}
})

vi.mock("fs", async () => {
	const actualFs = await vi.importActual<typeof import("fs")>("fs")
	return {
		...actualFs,
		createWriteStream: vi.fn((path: string, options?: any) => actualFs.createWriteStream(path, options)),
	}
})

// Now import the mocked versions
import * as fs from "fs/promises"
import * as fsSyncActual from "fs"
import * as path from "path"
import * as os from "os"
import { safeWriteJson } from "../safeWriteJson"
import * as properLockfile from "proper-lockfile"

// Store original implementations for reference and restoration
const originalFsPromisesRename = fsPromisesOriginal.rename
const originalFsPromisesUnlink = fsPromisesOriginal.unlink
const originalFsPromisesWriteFile = fsPromisesOriginal.writeFile
const originalFsPromisesAccess = fsPromisesOriginal.access
const originalFsPromisesMkdir = fsPromisesOriginal.mkdir

describe("safeWriteJson", () => {
	let originalConsoleError: typeof console.error
	let tempTestDir: string = ""
	let currentTestFilePath = ""

	beforeAll(() => {
		// Store original console.error
		originalConsoleError = console.error

		// Replace with filtered version that suppresses output from the module
		console.error = function (...args) {
			// Check if call originated from safeWriteJson.ts
			if (new Error().stack?.includes("safeWriteJson.ts")) {
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
		const tempDirPrefix = path.join(os.tmpdir(), "safeWriteJson-test-")
		tempTestDir = await fs.mkdtemp(tempDirPrefix)
		currentTestFilePath = path.join(tempTestDir, "test-data.json")

		// Ensure the file exists for locking purposes by default
		await fs.writeFile(currentTestFilePath, JSON.stringify({ initial: "content by beforeEach" }), "utf8")
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

	const readJsonFile = async (filePath: string): Promise<any | null> => {
		try {
			const content = await fs.readFile(filePath, "utf8") // Now uses the mocked fs
			return JSON.parse(content)
		} catch (error: any) {
			if (error && error.code === "ENOENT") {
				return null // File not found
			}
			throw error
		}
	}

	const listTempFiles = async (dir: string, baseName: string): Promise<string[]> => {
		const files = await fs.readdir(dir) // Now uses the mocked fs
		return files.filter((f: string) => f.startsWith(`.${baseName}.new_`) || f.startsWith(`.${baseName}.bak_`))
	}

	// Success Scenarios
	// Note: With the beforeEach change, this test now effectively tests overwriting the initial file.
	// If "creation from non-existence" is critical and locking prevents it, safeWriteJson or locking strategy needs review.
	test("should successfully write a new file (overwriting initial content from beforeEach)", async () => {
		const data = { message: "Hello, new world!" }
		const result = await safeWriteJson(currentTestFilePath, data)

		const writtenData = await readJsonFile(currentTestFilePath)
		expect(writtenData).toEqual(data)
		expect(result).toEqual(data)
		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		expect(tempFiles.length).toBe(0)
	})

	test("should successfully overwrite an existing file", async () => {
		const initialData = { message: "Initial content" }
		await fs.writeFile(currentTestFilePath, JSON.stringify(initialData)) // Now uses the mocked fs for setup

		const newData = { message: "Updated content" }
		await safeWriteJson(currentTestFilePath, newData)

		const writtenData = await readJsonFile(currentTestFilePath)
		expect(writtenData).toEqual(newData)
		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		expect(tempFiles.length).toBe(0)
	})

	// Failure Scenarios
	test("should handle failure when writing to tempNewFilePath", async () => {
		// currentTestFilePath exists due to beforeEach, allowing lock acquisition.
		const data = { message: "This should not be written" }

		const mockErrorStream = new Writable() as MockedObject<Writable> & { _write?: any }
		mockErrorStream._write = (_chunk: any, _encoding: any, callback: (error?: Error | null) => void) => {
			// Simulate an error during write
			callback(new Error("Simulated Stream Error: createWriteStream failed"))
		}

		// Mock createWriteStream to simulate a failure during the streaming of data to the temp file.
		;(fsSyncActual.createWriteStream as ReturnType<typeof vi.fn>).mockImplementationOnce(
			(_path: any, _options: any) => {
				const stream = new Writable({
					write(_chunk, _encoding, cb) {
						cb(new Error("Simulated Stream Error: createWriteStream failed"))
					},
					// Ensure destroy is handled to prevent unhandled rejections in stream internals
					destroy(_error, cb) {
						if (cb) cb(_error)
					},
				})
				return stream as fsSyncActual.WriteStream
			},
		)

		await expect(safeWriteJson(currentTestFilePath, data)).rejects.toThrow(
			"Simulated Stream Error: createWriteStream failed",
		)

		const writtenData = await readJsonFile(currentTestFilePath)
		// If write to .new fails, original file (from beforeEach) should remain.
		expect(writtenData).toEqual({ initial: "content by beforeEach" })
		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		expect(tempFiles.length).toBe(0) // All temp files should be cleaned up
	})

	test("should handle failure when renaming filePath to tempBackupFilePath (filePath exists)", async () => {
		const initialData = { message: "Initial content, should remain" }
		await originalFsPromisesWriteFile(currentTestFilePath, JSON.stringify(initialData)) // Use original for setup

		const newData = { message: "This should not be written" }
		const renameSpy = vi.spyOn(fs, "rename")
		// First rename is target to backup
		renameSpy.mockImplementationOnce(async (oldPath: any, newPath: any) => {
			if (typeof newPath === "string" && newPath.includes(".bak_")) {
				throw new Error("Simulated FS Error: rename to tempBackupFilePath")
			}
			return originalFsPromisesRename(oldPath, newPath) // Use constant
		})

		await expect(safeWriteJson(currentTestFilePath, newData)).rejects.toThrow(
			"Simulated FS Error: rename to tempBackupFilePath",
		)

		const writtenData = await readJsonFile(currentTestFilePath)
		expect(writtenData).toEqual(initialData) // Original file should be intact
		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		// tempNewFile was created, but should be cleaned up. Backup was not created.
		expect(tempFiles.filter((f: string) => f.includes(".new_")).length).toBe(0)
		expect(tempFiles.filter((f: string) => f.includes(".bak_")).length).toBe(0)

		renameSpy.mockRestore()
	})

	test("should handle failure when renaming tempNewFilePath to filePath (filePath exists, backup succeeded)", async () => {
		const initialData = { message: "Initial content, should be restored" }
		await fs.writeFile(currentTestFilePath, JSON.stringify(initialData)) // Use mocked fs for setup

		const newData = { message: "This is in tempNewFilePath" }
		const renameSpy = vi.spyOn(fs, "rename")
		let renameCallCountTest1 = 0
		renameSpy.mockImplementation(async (oldPath: any, newPath: any) => {
			const oldPathStr = oldPath.toString()
			const newPathStr = newPath.toString()
			renameCallCountTest1++

			// First rename call by safeWriteJson (if target exists) is target -> .bak
			if (renameCallCountTest1 === 1 && !oldPathStr.includes(".new_") && newPathStr.includes(".bak_")) {
				return originalFsPromisesRename(oldPath, newPath)
			}
			// Second rename call by safeWriteJson is .new -> target
			else if (
				renameCallCountTest1 === 2 &&
				oldPathStr.includes(".new_") &&
				path.resolve(newPathStr) === path.resolve(currentTestFilePath)
			) {
				throw new Error("Simulated FS Error: rename tempNewFilePath to filePath")
			}
			// Fallback for unexpected calls or if the target file didn't exist (only one rename: .new -> target)
			else if (
				renameCallCountTest1 === 1 &&
				oldPathStr.includes(".new_") &&
				path.resolve(newPathStr) === path.resolve(currentTestFilePath)
			) {
				// This case handles if the initial file didn't exist, so only one rename happens.
				// For this specific test, we expect two renames.
				throw new Error("Simulated FS Error: rename tempNewFilePath to filePath")
			}
			return originalFsPromisesRename(oldPath, newPath)
		})

		// This scenario should reject because the new data couldn't be written to the final path,
		// even if rollback succeeds.
		await expect(safeWriteJson(currentTestFilePath, newData)).rejects.toThrow(
			"Simulated FS Error: rename tempNewFilePath to filePath",
		)

		const writtenData = await readJsonFile(currentTestFilePath)
		expect(writtenData).toEqual(initialData) // Original file should be restored from backup

		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		expect(tempFiles.length).toBe(0) // All temp/backup files should be cleaned up

		renameSpy.mockRestore()
	})

	// Tests for directory creation functionality
	test("should create parent directory if it doesn't exist", async () => {
		// Create a path in a non-existent subdirectory of the temp dir
		const nonExistentDir = path.join(tempTestDir, "non-existent-dir")
		const filePath = path.join(nonExistentDir, "test-data.json")
		const data = { message: "Hello from new directory" }

		// Verify the directory doesn't exist yet
		const dirAccessError = await fs.access(nonExistentDir).catch((e) => e)
		expect(dirAccessError).toBeDefined()
		expect(dirAccessError.code).toBe("ENOENT")

		// safeWriteJson should now create directories and initialize an empty file automatically

		// safeWriteJson should write the file and return the data
		const result = await safeWriteJson(filePath, data)

		// Verify file was written correctly
		const writtenData = await readJsonFile(filePath)
		expect(writtenData).toEqual(data)
		expect(result).toEqual(data)

		// Verify no temp files remain
		const tempFiles = await listTempFiles(nonExistentDir, "test-data.json")
		expect(tempFiles.length).toBe(0)
	})

	test("should handle multi-level directory creation", async () => {
		// Create a new non-existent subdirectory path with multiple levels
		const newDir = path.join(tempTestDir, "new-test-dir", "subdir", "deeper")
		const filePath = path.join(newDir, "new-file.json")
		const data = { message: "New directory test" }

		// Verify directories don't exist initially
		const dirAccessError = await fs.access(newDir).catch((e) => e)
		expect(dirAccessError).toBeDefined()
		expect(dirAccessError.code).toBe("ENOENT")

		// Don't create any directories - safeWriteJson should handle it all

		// Call safeWriteJson - it should create all missing directories and the file
		const result = await safeWriteJson(filePath, data)

		// Verify all directory levels now exist
		const dirExists = await fs
			.access(newDir)
			.then(() => true)
			.catch(() => false)
		expect(dirExists).toBe(true)

		// Verify file was written correctly
		const writtenData = await readJsonFile(filePath)
		expect(writtenData).toEqual(data)

		// Check that no temp files remain
		const tempFiles = await listTempFiles(newDir, "new-file.json")
		expect(tempFiles.length).toBe(0)
	})

	test("should handle directory creation permission errors", async () => {
		// Mock mkdir to simulate a permission error
		const mkdirSpy = vi.spyOn(fs, "mkdir")
		mkdirSpy.mockImplementationOnce(async () => {
			const permError = new Error("EACCES: permission denied") as NodeJS.ErrnoException
			permError.code = "EACCES"
			throw permError
		})

		// Create test file path in a directory that will fail with permission error
		const nonExistentDir = path.join(tempTestDir, "permission-denied-dir")
		const filePath = path.join(nonExistentDir, "test-data.json")
		const testData = { message: "Should not be written due to permission error" }

		// Expect the function to fail with the permission error
		await expect(safeWriteJson(filePath, testData)).rejects.toThrow(/EACCES/)

		// Verify the file was not created
		const fileExists = await fs
			.access(filePath)
			.then(() => true)
			.catch(() => false)
		expect(fileExists).toBe(false)

		mkdirSpy.mockRestore()
	})

	// Test for console error suppression during backup deletion
	test("should suppress console.error when backup deletion fails", async () => {
		const initialData = { message: "Initial content" }
		await fs.writeFile(currentTestFilePath, JSON.stringify(initialData))
		const newData = { message: "New content" }

		// Spy on console.error to verify it's called with expected message
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// Mock unlink to fail specifically for backup files
		const unlinkSpy = vi.spyOn(fs, "unlink")
		unlinkSpy.mockImplementation(async (filePath: any) => {
			const filePathStr = filePath.toString()
			if (filePathStr.includes(".bak_")) {
				throw new Error("Backup deletion failed")
			}
			return originalFsPromisesUnlink(filePath)
		})

		// The operation should succeed despite the backup deletion failure
		await safeWriteJson(currentTestFilePath, newData)

		// Verify the file was updated correctly
		const writtenData = await readJsonFile(currentTestFilePath)
		expect(writtenData).toEqual(newData)

		// Verify console.error was called with the expected message
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Successfully wrote"),
			expect.objectContaining({ message: "Backup deletion failed" }),
		)

		// Verify backup file remains (since deletion failed)
		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		expect(tempFiles.filter((f: string) => f.includes(".bak_")).length).toBe(1)
		expect(tempFiles.filter((f: string) => f.includes(".new_")).length).toBe(0)

		// Clean up
		consoleErrorSpy.mockRestore()
		unlinkSpy.mockRestore()
	})

	test("should successfully write to a non-existent file in an existing directory", async () => {
		// Create directory but not the file
		const existingDir = path.join(tempTestDir, "existing-dir")
		await fs.mkdir(existingDir, { recursive: true })

		const filePath = path.join(existingDir, "non-existent-file.json")
		const data = { message: "Creating new file" }

		// Verify file doesn't exist before the operation
		const accessError = await fs.access(filePath).catch((e) => e)
		expect(accessError).toBeDefined()
		expect(accessError.code).toBe("ENOENT")

		// safeWriteJson should automatically create the empty file for lock acquisition

		// Write to the file
		const result = await safeWriteJson(filePath, data)

		// Verify file was created with correct content and function returned the data
		const writtenData = await readJsonFile(filePath)
		expect(writtenData).toEqual(data)
		expect(result).toEqual(data)

		// Verify no temp files remain
		const tempFiles = await listTempFiles(existingDir, "non-existent-file.json")
		expect(tempFiles.length).toBe(0)
	})

	test("should handle failure when deleting tempBackupFilePath (filePath exists, all renames succeed)", async () => {
		const initialData = { message: "Initial content" }
		await fs.writeFile(currentTestFilePath, JSON.stringify(initialData)) // Use mocked fs for setup

		const newData = { message: "This should be the final content" }
		const unlinkSpy = vi.spyOn(fs, "unlink")
		// The unlink that targets the backup file fails
		unlinkSpy.mockImplementationOnce(async (filePath: any) => {
			const filePathStr = filePath.toString()
			if (filePathStr.includes(".bak_")) {
				throw new Error("Simulated FS Error: delete tempBackupFilePath")
			}
			return originalFsPromisesUnlink(filePath)
		})

		// The function itself should still succeed from the user's perspective,
		// as the primary operation (writing the new data) was successful.
		// The error during backup cleanup is logged but not re-thrown to the caller.
		// However, the current implementation *does* re-throw. Let's test that behavior.
		// If the desired behavior is to not re-throw on backup cleanup failure, the main function needs adjustment.
		// The current safeWriteJson logic is to log the error and NOT reject.
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {}) // Suppress console.error

		await expect(safeWriteJson(currentTestFilePath, newData)).resolves.toEqual(newData)

		// The main file should be the new data
		const writtenData = await readJsonFile(currentTestFilePath)
		expect(writtenData).toEqual(newData)

		// Check that the cleanup failure was logged
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(`Successfully wrote ${currentTestFilePath}, but failed to clean up backup`),
			expect.objectContaining({ message: "Simulated FS Error: delete tempBackupFilePath" }),
		)

		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		// The .new file is gone (renamed to target), the .bak file failed to delete
		expect(tempFiles.filter((f: string) => f.includes(".new_")).length).toBe(0)
		expect(tempFiles.filter((f: string) => f.includes(".bak_")).length).toBe(1) // Backup file remains

		unlinkSpy.mockRestore()
		consoleErrorSpy.mockRestore()
	})

	// Note: With beforeEach change, currentTestFilePath will exist.
	// This test's original intent was "filePath does not exist".
	// It will now test the "filePath exists" path for the rename mock.
	// The expected error message might need to change if the mock behaves differently.
	test("should handle failure when renaming tempNewFilePath to filePath (filePath initially exists)", async () => {
		// currentTestFilePath exists due to beforeEach.
		// The original test unlinked it; we are removing that unlink to allow locking.
		const data = { message: "This should not be written" }
		const renameSpy = vi.spyOn(fs, "rename")

		// The rename from tempNew to target fails.
		// The mock needs to correctly simulate failure for the "filePath exists" case.
		// The original mock was for "no prior file".
		// For this test to be meaningful, the rename mock should simulate the failure
		// appropriately when the target file (currentTestFilePath) exists.
		// The existing complex mock in `test("should handle failure when renaming tempNewFilePath to filePath (filePath exists, backup succeeded)"`
		// might be more relevant or adaptable here.
		// For simplicity, let's use a direct mock for the second rename call (new->target).
		let renameCallCount = 0
		renameSpy.mockImplementation(async (oldPath: any, newPath: any) => {
			renameCallCount++
			const oldPathStr = oldPath.toString()
			const newPathStr = newPath.toString()

			if (renameCallCount === 1 && !oldPathStr.includes(".new_") && newPathStr.includes(".bak_")) {
				// Allow first rename (target to backup) to succeed
				return originalFsPromisesRename(oldPath, newPath)
			}
			if (
				renameCallCount === 2 &&
				oldPathStr.includes(".new_") &&
				path.resolve(newPathStr) === path.resolve(currentTestFilePath)
			) {
				// Fail the second rename (tempNew to target)
				throw new Error("Simulated FS Error: rename tempNewFilePath to existing filePath")
			}
			return originalFsPromisesRename(oldPath, newPath)
		})

		await expect(safeWriteJson(currentTestFilePath, data)).rejects.toThrow(
			"Simulated FS Error: rename tempNewFilePath to existing filePath",
		)

		// After failure, the original content (from beforeEach or backup) should be there.
		const writtenData = await readJsonFile(currentTestFilePath)
		expect(writtenData).toEqual({ initial: "content by beforeEach" }) // Expect restored content
		// The assertion was incorrect if rollback is successful.
		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		expect(tempFiles.length).toBe(0) // All temp files should be cleaned up

		renameSpy.mockRestore()
	})

	test("should throw an error if an inter-process lock is already held for the filePath", async () => {
		const data = { message: "test lock" }

		// Ensure the resource file exists
		await fs.writeFile(currentTestFilePath, "{}", "utf8")

		// Mock proper-lockfile to simulate a lock acquisition failure
		const lockSpy = vi.spyOn(properLockfile, "lock").mockRejectedValueOnce(new Error("Failed to get lock."))

		// Now test with our mock in place
		await expect(safeWriteJson(currentTestFilePath, data)).rejects.toThrow(/Failed to get lock./)

		// Verify the lock was attempted
		expect(lockSpy).toHaveBeenCalledWith(expect.stringContaining(currentTestFilePath), expect.any(Object))

		// Restore the original implementation
		lockSpy.mockRestore()
	})
	test("should release lock even if an error occurs mid-operation", async () => {
		const data = { message: "test lock release on error" }

		// Mock createWriteStream to simulate a failure during the streaming of data,
		// to test if the lock is released despite this mid-operation error.
		;(fsSyncActual.createWriteStream as ReturnType<typeof vi.fn>).mockImplementationOnce(
			(_path: any, _options: any) => {
				const stream = new Writable({
					write(_chunk, _encoding, cb) {
						cb(new Error("Simulated Stream Error during mid-operation write"))
					},
					// Ensure destroy is handled
					destroy(_error, cb) {
						if (cb) cb(_error)
					},
				})
				return stream as fsSyncActual.WriteStream
			},
		)

		await expect(safeWriteJson(currentTestFilePath, data)).rejects.toThrow(
			"Simulated Stream Error during mid-operation write",
		)

		// Lock should be released, meaning the .lock file should not exist
		const lockPath = `${path.resolve(currentTestFilePath)}.lock`
		await expect(fs.access(lockPath)).rejects.toThrow(expect.objectContaining({ code: "ENOENT" }))
	})

	test("should handle fs.access error that is not ENOENT", async () => {
		const data = { message: "access error test" }
		const accessSpy = vi.spyOn(fs, "access").mockImplementationOnce(async () => {
			const err = new Error("Simulated EACCES Error") as NodeJS.ErrnoException
			err.code = "EACCES" // Simulate a permissions error, for example
			throw err
		})

		await expect(safeWriteJson(currentTestFilePath, data)).rejects.toThrow("Simulated EACCES Error")

		// Lock should be released, meaning the .lock file should not exist
		const lockPath = `${path.resolve(currentTestFilePath)}.lock`
		await expect(fs.access(lockPath)).rejects.toThrow(expect.objectContaining({ code: "ENOENT" }))

		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		// .new file might have been created before access check, should be cleaned up
		expect(tempFiles.filter((f: string) => f.includes(".new_")).length).toBe(0)

		accessSpy.mockRestore()
	})

	// Test for rollback failure scenario
	test("should log error and re-throw original if rollback fails", async () => {
		const initialData = { message: "Initial, should be lost if rollback fails" }
		await fs.writeFile(currentTestFilePath, JSON.stringify(initialData)) // Use mocked fs for setup
		const newData = { message: "New data" }

		const renameSpy = vi.spyOn(fs, "rename")
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {}) // Suppress console.error
		let renameCallCountTest2 = 0

		renameSpy.mockImplementation(async (oldPath: any, newPath: any) => {
			const oldPathStr = oldPath.toString()
			const newPathStr = newPath.toString()
			renameCallCountTest2++
			const resolvedOldPath = path.resolve(oldPathStr)
			const resolvedNewPath = path.resolve(newPathStr)
			const resolvedCurrentTFP = path.resolve(currentTestFilePath)

			if (renameCallCountTest2 === 1) {
				// Call 1: Original -> Backup (Succeeds)
				if (resolvedOldPath === resolvedCurrentTFP && newPathStr.includes(".bak_")) {
					return originalFsPromisesRename(oldPath, newPath)
				}
				throw new Error("Unexpected args for rename call #1 in test")
			} else if (renameCallCountTest2 === 2) {
				// Call 2: New -> Original (Fails - this is the "original error")
				if (oldPathStr.includes(".new_") && resolvedNewPath === resolvedCurrentTFP) {
					throw new Error("Simulated FS Error: new to original")
				}
				throw new Error("Unexpected args for rename call #2 in test")
			} else if (renameCallCountTest2 === 3) {
				// Call 3: Backup -> Original (Rollback attempt - Fails)
				if (oldPathStr.includes(".bak_") && resolvedNewPath === resolvedCurrentTFP) {
					throw new Error("Simulated FS Error: backup to original (rollback)")
				}
				throw new Error("Unexpected args for rename call #3 in test")
			}
			return originalFsPromisesRename(oldPath, newPath)
		})

		await expect(safeWriteJson(currentTestFilePath, newData)).rejects.toThrow("Simulated FS Error: new to original")

		// Check that the rollback failure was logged
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				`Operation failed for ${path.resolve(currentTestFilePath)}: [Original Error Caught]`,
			),
			expect.objectContaining({ message: "Simulated FS Error: new to original" }), // The original error
		)
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringMatching(/\[Catch\] Failed to restore backup .*?\.bak_.*?\s+to .*?:/), // Matches the backup filename pattern
			expect.objectContaining({ message: "Simulated FS Error: backup to original (rollback)" }), // The rollback error
		)
		// The original error is logged first in safeWriteJson's catch block, then the rollback failure.

		// File system state: original file is lost (backup couldn't be restored and was then unlinked),
		// new file was cleaned up. The target path `currentTestFilePath` should not exist.
		const finalState = await readJsonFile(currentTestFilePath)
		expect(finalState).toBeNull()

		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		// Backup file should also be cleaned up by the final unlink attempt in safeWriteJson's catch block,
		// as that unlink is not mocked to fail.
		expect(tempFiles.filter((f: string) => f.includes(".bak_")).length).toBe(0)
		expect(tempFiles.filter((f: string) => f.includes(".new_")).length).toBe(0)

		renameSpy.mockRestore()
		consoleErrorSpy.mockRestore()
	})

	test("should support atomic read-modify-write transactions", async () => {
		// Create initial data
		const initialData = { counter: 5 }
		await fs.writeFile(currentTestFilePath, JSON.stringify(initialData), "utf8")

		// Perform a read-modify-write transaction
		const result = await safeWriteJson(currentTestFilePath, undefined, async (data) => {
			// Increment the counter
			data.counter += 1
			return true
		})

		// Verify the data was modified correctly and returned
		const finalContent = await fs.readFile(currentTestFilePath, "utf8")
		const finalData = JSON.parse(finalContent)
		expect(finalData).toEqual({ counter: 6 })
		expect(result).toEqual({ counter: 6 })

		// Verify no temp files remain
		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		expect(tempFiles.length).toBe(0)
	})

	test("should handle errors in read-modify-write transactions", async () => {
		// Create initial data
		const initialData = { counter: 5 }
		await fs.writeFile(currentTestFilePath, JSON.stringify(initialData), "utf8")

		// Attempt a transaction that modifies data but then throws an error
		await expect(
			safeWriteJson(currentTestFilePath, undefined, async (data) => {
				// Modify the data first
				data.counter += 10
				// Then throw an error
				throw new Error("Transaction error")
			}),
		).rejects.toThrow("Transaction error")

		// Verify the data was not modified
		const finalContent = await fs.readFile(currentTestFilePath, "utf8")
		const finalData = JSON.parse(finalContent)
		expect(finalData).toEqual(initialData)

		// Verify no temp files remain
		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		expect(tempFiles.length).toBe(0)
	})

	// Tests for parameter validation
	test("should allow default data when readModifyFn is provided", async () => {
		// Only object and array data should be allowed with readModifyFn as default value
		// Test with empty object
		const modifiedWithEmptyObject = await safeWriteJson(currentTestFilePath, {}, async (data) => {
			data.counter = 1
			return true
		})
		expect(modifiedWithEmptyObject).toEqual({ counter: 1, initial: "content by beforeEach" })

		// Create a new file path for this test to avoid interference from existing content
		const newTestPath = path.join(tempTestDir, "new-test-file.json")

		// Test with object data on a new file
		const modifiedWithObject = await safeWriteJson(newTestPath, { test: "value" }, async (data) => {
			data.counter = 1
			return true
		})
		expect(modifiedWithObject).toEqual({ counter: 1, test: "value" })

		// Test with array data on a new file
		const arrayTestPath = path.join(tempTestDir, "array-test-file.json")
		const modifiedWithArray = await safeWriteJson(arrayTestPath, ["item0"], async (data) => {
			data.push("item1")
			data.push("item2")
			return true
		})
		expect(modifiedWithArray).toEqual(["item0", "item1", "item2"])
	})

	test("should throw error when readModifyFn is not provided and data is undefined", async () => {
		await expect(safeWriteJson(currentTestFilePath, undefined)).rejects.toThrow(
			"When not using readModifyFn, data must be provided",
		)
	})

	test("should allow undefined data when readModifyFn is provided and return the modified data", async () => {
		// Create initial data
		const initialData = { counter: 5 }
		await fs.writeFile(currentTestFilePath, JSON.stringify(initialData), "utf8")

		// Use undefined data with readModifyFn
		const result = await safeWriteJson(currentTestFilePath, undefined, async (data) => {
			data.counter += 1
			return true
		})

		// Verify the data was modified correctly and returned
		const finalContent = await fs.readFile(currentTestFilePath, "utf8")
		const finalData = JSON.parse(finalContent)
		expect(finalData).toEqual({ counter: 6 })
		expect(result).toEqual({ counter: 6 })
	})
})
