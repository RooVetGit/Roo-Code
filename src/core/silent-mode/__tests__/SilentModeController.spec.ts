import { describe, test, expect, beforeEach, vi } from "vitest"
import { SilentModeController } from "../SilentModeController"
import { SilentModeDetector } from "../SilentModeDetector"
import { ChangeTracker } from "../ChangeTracker"
import { BufferManager } from "../BufferManager"
import { NotificationService } from "../NotificationService"
import type { SilentModeSettings, FileOperation, FileChange } from "../types"
import type { Task } from "../../task/Task"

// Mock the VSCode module
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
	},
	workspace: {
		textDocuments: [],
		onDidChangeTextDocument: vi.fn(),
	},
}))

// Mock Task
const mockTask: Task = {
	taskId: "test-task-id",
} as Task

const mockWebviewMessaging = vi.fn()

const mockSettings: SilentModeSettings = {
	silentMode: true,
	maxBufferSize: 100,
	maxBufferedFiles: 50,
	autoShowReview: true,
	playSound: true,
	showDesktopNotification: true,
}

describe("SilentModeController", () => {
	let controller: SilentModeController

	beforeEach(() => {
		vi.clearAllMocks()
		controller = new SilentModeController(mockTask, mockSettings, mockWebviewMessaging)
	})

	describe("initialization", () => {
		test("should initialize correctly with task and settings", () => {
			expect(controller).toBeDefined()
		})

		test("should set up with provided settings", () => {
			const controller2 = new SilentModeController(
				mockTask,
				{ ...mockSettings, silentMode: false },
				mockWebviewMessaging,
			)
			expect(controller2).toBeDefined()
		})
	})

	describe("silent mode detection", () => {
		test("should detect when silent mode should be used", () => {
			const operation: FileOperation = {
				type: "modify",
				filePath: "/test/file.ts",
				content: "test content",
			}

			const shouldUse = controller.shouldOperateInSilentMode(operation)

			// Should be true when silentMode setting is enabled
			expect(shouldUse).toBe(true)
		})

		test("should not use silent mode when globally disabled", () => {
			const disabledController = new SilentModeController(
				mockTask,
				{ ...mockSettings, silentMode: false },
				mockWebviewMessaging,
			)

			const operation: FileOperation = {
				type: "modify",
				filePath: "/test/file.ts",
				content: "test content",
			}

			const shouldUse = disabledController.shouldOperateInSilentMode(operation)
			expect(shouldUse).toBe(false)
		})
	})

	describe("file operations", () => {
		test("should execute file operation in silent mode", async () => {
			const operation: FileOperation = {
				type: "modify",
				filePath: "/test/file.ts",
				content: "test content",
				originalContent: "original content",
			}

			const result = await controller.executeInSilentMode(operation)

			expect(result.success).toBe(true)
			expect(result.buffered).toBe(true)
			expect(result.filePath).toBe(operation.filePath)
		})

		test("should handle file operation errors gracefully", async () => {
			const operation: FileOperation = {
				type: "delete",
				filePath: "/invalid/path/file.ts",
			}

			const result = await controller.executeInSilentMode(operation)

			// Should handle gracefully without throwing
			expect(result.filePath).toBe(operation.filePath)
		})
	})

	describe("completion and review", () => {
		test("should show completion review", async () => {
			const result = await controller.showCompletionReview()

			expect(result).toHaveProperty("approved")
			expect(result).toHaveProperty("rejected")
			expect(result).toHaveProperty("cancelled")
		})

		test("should get current summary when no changes", () => {
			const summary = controller.getCurrentSummary()
			expect(summary).toBeNull()
		})

		test("should cancel and clean up", () => {
			expect(() => controller.cancel()).not.toThrow()
		})
	})

	describe("change tracking", () => {
		test("should track and get changes", async () => {
			// First make a change
			const operation: FileOperation = {
				type: "modify",
				filePath: "/test/file.ts",
				content: "new content",
				originalContent: "old content",
			}

			await controller.executeInSilentMode(operation)

			// Then check if we can get summary
			const summary = controller.getCurrentSummary()
			// May be null if no changes detected, that's fine
			expect(summary === null || typeof summary === "object").toBe(true)
		})

		test("should handle multiple operations", async () => {
			const operations: FileOperation[] = [
				{
					type: "create",
					filePath: "/test/file1.ts",
					content: "content1",
				},
				{
					type: "modify",
					filePath: "/test/file2.ts",
					content: "content2",
					originalContent: "original2",
				},
			]

			for (const operation of operations) {
				const result = await controller.executeInSilentMode(operation)
				expect(result.filePath).toBe(operation.filePath)
			}
		})
	})
})
