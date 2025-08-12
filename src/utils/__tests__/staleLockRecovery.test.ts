import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { detectStaleLocks, recoverStaleLocks, performStartupStaleLockRecovery } from "../staleLockRecovery"
import { GlobalFileNames } from "../../shared/globalFileNames"

describe("staleLockRecovery", () => {
	let tempDir: string
	let globalStoragePath: string
	let tasksDir: string

	beforeEach(async () => {
		// Create a temporary directory for testing
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "stale-lock-test-"))
		globalStoragePath = tempDir
		tasksDir = path.join(globalStoragePath, "tasks")
		await fs.mkdir(tasksDir, { recursive: true })
	})

	afterEach(async () => {
		// Clean up temporary directory
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe("detectStaleLocks", () => {
		it("should return empty array when no tasks exist", async () => {
			const results = await detectStaleLocks(globalStoragePath)
			expect(results).toEqual([])
		})

		it("should detect task with lock files and missing ui_messages.json", async () => {
			// Create a task directory with lock files but no ui_messages.json
			const taskId = "test-task-1"
			const taskPath = path.join(tasksDir, taskId)
			await fs.mkdir(taskPath)

			// Create lock files
			await fs.writeFile(path.join(taskPath, "file1.lock"), "")
			await fs.writeFile(path.join(taskPath, "file2.lock"), "")

			// Make lock files old enough to be stale
			const oldTime = new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
			await fs.utimes(path.join(taskPath, "file1.lock"), oldTime, oldTime)
			await fs.utimes(path.join(taskPath, "file2.lock"), oldTime, oldTime)

			const results = await detectStaleLocks(globalStoragePath)

			expect(results).toHaveLength(1)
			expect(results[0]).toMatchObject({
				taskId,
				taskPath,
				hasLockFiles: true,
				hasUiMessagesFile: false,
				lockFiles: expect.arrayContaining(["file1.lock", "file2.lock"]),
				isStale: true,
			})
		})

		it("should not mark as stale when ui_messages.json exists", async () => {
			// Create a task directory with lock files and ui_messages.json
			const taskId = "test-task-2"
			const taskPath = path.join(tasksDir, taskId)
			await fs.mkdir(taskPath)

			// Create lock files
			await fs.writeFile(path.join(taskPath, "file1.lock"), "")

			// Create ui_messages.json
			await fs.writeFile(path.join(taskPath, GlobalFileNames.uiMessages), "[]")

			// Make lock file old
			const oldTime = new Date(Date.now() - 15 * 60 * 1000)
			await fs.utimes(path.join(taskPath, "file1.lock"), oldTime, oldTime)

			const results = await detectStaleLocks(globalStoragePath)

			expect(results).toHaveLength(1)
			expect(results[0]).toMatchObject({
				taskId,
				hasLockFiles: true,
				hasUiMessagesFile: true,
				isStale: false,
			})
		})

		it("should not mark as stale when lock files are recent", async () => {
			// Create a task directory with recent lock files
			const taskId = "test-task-3"
			const taskPath = path.join(tasksDir, taskId)
			await fs.mkdir(taskPath)

			// Create recent lock file
			await fs.writeFile(path.join(taskPath, "file1.lock"), "")

			const results = await detectStaleLocks(globalStoragePath, {
				maxLockAge: 10 * 60 * 1000, // 10 minutes
			})

			expect(results).toHaveLength(1)
			expect(results[0]).toMatchObject({
				taskId,
				hasLockFiles: true,
				hasUiMessagesFile: false,
				isStale: false,
			})
		})

		it("should handle multiple tasks correctly", async () => {
			// Create multiple tasks with different states
			const task1 = "task-1"
			const task1Path = path.join(tasksDir, task1)
			await fs.mkdir(task1Path)
			await fs.writeFile(path.join(task1Path, "file.lock"), "")

			const task2 = "task-2"
			const task2Path = path.join(tasksDir, task2)
			await fs.mkdir(task2Path)
			await fs.writeFile(path.join(task2Path, "file.lock"), "")
			await fs.writeFile(path.join(task2Path, GlobalFileNames.uiMessages), "[]")

			// Make task1 lock stale
			const oldTime = new Date(Date.now() - 15 * 60 * 1000)
			await fs.utimes(path.join(task1Path, "file.lock"), oldTime, oldTime)

			const results = await detectStaleLocks(globalStoragePath)

			expect(results).toHaveLength(2)
			expect(results.find((r) => r.taskId === task1)?.isStale).toBe(true)
			expect(results.find((r) => r.taskId === task2)?.isStale).toBe(false)
		})
	})

	describe("recoverStaleLocks", () => {
		it("should remove lock files and create ui_messages.json for stale tasks", async () => {
			// Create a stale task
			const taskId = "stale-task"
			const taskPath = path.join(tasksDir, taskId)
			await fs.mkdir(taskPath)

			const lockFile1 = path.join(taskPath, "file1.lock")
			const lockFile2 = path.join(taskPath, "file2.lock")
			await fs.writeFile(lockFile1, "")
			await fs.writeFile(lockFile2, "")

			const detectionResults = [
				{
					taskId,
					taskPath,
					hasLockFiles: true,
					hasUiMessagesFile: false,
					lockFiles: ["file1.lock", "file2.lock"],
					isStale: true,
					oldestLockAge: 15 * 60 * 1000,
				},
			]

			await recoverStaleLocks(detectionResults)

			// Check that lock files were removed
			await expect(fs.access(lockFile1)).rejects.toThrow()
			await expect(fs.access(lockFile2)).rejects.toThrow()

			// Check that ui_messages.json was created
			const uiMessagesPath = path.join(taskPath, GlobalFileNames.uiMessages)
			const uiMessagesContent = await fs.readFile(uiMessagesPath, "utf8")
			expect(uiMessagesContent).toBe("[]")
		})

		it("should not recover non-stale tasks", async () => {
			// Create a non-stale task
			const taskId = "non-stale-task"
			const taskPath = path.join(tasksDir, taskId)
			await fs.mkdir(taskPath)

			const lockFile = path.join(taskPath, "file.lock")
			await fs.writeFile(lockFile, "")

			const detectionResults = [
				{
					taskId,
					taskPath,
					hasLockFiles: true,
					hasUiMessagesFile: false,
					lockFiles: ["file.lock"],
					isStale: false,
					oldestLockAge: 5 * 60 * 1000,
				},
			]

			await recoverStaleLocks(detectionResults)

			// Check that lock file was NOT removed
			await expect(fs.access(lockFile)).resolves.toBeUndefined()

			// Check that ui_messages.json was NOT created
			const uiMessagesPath = path.join(taskPath, GlobalFileNames.uiMessages)
			await expect(fs.access(uiMessagesPath)).rejects.toThrow()
		})

		it("should respect autoRecover config", async () => {
			// Create a stale task
			const taskId = "stale-task"
			const taskPath = path.join(tasksDir, taskId)
			await fs.mkdir(taskPath)

			const lockFile = path.join(taskPath, "file.lock")
			await fs.writeFile(lockFile, "")

			const detectionResults = [
				{
					taskId,
					taskPath,
					hasLockFiles: true,
					hasUiMessagesFile: false,
					lockFiles: ["file.lock"],
					isStale: true,
					oldestLockAge: 15 * 60 * 1000,
				},
			]

			// Disable auto recovery
			await recoverStaleLocks(detectionResults, { autoRecover: false })

			// Check that lock file was NOT removed
			await expect(fs.access(lockFile)).resolves.toBeUndefined()
		})

		it("should handle errors gracefully", async () => {
			// Create a mock console.error to suppress error output in tests
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Create invalid detection results
			const detectionResults = [
				{
					taskId: "invalid-task",
					taskPath: "/invalid/path/that/does/not/exist",
					hasLockFiles: true,
					hasUiMessagesFile: false,
					lockFiles: ["file.lock"],
					isStale: true,
					oldestLockAge: 15 * 60 * 1000,
				},
			]

			// Should not throw
			await expect(recoverStaleLocks(detectionResults)).resolves.toBeUndefined()

			// Should have logged errors
			expect(consoleErrorSpy).toHaveBeenCalled()

			consoleErrorSpy.mockRestore()
		})
	})

	describe("performStartupStaleLockRecovery", () => {
		it("should detect and recover stale locks on startup", async () => {
			// Create a stale task
			const taskId = "startup-stale-task"
			const taskPath = path.join(tasksDir, taskId)
			await fs.mkdir(taskPath)

			const lockFile = path.join(taskPath, "file.lock")
			await fs.writeFile(lockFile, "")

			// Make lock file old
			const oldTime = new Date(Date.now() - 15 * 60 * 1000)
			await fs.utimes(lockFile, oldTime, oldTime)

			// Mock console.log to verify logging
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			await performStartupStaleLockRecovery(globalStoragePath)

			// Check that lock file was removed
			await expect(fs.access(lockFile)).rejects.toThrow()

			// Check that ui_messages.json was created
			const uiMessagesPath = path.join(taskPath, GlobalFileNames.uiMessages)
			const uiMessagesContent = await fs.readFile(uiMessagesPath, "utf8")
			expect(uiMessagesContent).toBe("[]")

			// Check that appropriate logs were made
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Starting stale lock detection"))
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Found 1 task(s) with stale locks"))
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Recovery completed"))

			consoleLogSpy.mockRestore()
		})

		it("should handle errors gracefully", async () => {
			// Mock console methods
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Use invalid path
			await performStartupStaleLockRecovery("/invalid/path/that/does/not/exist")

			// Should have logged error
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("No stale locks detected"))

			consoleLogSpy.mockRestore()
			consoleErrorSpy.mockRestore()
		})
	})
})
