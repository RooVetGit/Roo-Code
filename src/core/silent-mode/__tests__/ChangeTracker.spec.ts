import { describe, test, expect, beforeEach, vi } from "vitest"
import { ChangeTracker } from "../ChangeTracker"
import type { FileChange } from "../types"

describe("ChangeTracker", () => {
	let tracker: ChangeTracker
	const testTaskId = "test-task-123"

	beforeEach(() => {
		tracker = new ChangeTracker()
	})

	describe("initialization", () => {
		test("should initialize correctly", () => {
			expect(tracker).toBeDefined()
		})

		test("should start with no changes", () => {
			expect(tracker.hasChanges(testTaskId)).toBe(false)
			expect(tracker.getChangesForTask(testTaskId)).toEqual([])
		})
	})

	describe("change tracking", () => {
		test("should track a single file change", () => {
			const change: FileChange = {
				filePath: "/test/file.ts",
				operation: "modify",
				originalContent: "original content",
				newContent: "new content",
				timestamp: Date.now(),
			}

			tracker.trackChange(testTaskId, change)

			expect(tracker.hasChanges(testTaskId)).toBe(true)
			expect(tracker.getChangesForTask(testTaskId)).toHaveLength(1)
			expect(tracker.getChangesForTask(testTaskId)[0].filePath).toBe(change.filePath)
		})

		test("should track multiple changes for the same task", () => {
			const changes: FileChange[] = [
				{
					filePath: "/test/file1.ts",
					operation: "create",
					newContent: "content 1",
					timestamp: Date.now(),
				},
				{
					filePath: "/test/file2.ts",
					operation: "modify",
					originalContent: "old content",
					newContent: "new content",
					timestamp: Date.now() + 100,
				},
				{
					filePath: "/test/file3.ts",
					operation: "delete",
					originalContent: "deleted content",
					timestamp: Date.now() + 200,
				},
			]

			changes.forEach((change) => tracker.trackChange(testTaskId, change))

			expect(tracker.hasChanges(testTaskId)).toBe(true)
			expect(tracker.getChangesForTask(testTaskId)).toHaveLength(3)
		})

		test("should track changes for multiple tasks separately", () => {
			const task1Id = "task-1"
			const task2Id = "task-2"

			const change1: FileChange = {
				filePath: "/test/file1.ts",
				operation: "create",
				newContent: "content 1",
				timestamp: Date.now(),
			}

			const change2: FileChange = {
				filePath: "/test/file2.ts",
				operation: "modify",
				originalContent: "old",
				newContent: "new",
				timestamp: Date.now(),
			}

			tracker.trackChange(task1Id, change1)
			tracker.trackChange(task2Id, change2)

			expect(tracker.hasChanges(task1Id)).toBe(true)
			expect(tracker.hasChanges(task2Id)).toBe(true)
			expect(tracker.getChangesForTask(task1Id)).toHaveLength(1)
			expect(tracker.getChangesForTask(task2Id)).toHaveLength(1)
			expect(tracker.getChangesForTask(task1Id)[0].filePath).toBe(change1.filePath)
			expect(tracker.getChangesForTask(task2Id)[0].filePath).toBe(change2.filePath)
		})

		test("should handle multiple changes to the same file", () => {
			const changes: FileChange[] = [
				{
					filePath: "/test/same-file.ts",
					operation: "create",
					newContent: "initial content",
					timestamp: Date.now(),
				},
				{
					filePath: "/test/same-file.ts",
					operation: "modify",
					originalContent: "initial content",
					newContent: "modified content",
					timestamp: Date.now() + 100,
				},
			]

			changes.forEach((change) => tracker.trackChange(testTaskId, change))

			const trackedChanges = tracker.getChangesForTask(testTaskId)
			expect(trackedChanges.length).toBeGreaterThan(0)

			// All changes should be tracked
			const sameFileChanges = trackedChanges.filter((c) => c.filePath === "/test/same-file.ts")
			expect(sameFileChanges.length).toBeGreaterThan(0)
		})
	})

	describe("change summary generation", () => {
		test("should generate summary for task with changes", () => {
			const changes: FileChange[] = [
				{
					filePath: "/test/file1.ts",
					operation: "create",
					newContent: "line1\nline2\nline3",
					timestamp: Date.now(),
				},
				{
					filePath: "/test/file2.ts",
					operation: "modify",
					originalContent: "old line",
					newContent: "new line 1\nnew line 2",
					diff: "+new line 1\n+new line 2\n-old line",
					timestamp: Date.now(),
				},
			]

			changes.forEach((change) => tracker.trackChange(testTaskId, change))

			const summary = tracker.generateSummary(testTaskId)

			expect(summary).toBeDefined()
			expect(summary!.filesChanged).toBe(2)
			expect(summary!.changes).toHaveLength(2)
			expect(summary!.linesAdded).toBeGreaterThan(0)
		})

		test("should return appropriate summary for empty task", () => {
			const summary = tracker.generateSummary("non-existent-task")

			expect(summary).toBeDefined()
			expect(summary!.filesChanged).toBe(0)
			expect(summary!.changes).toEqual([])
			expect(summary!.linesAdded).toBe(0)
			expect(summary!.linesRemoved).toBe(0)
		})
	})

	describe("change management", () => {
		test("should clear changes for specific task", () => {
			const change: FileChange = {
				filePath: "/test/file.ts",
				operation: "create",
				newContent: "content",
				timestamp: Date.now(),
			}

			tracker.trackChange(testTaskId, change)
			expect(tracker.hasChanges(testTaskId)).toBe(true)

			tracker.clearChangesForTask(testTaskId)
			expect(tracker.hasChanges(testTaskId)).toBe(false)
			expect(tracker.getChangesForTask(testTaskId)).toEqual([])
		})

		test("should clear changes without affecting other tasks", () => {
			const task1Id = "task-1"
			const task2Id = "task-2"

			const change1: FileChange = {
				filePath: "/test/file1.ts",
				operation: "create",
				newContent: "content 1",
				timestamp: Date.now(),
			}

			const change2: FileChange = {
				filePath: "/test/file2.ts",
				operation: "create",
				newContent: "content 2",
				timestamp: Date.now(),
			}

			tracker.trackChange(task1Id, change1)
			tracker.trackChange(task2Id, change2)

			tracker.clearChangesForTask(task1Id)

			expect(tracker.hasChanges(task1Id)).toBe(false)
			expect(tracker.hasChanges(task2Id)).toBe(true)
			expect(tracker.getChangesForTask(task2Id)).toHaveLength(1)
		})
	})

	describe("file change operations", () => {
		test("should handle create operations", () => {
			const change: FileChange = {
				filePath: "/test/new-file.ts",
				operation: "create",
				newContent: "export const test = true",
				timestamp: Date.now(),
			}

			tracker.trackChange(testTaskId, change)

			const changes = tracker.getChangesForTask(testTaskId)
			expect(changes[0].operation).toBe("create")
			expect(changes[0].newContent).toBe(change.newContent)
		})

		test("should handle modify operations", () => {
			const change: FileChange = {
				filePath: "/test/existing-file.ts",
				operation: "modify",
				originalContent: "const old = true",
				newContent: "const new = true",
				diff: "+const new = true\n-const old = true",
				timestamp: Date.now(),
			}

			tracker.trackChange(testTaskId, change)

			const changes = tracker.getChangesForTask(testTaskId)
			expect(changes[0].operation).toBe("modify")
			expect(changes[0].originalContent).toBe(change.originalContent)
			expect(changes[0].newContent).toBe(change.newContent)
			expect(changes[0].diff).toBe(change.diff)
		})

		test("should handle delete operations", () => {
			const change: FileChange = {
				filePath: "/test/deleted-file.ts",
				operation: "delete",
				originalContent: "const deleted = true",
				timestamp: Date.now(),
			}

			tracker.trackChange(testTaskId, change)

			const changes = tracker.getChangesForTask(testTaskId)
			expect(changes[0].operation).toBe("delete")
			expect(changes[0].originalContent).toBe(change.originalContent)
		})
	})

	describe("edge cases", () => {
		test("should handle empty file content", () => {
			const change: FileChange = {
				filePath: "/test/empty-file.ts",
				operation: "create",
				newContent: "",
				timestamp: Date.now(),
			}

			tracker.trackChange(testTaskId, change)

			const changes = tracker.getChangesForTask(testTaskId)
			expect(changes[0].newContent).toBe("")
		})

		test("should handle special file paths", () => {
			const specialPaths = [
				"/test/file with spaces.ts",
				"/test/file-with-dashes.ts",
				"/test/file.special.extension.ts",
				"C:\\Windows\\Path\\file.ts",
			]

			specialPaths.forEach((filePath, index) => {
				const change: FileChange = {
					filePath,
					operation: "create",
					newContent: `content ${index}`,
					timestamp: Date.now() + index,
				}
				tracker.trackChange(testTaskId, change)
			})

			const changes = tracker.getChangesForTask(testTaskId)
			expect(changes).toHaveLength(specialPaths.length)
		})

		test("should handle very large content", () => {
			const largeContent = "x".repeat(10000)
			const change: FileChange = {
				filePath: "/test/large-file.ts",
				operation: "create",
				newContent: largeContent,
				timestamp: Date.now(),
			}

			tracker.trackChange(testTaskId, change)

			const changes = tracker.getChangesForTask(testTaskId)
			expect(changes[0].newContent).toHaveLength(10000)
		})
	})
})
