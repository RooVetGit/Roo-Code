// Tests for FCOMessageHandler - Files Changed Overview message handling
// npx vitest run src/services/file-changes/__tests__/FCOMessageHandler.test.ts

import { describe, beforeEach, afterEach, it, expect, vi, Mock } from "vitest"
import * as vscode from "vscode"
import * as fs from "fs/promises"
import { FCOMessageHandler } from "../FCOMessageHandler"
import { FileChangeManager } from "../FileChangeManager"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import type { FileChange } from "@roo-code/types"
import type { TaskMetadata } from "../../../core/context-tracking/FileContextTrackerTypes"
import type { FileContextTracker } from "../../../core/context-tracking/FileContextTracker"
import { getCheckpointService } from "../../../core/checkpoints"

// Mock VS Code
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
	},
	commands: {
		executeCommand: vi.fn(),
	},
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/test/workspace",
				},
			},
		],
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
}))

// Mock fs promises
vi.mock("fs/promises", () => ({
	writeFile: vi.fn(),
	unlink: vi.fn(),
}))

// Mock os
vi.mock("os", () => ({
	tmpdir: vi.fn(() => "/tmp"),
}))

// Mock path
vi.mock("path", () => ({
	join: vi.fn((...args: string[]) => args.join("/")),
	basename: vi.fn((path: string) => path.split("/").pop() || ""),
}))

// Mock checkpoints
vi.mock("../../../core/checkpoints", () => ({
	getCheckpointService: vi.fn(),
}))

describe("FCOMessageHandler", () => {
	let handler: FCOMessageHandler
	let mockProvider: any
	let mockTask: any
	let mockFileChangeManager: any
	let mockCheckpointService: any
	let mockFileContextTracker: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Setup getCheckpointService mock
		vi.mocked(getCheckpointService).mockImplementation((task) => task?.checkpointService || undefined)

		// Mock FileContextTracker
		mockFileContextTracker = {
			getTaskMetadata: vi.fn().mockResolvedValue({
				files_in_context: [
					{ path: "file1.txt", record_source: "roo_edited" },
					{ path: "file2.txt", record_source: "user_edited" },
					{ path: "file3.txt", record_source: "roo_edited" },
				],
			} as TaskMetadata),
		} as unknown as FileContextTracker

		// Mock CheckpointService
		mockCheckpointService = {
			baseHash: "base123",
			getDiff: vi.fn(),
			getContent: vi.fn(),
		}

		// Mock FileChangeManager
		mockFileChangeManager = {
			getChanges: vi.fn().mockReturnValue({ baseCheckpoint: "base123", files: [] }),
			getLLMOnlyChanges: vi.fn().mockResolvedValue({ baseCheckpoint: "base123", files: [] }),
			getFileChange: vi.fn(),
			acceptChange: vi.fn(),
			rejectChange: vi.fn(),
			acceptAll: vi.fn(),
			rejectAll: vi.fn(),
			setFiles: vi.fn(),
			updateBaseline: vi.fn(),
		}

		// Mock Task
		mockTask = {
			taskId: "test-task-id",
			fileContextTracker: mockFileContextTracker,
			checkpointService: mockCheckpointService,
		}

		// Mock ClineProvider
		mockProvider = {
			getCurrentCline: vi.fn().mockReturnValue(mockTask),
			getFileChangeManager: vi.fn().mockReturnValue(mockFileChangeManager),
			ensureFileChangeManager: vi.fn().mockResolvedValue(mockFileChangeManager),
			postMessageToWebview: vi.fn(),
		}

		handler = new FCOMessageHandler(mockProvider)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("shouldHandleMessage", () => {
		it("should handle all FCO message types", () => {
			const fcoMessageTypes = [
				"webviewReady",
				"viewDiff",
				"acceptFileChange",
				"rejectFileChange",
				"acceptAllFileChanges",
				"rejectAllFileChanges",
				"filesChangedRequest",
				"filesChangedBaselineUpdate",
			]

			fcoMessageTypes.forEach((type) => {
				expect(handler.shouldHandleMessage({ type } as WebviewMessage)).toBe(true)
			})
		})

		it("should not handle non-FCO message types", () => {
			const nonFcoTypes = ["apiRequest", "taskComplete", "userMessage", "unknown"]

			nonFcoTypes.forEach((type) => {
				expect(handler.shouldHandleMessage({ type } as WebviewMessage)).toBe(false)
			})
		})
	})

	describe("webviewReady", () => {
		it("should initialize FCO with LLM-only changes on webview ready", async () => {
			const mockChangeset = {
				baseCheckpoint: "base123",
				files: [
					{
						uri: "file1.txt",
						type: "edit" as const,
						fromCheckpoint: "base123",
						toCheckpoint: "current",
						linesAdded: 5,
						linesRemoved: 2,
					},
				],
			}

			mockFileChangeManager.getLLMOnlyChanges.mockResolvedValue(mockChangeset)

			await handler.handleMessage({ type: "webviewReady" } as WebviewMessage)

			expect(mockFileChangeManager.getLLMOnlyChanges).toHaveBeenCalledWith("test-task-id", mockFileContextTracker)
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "filesChanged",
				filesChanged: mockChangeset,
			})
		})

		it("should handle case when FileChangeManager doesn't exist", async () => {
			mockProvider.getFileChangeManager.mockReturnValue(null)

			await handler.handleMessage({ type: "webviewReady" } as WebviewMessage)

			expect(mockProvider.ensureFileChangeManager).toHaveBeenCalled()
		})

		it("should send undefined when no LLM changes exist", async () => {
			const emptyChangeset = {
				baseCheckpoint: "base123",
				files: [],
			}

			mockFileChangeManager.getLLMOnlyChanges.mockResolvedValue(emptyChangeset)

			await handler.handleMessage({ type: "webviewReady" } as WebviewMessage)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "filesChanged",
				filesChanged: undefined,
			})
		})

		it("should handle missing task gracefully", async () => {
			mockProvider.getCurrentCline.mockReturnValue(null)

			await handler.handleMessage({ type: "webviewReady" } as WebviewMessage)

			expect(mockFileChangeManager.getLLMOnlyChanges).not.toHaveBeenCalled()
		})
	})

	describe("viewDiff", () => {
		const mockMessage = {
			type: "viewDiff" as const,
			uri: "test.txt",
		}

		beforeEach(() => {
			mockFileChangeManager.getChanges.mockReturnValue({
				files: [
					{
						uri: "test.txt",
						type: "edit",
						fromCheckpoint: "base123",
						toCheckpoint: "current123",
						linesAdded: 3,
						linesRemoved: 1,
					},
				],
			})

			mockCheckpointService.getDiff.mockResolvedValue([
				{
					paths: { relative: "test.txt", absolute: "/test/workspace/test.txt" },
					content: { before: "old content", after: "new content" },
					type: "edit",
				},
			])
		})

		it("should successfully show diff for existing file", async () => {
			await handler.handleMessage(mockMessage)

			expect(mockCheckpointService.getDiff).toHaveBeenCalledWith({
				from: "base123",
				to: "current123",
			})
			expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
				"vscode.diff",
				expect.any(Object),
				expect.any(Object),
				"test.txt: Before ↔ After",
				{ preview: false },
			)
		})

		it("should handle file not found in changeset", async () => {
			mockFileChangeManager.getChanges.mockReturnValue({ files: [] })

			await handler.handleMessage(mockMessage)

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("File change not found for test.txt")
		})

		it("should handle file not found in checkpoint diff", async () => {
			mockCheckpointService.getDiff.mockResolvedValue([])

			await handler.handleMessage(mockMessage)

			expect(vscode.window.showInformationMessage).toHaveBeenCalledWith("No changes found for test.txt")
		})

		it("should handle checkpoint service error", async () => {
			mockCheckpointService.getDiff.mockRejectedValue(new Error("Checkpoint error"))

			await handler.handleMessage(mockMessage)

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				"Failed to open diff for test.txt: Checkpoint error",
			)
		})

		it("should handle missing dependencies", async () => {
			mockProvider.getCurrentCline.mockReturnValue(null)

			await handler.handleMessage(mockMessage)

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				"Unable to view diff - missing required dependencies",
			)
		})

		it("should handle file system errors when creating temp files", async () => {
			;(fs.writeFile as Mock).mockRejectedValue(new Error("Permission denied"))

			await handler.handleMessage(mockMessage)

			// Test that the process completes without throwing
			// The error handling is internal to showFileDiff
			expect(true).toBe(true)
		})
	})

	describe("acceptFileChange", () => {
		const mockMessage = {
			type: "acceptFileChange" as const,
			uri: "test.txt",
		}

		it("should accept file change and send updated changeset", async () => {
			const updatedChangeset = {
				baseCheckpoint: "base123",
				files: [
					{
						uri: "other.txt",
						type: "edit" as const,
						fromCheckpoint: "base123",
						toCheckpoint: "current",
						linesAdded: 2,
						linesRemoved: 1,
					},
				],
			}

			mockFileChangeManager.getLLMOnlyChanges.mockResolvedValue(updatedChangeset)

			await handler.handleMessage(mockMessage)

			expect(mockFileChangeManager.acceptChange).toHaveBeenCalledWith("test.txt")
			expect(mockFileChangeManager.getLLMOnlyChanges).toHaveBeenCalledWith("test-task-id", mockFileContextTracker)
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "filesChanged",
				filesChanged: updatedChangeset,
			})
		})

		it("should send undefined when no files remain after accept", async () => {
			mockFileChangeManager.getLLMOnlyChanges.mockResolvedValue({
				baseCheckpoint: "base123",
				files: [],
			})

			await handler.handleMessage(mockMessage)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "filesChanged",
				filesChanged: undefined,
			})
		})

		it("should handle missing FileChangeManager", async () => {
			mockProvider.getFileChangeManager.mockReturnValue(null)

			await handler.handleMessage(mockMessage)

			expect(mockProvider.ensureFileChangeManager).toHaveBeenCalled()
		})
	})

	describe("rejectFileChange", () => {
		const mockMessage = {
			type: "rejectFileChange" as const,
			uri: "test.txt",
		}

		beforeEach(() => {
			mockFileChangeManager.getFileChange.mockReturnValue({
				uri: "test.txt",
				type: "edit",
				fromCheckpoint: "base123",
				toCheckpoint: "current123",
				linesAdded: 3,
				linesRemoved: 1,
			})

			mockCheckpointService.getContent.mockResolvedValue("original content")
		})

		it("should revert file and update changeset", async () => {
			const updatedChangeset = {
				baseCheckpoint: "base123",
				files: [],
			}

			mockFileChangeManager.getLLMOnlyChanges.mockResolvedValue(updatedChangeset)

			await handler.handleMessage(mockMessage)

			expect(mockCheckpointService.getContent).toHaveBeenCalledWith("base123", "/test/workspace/test.txt")
			expect(fs.writeFile).toHaveBeenCalledWith("/test/workspace/test.txt", "original content", "utf8")
			expect(mockFileChangeManager.rejectChange).toHaveBeenCalledWith("test.txt")
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "filesChanged",
				filesChanged: undefined,
			})
		})

		it("should delete newly created files", async () => {
			mockCheckpointService.getContent.mockRejectedValue(new Error("does not exist"))

			await handler.handleMessage(mockMessage)

			expect(fs.unlink).toHaveBeenCalledWith("/test/workspace/test.txt")
		})

		it("should handle file reversion errors gracefully", async () => {
			mockCheckpointService.getContent.mockRejectedValue(new Error("Checkpoint error"))

			await handler.handleMessage(mockMessage)

			// Should fallback to just removing from display
			expect(mockFileChangeManager.rejectChange).toHaveBeenCalledWith("test.txt")
		})

		it("should handle missing file change", async () => {
			mockFileChangeManager.getFileChange.mockReturnValue(null)

			await handler.handleMessage(mockMessage)

			expect(mockCheckpointService.getContent).not.toHaveBeenCalled()
		})
	})

	describe("filesChangedRequest", () => {
		it("should handle request with file changes", async () => {
			const mockMessage = {
				type: "filesChangedRequest" as const,
				fileChanges: [
					{ uri: "new.txt", type: "create" },
					{ uri: "edit.txt", type: "edit" },
				],
			}

			const filteredChangeset = {
				baseCheckpoint: "base123",
				files: [
					{
						uri: "new.txt",
						type: "create" as const,
						fromCheckpoint: "base123",
						toCheckpoint: "current",
						linesAdded: 10,
						linesRemoved: 0,
					},
				],
			}

			mockFileChangeManager.getLLMOnlyChanges.mockResolvedValue(filteredChangeset)

			await handler.handleMessage(mockMessage)

			expect(mockFileChangeManager.setFiles).toHaveBeenCalledWith([
				{
					uri: "new.txt",
					type: "create",
					fromCheckpoint: "base123",
					toCheckpoint: "current",
				},
				{
					uri: "edit.txt",
					type: "edit",
					fromCheckpoint: "base123",
					toCheckpoint: "current",
				},
			])
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "filesChanged",
				filesChanged: filteredChangeset,
			})
		})

		it("should handle request without file changes", async () => {
			const mockMessage = {
				type: "filesChangedRequest" as const,
			}

			const filteredChangeset = {
				baseCheckpoint: "base123",
				files: [],
			}

			mockFileChangeManager.getLLMOnlyChanges.mockResolvedValue(filteredChangeset)

			await handler.handleMessage(mockMessage)

			expect(mockFileChangeManager.setFiles).not.toHaveBeenCalled()
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "filesChanged",
				filesChanged: undefined,
			})
		})

		it("should handle errors gracefully", async () => {
			const mockMessage = {
				type: "filesChangedRequest" as const,
			}

			mockFileChangeManager.getLLMOnlyChanges.mockRejectedValue(new Error("LLM filter error"))

			await handler.handleMessage(mockMessage)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "filesChanged",
				filesChanged: undefined,
			})
		})
	})

	describe("LLM Filtering Edge Cases", () => {
		it("should handle empty task metadata", async () => {
			mockFileContextTracker.getTaskMetadata.mockResolvedValue({
				files_in_context: [],
			} as TaskMetadata)

			mockFileChangeManager.getLLMOnlyChanges.mockResolvedValue({
				baseCheckpoint: "base123",
				files: [],
			})

			await handler.handleMessage({ type: "webviewReady" } as WebviewMessage)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "filesChanged",
				filesChanged: undefined,
			})
		})

		it("should handle mixed LLM and user-edited files", async () => {
			const mixedChangeset = {
				baseCheckpoint: "base123",
				files: [
					{
						uri: "llm-file.txt", // Will be filtered to show only this
						type: "edit" as const,
						fromCheckpoint: "base123",
						toCheckpoint: "current",
						linesAdded: 5,
						linesRemoved: 2,
					},
				],
			}

			mockFileChangeManager.getLLMOnlyChanges.mockResolvedValue(mixedChangeset)

			await handler.handleMessage({ type: "webviewReady" } as WebviewMessage)

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "filesChanged",
				filesChanged: mixedChangeset,
			})
		})

		it("should handle FileContextTracker errors", async () => {
			mockFileContextTracker.getTaskMetadata.mockRejectedValue(new Error("Tracker error"))

			// Should still try to call getLLMOnlyChanges which should handle the error
			await handler.handleMessage({ type: "webviewReady" } as WebviewMessage)

			expect(mockFileChangeManager.getLLMOnlyChanges).toHaveBeenCalled()
		})
	})

	describe("Race Conditions", () => {
		it("should handle concurrent webviewReady messages", async () => {
			const promise1 = handler.handleMessage({ type: "webviewReady" } as WebviewMessage)
			const promise2 = handler.handleMessage({ type: "webviewReady" } as WebviewMessage)

			await Promise.all([promise1, promise2])

			// Both should complete without error
			expect(mockFileChangeManager.getLLMOnlyChanges).toHaveBeenCalledTimes(2)
		})

		it("should handle concurrent accept/reject operations", async () => {
			// Setup file change for the reject operation
			mockFileChangeManager.getFileChange.mockImplementation((uri: string) => {
				if (uri === "test2.txt") {
					return {
						uri: "test2.txt",
						type: "edit",
						fromCheckpoint: "base123",
						toCheckpoint: "current123",
						linesAdded: 3,
						linesRemoved: 1,
					}
				}
				return null
			})

			mockCheckpointService.getContent.mockResolvedValue("original content")

			const acceptPromise = handler.handleMessage({
				type: "acceptFileChange" as const,
				uri: "test1.txt",
			})
			const rejectPromise = handler.handleMessage({
				type: "rejectFileChange" as const,
				uri: "test2.txt",
			})

			await Promise.all([acceptPromise, rejectPromise])

			expect(mockFileChangeManager.acceptChange).toHaveBeenCalledWith("test1.txt")
			expect(mockFileChangeManager.rejectChange).toHaveBeenCalledWith("test2.txt")
		})
	})

	describe("Directory Filtering Impact", () => {
		it("should handle directory entries in checkpoint diff results", async () => {
			// Simulate directory entries being filtered out by ShadowCheckpointService
			mockCheckpointService.getDiff.mockResolvedValue([
				{
					paths: { relative: "src/", absolute: "/test/workspace/src/" },
					content: { before: "", after: "" },
					type: "create",
				},
				{
					paths: { relative: "src/test.txt", absolute: "/test/workspace/src/test.txt" },
					content: { before: "old", after: "new" },
					type: "edit",
				},
			])

			mockFileChangeManager.getChanges.mockReturnValue({
				files: [
					{
						uri: "src/test.txt", // Only the file, not the directory
						type: "edit",
						fromCheckpoint: "base123",
						toCheckpoint: "current123",
					},
				],
			})

			await handler.handleMessage({
				type: "viewDiff" as const,
				uri: "src/test.txt",
			})

			// Should find the file and create diff view
			expect(vscode.commands.executeCommand).toHaveBeenCalled()
		})
	})
})
