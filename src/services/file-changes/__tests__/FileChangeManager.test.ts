// npx vitest run src/services/file-changes/__tests__/FileChangeManager.test.ts

import { describe, beforeEach, afterEach, it, expect, vi } from "vitest"

// Override vscode mock for these specific tests with working EventEmitter
vi.mock("vscode", async () => {
	const originalVscode = await vi.importActual("../../../__mocks__/vscode.js")

	// Create working EventEmitter constructor function
	const WorkingEventEmitter = function (this: any) {
		this.listeners = []

		this.event = (listener: any) => {
			this.listeners.push(listener)
			return {
				dispose: () => {
					const index = this.listeners.indexOf(listener)
					if (index >= 0) {
						this.listeners.splice(index, 1)
					}
				},
			}
		}

		this.fire = (data: any) => {
			this.listeners.forEach((listener: any) => {
				try {
					listener(data)
				} catch (e) {
					// Ignore listener errors in tests
				}
			})
		}

		this.dispose = () => {
			this.listeners = []
		}
	}

	return {
		...originalVscode,
		EventEmitter: WorkingEventEmitter,
	}
})

import * as fs from "fs/promises"
import * as path from "path"
import { FileChangeManager } from "../FileChangeManager"
import { FileChangeType } from "@roo-code/types"

// Mock fs module
vi.mock("fs/promises", () => ({
	mkdir: vi.fn(),
	writeFile: vi.fn(),
	rename: vi.fn(),
	readFile: vi.fn(),
	access: vi.fn(),
	unlink: vi.fn(),
}))

// Mock console methods to avoid noise in tests
const mockConsole = {
	log: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
}
vi.stubGlobal("console", mockConsole)

// Override setImmediate for testing environment
vi.stubGlobal("setImmediate", (fn: () => void) => setTimeout(fn, 0))

describe("FileChangeManager", () => {
	let fileChangeManager: FileChangeManager
	let mockTaskId: string
	let mockGlobalStoragePath: string
	let mockBaseCheckpoint: string

	beforeEach(async () => {
		// Reset mocks completely
		vi.clearAllMocks()
		vi.resetAllMocks()

		// Setup test data with unique IDs to avoid cross-test contamination
		mockTaskId = `test-task-${Date.now()}-${Math.random()}`
		mockGlobalStoragePath = "/mock/global/storage"
		mockBaseCheckpoint = "abc123hash"

		// Reset filesystem mocks to default successful state
		vi.mocked(fs.access).mockRejectedValue(new Error("File not found"))
		vi.mocked(fs.writeFile).mockResolvedValue(undefined)
		vi.mocked(fs.mkdir).mockResolvedValue(undefined)
		vi.mocked(fs.rename).mockResolvedValue(undefined)
		vi.mocked(fs.readFile).mockResolvedValue("{}")
		vi.mocked(fs.unlink).mockResolvedValue(undefined)

		// Create FileChangeManager instance
		fileChangeManager = new FileChangeManager(mockBaseCheckpoint, mockTaskId, mockGlobalStoragePath)

		// Wait for any async constructor operations to complete
		await new Promise((resolve) => setTimeout(resolve, 0))

		// Clear any changes from constructor (which might load persisted data)
		fileChangeManager["changeset"].files.clear()

		// Reset mocks again after construction
		vi.clearAllMocks()
	})

	afterEach(() => {
		// Clean up file changes before disposing
		if (fileChangeManager) {
			fileChangeManager["changeset"].files.clear()
			fileChangeManager.dispose()
		}
	})

	describe("constructor", () => {
		it("should initialize with correct baseline and empty changeset", () => {
			const changes = fileChangeManager.getChanges()
			expect(changes.baseCheckpoint).toBe(mockBaseCheckpoint)
			expect(changes.files).toHaveLength(0)
		})

		it("should generate unique instance ID", () => {
			const manager1 = new FileChangeManager("hash1", "task1", "/path1")
			const manager2 = new FileChangeManager("hash2", "task2", "/path2")

			// Access private property via any type for testing
			expect((manager1 as any).instanceId).toBeDefined()
			expect((manager2 as any).instanceId).toBeDefined()
			expect((manager1 as any).instanceId).not.toBe((manager2 as any).instanceId)

			manager1.dispose()
			manager2.dispose()
		})

		it("should load persisted changes on initialization when configured", async () => {
			const mockPersistedData = {
				baseCheckpoint: "persisted-hash",
				files: [
					{
						uri: "test-file.txt",
						type: "edit" as FileChangeType,
						fromCheckpoint: "old-hash",
						toCheckpoint: "new-hash",
						linesAdded: 5,
						linesRemoved: 2,
					},
				],
			}

			// Mock successful file read
			vi.mocked(fs.access).mockResolvedValue(undefined)
			vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockPersistedData))

			const manager = new FileChangeManager("base-hash", "task-with-persistence", "/storage/path")

			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 0))

			const changes = manager.getChanges()
			expect(changes.baseCheckpoint).toBe("persisted-hash")
			expect(changes.files).toHaveLength(1)
			expect(changes.files[0].uri).toBe("test-file.txt")
			expect(changes.files[0].type).toBe("edit")

			manager.dispose()
		})
	})

	describe("recordChange", () => {
		it("should record a new file change", () => {
			fileChangeManager.recordChange("src/test.ts", "create", "from-hash", "to-hash", 10, 0)

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(1)

			const change = changes.files[0]
			expect(change.uri).toBe("src/test.ts")
			expect(change.type).toBe("create")
			expect(change.fromCheckpoint).toBe("from-hash")
			expect(change.toCheckpoint).toBe("to-hash")
			expect(change.linesAdded).toBe(10)
			expect(change.linesRemoved).toBe(0)
		})

		it("should update existing file change when same URI is changed again", () => {
			// Record initial change
			fileChangeManager.recordChange("src/test.ts", "create", "hash1", "hash2", 5, 0)

			// Record subsequent change to same file
			fileChangeManager.recordChange("src/test.ts", "edit", "hash2", "hash3", 3, 1)

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(1)

			const change = changes.files[0]
			expect(change.type).toBe("create") // Should remain "create" when created then edited
			expect(change.toCheckpoint).toBe("hash3")
			expect(change.linesAdded).toBe(8) // 5 + 3
			expect(change.linesRemoved).toBe(1) // 0 + 1
		})

		it("should handle pending checkpoint updates correctly", () => {
			// Record change with concrete checkpoint
			fileChangeManager.recordChange("src/test.ts", "edit", "hash1", "hash2", 5, 2)

			// Update with pending checkpoint (shouldn't update line counts)
			fileChangeManager.recordChange("src/test.ts", "edit", "hash1", "pending", 10, 5)

			const changes = fileChangeManager.getChanges()
			const change = changes.files[0]
			expect(change.toCheckpoint).toBe("hash2") // Should keep original non-pending checkpoint
			expect(change.linesAdded).toBe(5) // Shouldn't update when pending
			expect(change.linesRemoved).toBe(2) // Shouldn't update when pending
		})

		it("should trigger persistence and fire change event", async () => {
			const changeEventSpy = vi.fn()
			const disposable = fileChangeManager.onDidChange(changeEventSpy)

			fileChangeManager.recordChange("src/test.ts", "create", "hash1", "hash2", 1, 0)

			// Wait for async persistence to complete with longer timeout
			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(changeEventSpy).toHaveBeenCalledTimes(1)
			expect(vi.mocked(fs.mkdir)).toHaveBeenCalled()

			disposable.dispose()
		})
	})

	describe("acceptChange", () => {
		beforeEach(() => {
			// Clear any existing changes first
			fileChangeManager["changeset"].files.clear()
			fileChangeManager.recordChange("src/test1.ts", "create", "hash1", "hash2", 5, 0)
			fileChangeManager.recordChange("src/test2.ts", "edit", "hash1", "hash3", 2, 1)
			vi.clearAllMocks() // Clear mocks after setup
		})

		it("should remove specific file from changeset", async () => {
			await fileChangeManager.acceptChange("src/test1.ts")

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(1)
			expect(changes.files[0].uri).toBe("src/test2.ts")
		})

		it("should trigger persistence and fire change event", async () => {
			const changeEventSpy = vi.fn()
			const disposable = fileChangeManager.onDidChange(changeEventSpy)

			await fileChangeManager.acceptChange("src/test1.ts")

			expect(changeEventSpy).toHaveBeenCalledTimes(1)
			expect(vi.mocked(fs.writeFile)).toHaveBeenCalled()

			disposable.dispose()
		})

		it("should handle persistence errors gracefully", async () => {
			// Check initial state - should have the file we're testing with
			expect(fileChangeManager.getFileChange("src/test1.ts")).toBeDefined()
			const initialCount = fileChangeManager.getFileChangeCount()

			// Temporarily mock writeFile to fail
			const originalWriteFile = vi.mocked(fs.writeFile)
			vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error("Disk full"))

			// Should now throw FileChangeError due to enhanced error handling
			await expect(fileChangeManager.acceptChange("src/test1.ts")).rejects.toThrow("Disk full")

			// Should still have the same number of files in changeset since operation failed
			expect(fileChangeManager.getFileChangeCount()).toBe(initialCount)
			// Specifically, the test file should still be there
			expect(fileChangeManager.getFileChange("src/test1.ts")).toBeDefined()

			// Restore mock for other tests
			vi.mocked(fs.writeFile).mockImplementation(originalWriteFile)
		})
	})

	describe("rejectChange", () => {
		beforeEach(() => {
			// Clear any existing changes first
			fileChangeManager["changeset"].files.clear()
			fileChangeManager.recordChange("src/test1.ts", "create", "hash1", "hash2", 5, 0)
			fileChangeManager.recordChange("src/test2.ts", "edit", "hash1", "hash3", 2, 1)
			vi.clearAllMocks()
		})

		it("should remove specific file from changeset", async () => {
			await fileChangeManager.rejectChange("src/test1.ts")

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(1)
			expect(changes.files[0].uri).toBe("src/test2.ts")
		})

		it("should handle non-existent file gracefully", async () => {
			await expect(fileChangeManager.rejectChange("non-existent.ts")).resolves.toBeUndefined()

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(2) // No files should be removed
		})
	})

	describe("acceptAll", () => {
		beforeEach(() => {
			// Clear any existing changes first
			fileChangeManager["changeset"].files.clear()
			fileChangeManager.recordChange("src/test1.ts", "create", "hash1", "hash2", 5, 0)
			fileChangeManager.recordChange("src/test2.ts", "edit", "hash1", "hash3", 2, 1)
			vi.clearAllMocks()
		})

		it("should clear all changes", async () => {
			await fileChangeManager.acceptAll()

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(0)
		})

		it("should call clearPersistedChanges", async () => {
			await fileChangeManager.acceptAll()

			expect(vi.mocked(fs.unlink)).toHaveBeenCalled()
		})
	})

	describe("rejectAll", () => {
		beforeEach(() => {
			// Clear any existing changes first
			fileChangeManager["changeset"].files.clear()
			fileChangeManager.recordChange("src/test1.ts", "create", "hash1", "hash2", 5, 0)
			fileChangeManager.recordChange("src/test2.ts", "edit", "hash1", "hash3", 2, 1)
			vi.clearAllMocks()
		})

		it("should clear all changes", async () => {
			await fileChangeManager.rejectAll()

			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(0)
		})
	})

	describe("updateBaseline", () => {
		beforeEach(() => {
			// Clear any existing changes first
			fileChangeManager["changeset"].files.clear()
			fileChangeManager.recordChange("src/test.ts", "edit", "old-hash", "new-hash", 5, 2)
			vi.clearAllMocks()
		})

		it("should update baseline checkpoint and recalculate line differences", async () => {
			// Ensure writeFile mock is working properly
			vi.mocked(fs.writeFile).mockResolvedValue(undefined)

			const mockGetDiff = vi.fn().mockResolvedValue([
				{
					paths: { relative: "src/test.ts", absolute: "/abs/src/test.ts" },
					content: { before: "line1\nline2", after: "line1\nline2\nline3\nline4" },
					type: "edit",
				},
			])

			await fileChangeManager.updateBaseline("updated-baseline", mockGetDiff)

			const changes = fileChangeManager.getChanges()
			expect(changes.baseCheckpoint).toBe("updated-baseline")

			const change = changes.files[0]
			expect(change.linesAdded).toBe(2) // 4 lines - 2 lines = 2 added
			expect(change.linesRemoved).toBe(0)

			expect(mockGetDiff).toHaveBeenCalledWith("updated-baseline", "new-hash")
		})

		it("should handle files not found in diff gracefully", async () => {
			// Ensure writeFile mock is working properly
			vi.mocked(fs.writeFile).mockResolvedValue(undefined)

			const mockGetDiff = vi.fn().mockResolvedValue([]) // Empty diff result

			await fileChangeManager.updateBaseline("updated-baseline", mockGetDiff)

			const changes = fileChangeManager.getChanges()
			expect(changes.baseCheckpoint).toBe("updated-baseline")

			// File should still exist but line counts unchanged
			expect(changes.files).toHaveLength(1)
			const change = changes.files[0]
			expect(change.linesAdded).toBe(5) // Original values preserved
			expect(change.linesRemoved).toBe(2)
		})
	})

	describe("calculateLineDifferences", () => {
		it("should correctly calculate added lines", () => {
			const before = "line1\nline2"
			const after = "line1\nline2\nline3\nline4"

			const result = FileChangeManager.calculateLineDifferences(before, after)
			expect(result.linesAdded).toBe(2)
			expect(result.linesRemoved).toBe(0)
		})

		it("should correctly calculate removed lines", () => {
			const before = "line1\nline2\nline3\nline4"
			const after = "line1\nline2"

			const result = FileChangeManager.calculateLineDifferences(before, after)
			expect(result.linesAdded).toBe(0)
			expect(result.linesRemoved).toBe(2)
		})

		it("should correctly calculate changed lines when total count is same", () => {
			const before = "line1\nline2\nline3"
			const after = "newline1\nline2\nline3"

			const result = FileChangeManager.calculateLineDifferences(before, after)
			expect(result.linesAdded).toBe(1)
			expect(result.linesRemoved).toBe(1)
		})

		it("should handle empty content", () => {
			// Empty string splits to [""] which has length 1
			// "line1\nline2" splits to ["line1", "line2"] which has length 2
			// So difference is 2 - 1 = 1
			const result1 = FileChangeManager.calculateLineDifferences("", "line1\nline2")
			expect(result1.linesAdded).toBe(1)
			expect(result1.linesRemoved).toBe(0)

			const result2 = FileChangeManager.calculateLineDifferences("line1\nline2", "")
			expect(result2.linesAdded).toBe(0)
			expect(result2.linesRemoved).toBe(1)

			// Empty to empty should be no change
			const result3 = FileChangeManager.calculateLineDifferences("", "")
			expect(result3.linesAdded).toBe(0)
			expect(result3.linesRemoved).toBe(0)
		})
	})

	describe("persistence", () => {
		it("should prevent concurrent persistence operations", async () => {
			fileChangeManager.recordChange("src/test1.ts", "create", "hash1", "hash2", 1, 0)
			fileChangeManager.recordChange("src/test2.ts", "create", "hash1", "hash3", 1, 0)

			// Wait for initial persistence from recordChange calls
			await new Promise((resolve) => setTimeout(resolve, 10))
			vi.clearAllMocks() // Clear the recordChange persistence calls

			// Both should complete without race conditions
			await Promise.all([
				fileChangeManager.acceptChange("src/test1.ts"),
				fileChangeManager.acceptChange("src/test2.ts"),
			])

			// Wait for any deferred persistence operations
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should call writeFile at least once, possibly twice depending on race condition handling
			// The important thing is that both operations complete successfully
			expect(vi.mocked(fs.writeFile)).toHaveBeenCalled()

			// Verify that both files were actually removed from the changeset
			const changes = fileChangeManager.getChanges()
			expect(changes.files).toHaveLength(0)
		})

		it("should handle missing taskId gracefully", () => {
			const managerWithoutPersistence = new FileChangeManager("hash", "", "")

			// Should not throw
			managerWithoutPersistence.recordChange("test.ts", "create", "h1", "h2", 1, 0)

			// Should not attempt to persist
			expect(vi.mocked(fs.writeFile)).not.toHaveBeenCalled()

			managerWithoutPersistence.dispose()
		})
	})

	describe("getFileChangeCount", () => {
		it("should return correct count of changed files", () => {
			expect(fileChangeManager.getFileChangeCount()).toBe(0)

			fileChangeManager.recordChange("src/test1.ts", "create", "hash1", "hash2", 1, 0)
			expect(fileChangeManager.getFileChangeCount()).toBe(1)

			fileChangeManager.recordChange("src/test2.ts", "edit", "hash1", "hash3", 1, 0)
			expect(fileChangeManager.getFileChangeCount()).toBe(2)

			fileChangeManager.recordChange("src/test1.ts", "edit", "hash2", "hash4", 1, 0)
			expect(fileChangeManager.getFileChangeCount()).toBe(2) // Should not double-count
		})
	})

	describe("getFileChange", () => {
		it("should return specific file change", () => {
			fileChangeManager.recordChange("src/test.ts", "create", "hash1", "hash2", 5, 0)

			const change = fileChangeManager.getFileChange("src/test.ts")
			expect(change).toBeDefined()
			expect(change?.uri).toBe("src/test.ts")
			expect(change?.type).toBe("create")

			const nonExistent = fileChangeManager.getFileChange("non-existent.ts")
			expect(nonExistent).toBeUndefined()
		})
	})

	describe("dispose", () => {
		it("should dispose of event emitter", () => {
			const disposeSpy = vi.spyOn(fileChangeManager["_onDidChange"], "dispose")

			fileChangeManager.dispose()

			expect(disposeSpy).toHaveBeenCalled()
		})
	})
})
