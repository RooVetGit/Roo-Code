import { describe, test, expect, beforeEach } from "vitest"
import { BufferManager } from "../BufferManager"
import type { FileOperation } from "../types"

describe("BufferManager", () => {
	let bufferManager: BufferManager

	beforeEach(() => {
		bufferManager = new BufferManager()
	})

	describe("initialization", () => {
		test("should initialize correctly", () => {
			expect(bufferManager).toBeDefined()
		})

		test("should return null for non-existent content", () => {
			const content = bufferManager.getBufferedContent("/test/nonexistent.ts")
			expect(content).toBeNull()
		})
	})

	describe("file operation buffering", () => {
		test("should buffer a create operation", async () => {
			const operation: FileOperation = {
				type: "create",
				filePath: "/test/new-file.ts",
				content: "export const test = true",
			}

			const result = await bufferManager.bufferFileOperation(operation.filePath, operation)

			expect(result.success).toBe(true)
			expect(result.error).toBeUndefined()
		})

		test("should buffer a modify operation", async () => {
			const operation: FileOperation = {
				type: "modify",
				filePath: "/test/existing-file.ts",
				content: "modified content",
				originalContent: "original content",
			}

			const result = await bufferManager.bufferFileOperation(operation.filePath, operation)

			expect(result.success).toBe(true)
			expect(result.error).toBeUndefined()
		})

		test("should buffer a delete operation", async () => {
			const operation: FileOperation = {
				type: "delete",
				filePath: "/test/deleted-file.ts",
				originalContent: "deleted content",
			}

			const result = await bufferManager.bufferFileOperation(operation.filePath, operation)

			expect(result.success).toBe(true)
			expect(result.error).toBeUndefined()
		})
	})

	describe("content retrieval", () => {
		test("should retrieve buffered content", async () => {
			const operation: FileOperation = {
				type: "create",
				filePath: "/test/file.ts",
				content: "test content",
			}

			await bufferManager.bufferFileOperation(operation.filePath, operation)

			const content = bufferManager.getBufferedContent(operation.filePath)
			expect(content).toBe(operation.content)
		})

		test("should return null for non-buffered files", () => {
			const content = bufferManager.getBufferedContent("/non/existent/file.ts")
			expect(content).toBeNull()
		})
	})

	describe("cleanup", () => {
		test("should cleanup without errors", () => {
			expect(() => bufferManager.cleanup()).not.toThrow()
		})

		test("should cleanup with task ID without errors", () => {
			expect(() => bufferManager.cleanup("test-task")).not.toThrow()
		})
	})
})
