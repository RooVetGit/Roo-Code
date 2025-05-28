const actualFsPromises = jest.requireActual("fs/promises")
const originalFsPromisesRename = actualFsPromises.rename
const originalFsPromisesUnlink = actualFsPromises.unlink
const originalFsPromisesWriteFile = actualFsPromises.writeFile
const _originalFsPromisesAccess = actualFsPromises.access

jest.mock("fs/promises", () => {
	const actual = jest.requireActual("fs/promises")
	// Start with all actual implementations.
	const mockedFs = { ...actual }

	// Selectively wrap functions with jest.fn() if they are spied on
	// or have their implementations changed in tests.
	// This ensures that other fs.promises functions used by the SUT
	// (like proper-lockfile's internals) will use their actual implementations.
	mockedFs.writeFile = jest.fn(actual.writeFile)
	mockedFs.readFile = jest.fn(actual.readFile)
	mockedFs.rename = jest.fn(actual.rename)
	mockedFs.unlink = jest.fn(actual.unlink)
	mockedFs.access = jest.fn(actual.access)
	mockedFs.mkdtemp = jest.fn(actual.mkdtemp)
	mockedFs.rm = jest.fn(actual.rm)
	mockedFs.readdir = jest.fn(actual.readdir)
	// fs.stat and fs.lstat will be available via { ...actual }

	return mockedFs
})

import * as fs from "fs/promises" // This will now be the mocked version
import * as path from "path"
import * as os from "os"
// import * as lockfile from 'proper-lockfile' // No longer directly used in tests
import { safeWriteJson } from "../safeWriteJson"

describe("safeWriteJson", () => {
	jest.useRealTimers() // Use real timers for this test suite

	let tempTestDir: string = ""
	let currentTestFilePath = ""

	beforeEach(async () => {
		// Create a unique temporary directory for each test
		const tempDirPrefix = path.join(os.tmpdir(), "safeWriteJson-test-")
		tempTestDir = await fs.mkdtemp(tempDirPrefix)
		currentTestFilePath = path.join(tempTestDir, "test-data.json")
		// Individual tests will now handle creation of currentTestFilePath if needed.
	})

	afterEach(async () => {
		if (tempTestDir) {
			await fs.rm(tempTestDir, { recursive: true, force: true })
			tempTestDir = ""
		}
		// activeLocks is no longer used

		// Explicitly reset mock implementations to default (actual) behavior
		// This helps prevent state leakage between tests if spy.mockRestore() isn't fully effective
		// for functions on the module mock created by the factory.
		;(fs.writeFile as jest.Mock).mockImplementation(actualFsPromises.writeFile)
		;(fs.rename as jest.Mock).mockImplementation(actualFsPromises.rename)
		;(fs.unlink as jest.Mock).mockImplementation(actualFsPromises.unlink)
		;(fs.access as jest.Mock).mockImplementation(actualFsPromises.access)
		;(fs.readFile as jest.Mock).mockImplementation(actualFsPromises.readFile)
		;(fs.mkdtemp as jest.Mock).mockImplementation(actualFsPromises.mkdtemp)
		;(fs.rm as jest.Mock).mockImplementation(actualFsPromises.rm)
		;(fs.readdir as jest.Mock).mockImplementation(actualFsPromises.readdir)
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
	test("should successfully write a new file when filePath does not exist", async () => {
		const data = { message: "Hello, new world!" }
		await safeWriteJson(currentTestFilePath, data)

		const writtenData = await readJsonFile(currentTestFilePath)
		expect(writtenData).toEqual(data)
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
		// Ensure the target file does not exist for this test.
		try {
			await fs.unlink(currentTestFilePath)
		} catch (e: any) {
			if (e.code !== "ENOENT") throw e
		}

		const data = { message: "This should not be written" }
		const writeFileSpy = jest.spyOn(fs, "writeFile")
		// Make the first call to writeFile (for tempNewFilePath) fail
		writeFileSpy.mockImplementationOnce(async (filePath: any, fileData: any, options?: any) => {
			if (typeof filePath === "string" && filePath.includes(".new_")) {
				throw new Error("Simulated FS Error: writeFile tempNewFilePath")
			}
			// For any other writeFile call (e.g. if tests write initial files), use original
			return actualFsPromises.writeFile(filePath, fileData, options) // Call actual for passthrough
		})

		await expect(safeWriteJson(currentTestFilePath, data)).rejects.toThrow(
			"Simulated FS Error: writeFile tempNewFilePath",
		)

		const writtenData = await readJsonFile(currentTestFilePath)
		expect(writtenData).toBeNull() // File should not exist or be created
		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		expect(tempFiles.length).toBe(0) // All temp files should be cleaned up

		writeFileSpy.mockRestore()
	})

	test("should handle failure when renaming filePath to tempBackupFilePath (filePath exists)", async () => {
		const initialData = { message: "Initial content, should remain" }
		await originalFsPromisesWriteFile(currentTestFilePath, JSON.stringify(initialData)) // Use original for setup

		const newData = { message: "This should not be written" }
		const renameSpy = jest.spyOn(fs, "rename")
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
		const renameSpy = jest.spyOn(fs, "rename")
		let renameCallCountTest1 = 0
		renameSpy.mockImplementation(async (oldPath: any, newPath: any) => {
			const oldPathStr = oldPath.toString()
			const newPathStr = newPath.toString()
			renameCallCountTest1++
			console.log(`[TEST 1] fs.rename spy call #${renameCallCountTest1}: ${oldPathStr} -> ${newPathStr}`)

			// First rename call by safeWriteJson (if target exists) is target -> .bak
			if (renameCallCountTest1 === 1 && !oldPathStr.includes(".new_") && newPathStr.includes(".bak_")) {
				console.log("[TEST 1] Spy: Call #1 (target->backup), executing original rename.")
				return originalFsPromisesRename(oldPath, newPath)
			}
			// Second rename call by safeWriteJson is .new -> target
			else if (
				renameCallCountTest1 === 2 &&
				oldPathStr.includes(".new_") &&
				path.resolve(newPathStr) === path.resolve(currentTestFilePath)
			) {
				console.log("[TEST 1] Spy: Call #2 (.new->target), THROWING SIMULATED ERROR.")
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
				console.warn(
					"[TEST 1] Spy: Call #1 was .new->target, (unexpected for this test scenario, but handling)",
				)
				throw new Error("Simulated FS Error: rename tempNewFilePath to filePath")
			}
			console.warn(
				`[TEST 1] Spy: Unexpected call #${renameCallCountTest1} or paths. Defaulting to original rename. ${oldPathStr} -> ${newPathStr}`,
			)
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

	test("should handle failure when deleting tempBackupFilePath (filePath exists, all renames succeed)", async () => {
		const initialData = { message: "Initial content" }
		await fs.writeFile(currentTestFilePath, JSON.stringify(initialData)) // Use mocked fs for setup

		const newData = { message: "This should be the final content" }
		const unlinkSpy = jest.spyOn(fs, "unlink")
		// The unlink that targets the backup file fails
		unlinkSpy.mockImplementationOnce(async (filePath: any) => {
			const filePathStr = filePath.toString()
			if (filePathStr.includes(".bak_")) {
				console.log("[TEST unlink bak] Mock: Simulating failure for unlink backup.")
				throw new Error("Simulated FS Error: delete tempBackupFilePath")
			}
			console.log("[TEST unlink bak] Mock: Condition NOT MET. Using originalFsPromisesUnlink.")
			return originalFsPromisesUnlink(filePath)
		})

		// The function itself should still succeed from the user's perspective,
		// as the primary operation (writing the new data) was successful.
		// The error during backup cleanup is logged but not re-thrown to the caller.
		// However, the current implementation *does* re-throw. Let's test that behavior.
		// If the desired behavior is to not re-throw on backup cleanup failure, the main function needs adjustment.
		// The current safeWriteJson logic is to log the error and NOT reject.
		const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {}) // Suppress console.error

		await expect(safeWriteJson(currentTestFilePath, newData)).resolves.toBeUndefined()

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

	test("should handle failure when renaming tempNewFilePath to filePath (filePath does not exist)", async () => {
		// Ensure the target file does not exist for this test.
		try {
			await fs.unlink(currentTestFilePath)
		} catch (e: any) {
			if (e.code !== "ENOENT") throw e
		}

		const data = { message: "This should not be written" }
		const renameSpy = jest.spyOn(fs, "rename")
		// The rename from tempNew to target fails
		renameSpy.mockImplementationOnce(async (oldPath: any, newPath: any) => {
			const oldPathStr = oldPath.toString()
			const newPathStr = newPath.toString()
			if (oldPathStr.includes(".new_") && path.resolve(newPathStr) === path.resolve(currentTestFilePath)) {
				throw new Error("Simulated FS Error: rename tempNewFilePath to filePath (no prior file)")
			}
			return originalFsPromisesRename(oldPath, newPath) // Use constant
		})

		await expect(safeWriteJson(currentTestFilePath, data)).rejects.toThrow(
			"Simulated FS Error: rename tempNewFilePath to filePath (no prior file)",
		)

		const writtenData = await readJsonFile(currentTestFilePath)
		expect(writtenData).toBeNull() // File should not exist
		const tempFiles = await listTempFiles(tempTestDir, "test-data.json")
		expect(tempFiles.length).toBe(0) // All temp files should be cleaned up

		renameSpy.mockRestore()
	})

	test("should throw an error if an inter-process lock is already held for the filePath", async () => {
		jest.resetModules() // Clear module cache to ensure fresh imports for this test

		const data = { message: "test lock" }
		// Ensure the resource file exists.
		await fs.writeFile(currentTestFilePath, "{}", "utf8")

		// Temporarily mock proper-lockfile for this test only
		jest.doMock("proper-lockfile", () => ({
			...jest.requireActual("proper-lockfile"),
			lock: jest.fn().mockRejectedValueOnce(new Error("Failed to get lock.")),
		}))

		// Re-require safeWriteJson so it picks up the mocked proper-lockfile
		const { safeWriteJson: safeWriteJsonWithMockedLock } =
			require("../safeWriteJson") as typeof import("../safeWriteJson")

		try {
			await expect(safeWriteJsonWithMockedLock(currentTestFilePath, data)).rejects.toThrow(
				/Failed to get lock.|Lock file is already being held/i,
			)
		} finally {
			jest.unmock("proper-lockfile") // Ensure the mock is removed after this test
		}
	})
	test("should release lock even if an error occurs mid-operation", async () => {
		const data = { message: "test lock release on error" }
		const writeFileSpy = jest.spyOn(fs, "writeFile").mockImplementationOnce(async () => {
			throw new Error("Simulated FS Error during writeFile")
		})

		await expect(safeWriteJson(currentTestFilePath, data)).rejects.toThrow("Simulated FS Error during writeFile")

		// Lock should be released, meaning the .lock file should not exist
		const lockPath = `${path.resolve(currentTestFilePath)}.lock`
		await expect(fs.access(lockPath)).rejects.toThrow(expect.objectContaining({ code: "ENOENT" }))

		writeFileSpy.mockRestore()
	})

	test("should handle fs.access error that is not ENOENT", async () => {
		const data = { message: "access error test" }
		const accessSpy = jest.spyOn(fs, "access").mockImplementationOnce(async () => {
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

		const renameSpy = jest.spyOn(fs, "rename")
		const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {}) // Suppress console.error
		let renameCallCountTest2 = 0

		renameSpy.mockImplementation(async (oldPath: any, newPath: any) => {
			const oldPathStr = oldPath.toString()
			const newPathStr = newPath.toString()
			renameCallCountTest2++
			const resolvedOldPath = path.resolve(oldPathStr)
			const resolvedNewPath = path.resolve(newPathStr)
			const resolvedCurrentTFP = path.resolve(currentTestFilePath)
			console.log(
				`[TEST 2] fs.promises.rename call #${renameCallCountTest2}: oldPath=${oldPathStr} (resolved: ${resolvedOldPath}), newPath=${newPathStr} (resolved: ${resolvedNewPath}), currentTFP (resolved: ${resolvedCurrentTFP})`,
			)

			if (renameCallCountTest2 === 1) {
				// Call 1: Original -> Backup (Succeeds)
				if (resolvedOldPath === resolvedCurrentTFP && newPathStr.includes(".bak_")) {
					console.log("[TEST 2] Call #1 (Original->Backup): Condition MET. originalFsPromisesRename.")
					return originalFsPromisesRename(oldPath, newPath)
				}
				console.error("[TEST 2] Call #1: UNEXPECTED args.")
				throw new Error("Unexpected args for rename call #1 in test")
			} else if (renameCallCountTest2 === 2) {
				// Call 2: New -> Original (Fails - this is the "original error")
				if (oldPathStr.includes(".new_") && resolvedNewPath === resolvedCurrentTFP) {
					console.log(
						'[TEST 2] Call #2 (New->Original): Condition MET. Throwing "Simulated FS Error: new to original".',
					)
					throw new Error("Simulated FS Error: new to original")
				}
				console.error("[TEST 2] Call #2: UNEXPECTED args.")
				throw new Error("Unexpected args for rename call #2 in test")
			} else if (renameCallCountTest2 === 3) {
				// Call 3: Backup -> Original (Rollback attempt - Fails)
				if (oldPathStr.includes(".bak_") && resolvedNewPath === resolvedCurrentTFP) {
					console.log(
						'[TEST 2] Call #3 (Backup->Original Rollback): Condition MET. Throwing "Simulated FS Error: backup to original (rollback)".',
					)
					throw new Error("Simulated FS Error: backup to original (rollback)")
				}
				console.error("[TEST 2] Call #3: UNEXPECTED args.")
				throw new Error("Unexpected args for rename call #3 in test")
			}
			console.error(`[TEST 2] Unexpected fs.promises.rename call count: ${renameCallCountTest2}`)
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
})
