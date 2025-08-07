// npx vitest run src/core/checkpoints/__tests__/checkpoint-timing.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Task } from "../../task/Task"
import { presentAssistantMessage } from "../../assistant-message/presentAssistantMessage"
import * as checkpointModule from "../index"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureConversationMessage: vi.fn(),
			captureLlmCompletion: vi.fn(),
			captureCheckpointCreated: vi.fn(),
			captureCheckpointRestored: vi.fn(),
			captureCheckpointDiffed: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

// Mock vscode
vi.mock("vscode", () => ({
	RelativePattern: vi.fn().mockImplementation((base, pattern) => ({ base, pattern })),
	workspace: {
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		}),
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue(true),
		}),
	},
	window: {
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
	},
	env: {
		openExternal: vi.fn(),
	},
	Uri: {
		parse: vi.fn(),
		file: vi.fn(),
	},
	commands: {
		executeCommand: vi.fn(),
	},
}))

// Mock the checkpoint functions
vi.mock("../index", () => ({
	getCheckpointService: vi.fn(),
	checkpointSave: vi.fn().mockResolvedValue(undefined),
	checkpointRestore: vi.fn(),
	checkpointDiff: vi.fn(),
}))

// Mock the tools
vi.mock("../../tools/writeToFileTool", () => ({
	writeToFileTool: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../tools/applyDiffTool", () => ({
	applyDiffToolLegacy: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../tools/multiApplyDiffTool", () => ({
	applyDiffTool: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../tools/insertContentTool", () => ({
	insertContentTool: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../tools/searchAndReplaceTool", () => ({
	searchAndReplaceTool: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../tools/updateTodoListTool", () => ({
	updateTodoListTool: vi.fn().mockResolvedValue(undefined),
}))

// Mock other dependencies
vi.mock("../../utils/path", () => ({
	getWorkspacePath: vi.fn().mockReturnValue("/test/workspace"),
}))

vi.mock("../../utils/git", () => ({
	checkGitInstalled: vi.fn().mockResolvedValue(true),
}))

vi.mock("../../i18n", () => ({
	t: vi.fn((key) => key),
}))

vi.mock("../../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		releaseTerminalsForTask: vi.fn(),
	},
}))

vi.mock("../../core/ignore/RooIgnoreController", () => ({
	RooIgnoreController: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
		getInstructions: vi.fn().mockReturnValue(""),
	})),
}))

vi.mock("../../core/protect/RooProtectedController", () => ({
	RooProtectedController: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
	})),
}))

vi.mock("../../core/context-tracking/FileContextTracker", () => ({
	FileContextTracker: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
		markFileAsEditedByRoo: vi.fn(),
	})),
}))

vi.mock("../../services/browser/UrlContentFetcher", () => ({
	UrlContentFetcher: vi.fn().mockImplementation(() => ({
		closeBrowser: vi.fn(),
	})),
}))

vi.mock("../../services/browser/BrowserSession", () => ({
	BrowserSession: vi.fn().mockImplementation(() => ({
		closeBrowser: vi.fn(),
	})),
}))

// Mock DecorationController to avoid the vscode.window issue
vi.mock("../../integrations/editor/DecorationController", () => ({
	DecorationController: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
	})),
}))

vi.mock("../../integrations/editor/DiffViewProvider", () => ({
	DiffViewProvider: vi.fn().mockImplementation(() => ({
		isEditing: false,
		revertChanges: vi.fn(),
		reset: vi.fn(),
	})),
}))

vi.mock("../../core/tools/ToolRepetitionDetector", () => ({
	ToolRepetitionDetector: vi.fn().mockImplementation(() => ({
		check: vi.fn().mockReturnValue({ allowExecution: true }),
	})),
}))

describe("Checkpoint Timing", () => {
	let mockTask: any
	let checkpointSaveSpy: any

	beforeEach(() => {
		// Create a mock task with necessary properties
		mockTask = {
			taskId: "test-task-id",
			instanceId: "test-instance-id",
			enableCheckpoints: true,
			checkpointSave: vi.fn().mockResolvedValue(undefined),
			currentStreamingDidCheckpoint: false,
			abort: false,
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [],
			didCompleteReadingStream: false,
			userMessageContent: [],
			userMessageContentReady: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			recordToolUsage: vi.fn(),
			providerRef: {
				deref: vi.fn().mockReturnValue({
					getState: vi.fn().mockResolvedValue({
						mode: "code",
						customModes: [],
						experiments: {},
					}),
				}),
			},
			browserSession: {
				closeBrowser: vi.fn(),
			},
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({ allowExecution: true }),
			},
			diffEnabled: false,
			fileContextTracker: {
				markFileAsEditedByRoo: vi.fn(),
			},
		}

		checkpointSaveSpy = vi.spyOn(checkpointModule, "checkpointSave")
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Checkpoint before and after file edits", () => {
		it("should save checkpoint BEFORE and AFTER write_to_file tool execution", async () => {
			// Setup assistant message content with write_to_file tool
			mockTask.assistantMessageContent = [
				{
					type: "tool_use",
					name: "write_to_file",
					params: {
						path: "test.txt",
						content: "test content",
					},
					partial: false,
				},
			]

			// Mock the write_to_file tool execution
			const writeToFileModule = await import("../../tools/writeToFileTool")
			vi.spyOn(writeToFileModule, "writeToFileTool").mockImplementation(async () => {
				// Simulate tool execution
				return undefined
			})

			// Execute presentAssistantMessage
			await presentAssistantMessage(mockTask)

			// Verify checkpoint was saved twice (before and after the tool execution)
			expect(mockTask.checkpointSave).toHaveBeenCalledTimes(2)
			expect(mockTask.checkpointSave).toHaveBeenCalledWith(true)
			// Note: currentStreamingDidCheckpoint is only set to true after the "after" checkpoint
			expect(mockTask.currentStreamingDidCheckpoint).toBe(true)
		})

		// Note: The apply_diff test is omitted here because it requires complex mocking
		// of the experiment flags and tool selection logic. The implementation is tested
		// through the other file editing tools (write_to_file, insert_content, search_and_replace)
		// which all follow the same pattern of saving checkpoints after file edits.

		it("should save checkpoint BEFORE and AFTER insert_content tool execution", async () => {
			// Setup assistant message content with insert_content tool
			mockTask.assistantMessageContent = [
				{
					type: "tool_use",
					name: "insert_content",
					params: {
						path: "test.txt",
						line: 1,
						content: "inserted content",
					},
					partial: false,
				},
			]

			// Mock the insert_content tool execution
			const insertContentModule = await import("../../tools/insertContentTool")
			vi.spyOn(insertContentModule, "insertContentTool").mockImplementation(async () => {
				// Simulate tool execution
				return undefined
			})

			// Execute presentAssistantMessage
			await presentAssistantMessage(mockTask)

			// Verify checkpoint was saved twice (before and after the tool execution)
			expect(mockTask.checkpointSave).toHaveBeenCalledTimes(2)
			expect(mockTask.checkpointSave).toHaveBeenCalledWith(true)
			// Note: currentStreamingDidCheckpoint is only set to true after the "after" checkpoint
			expect(mockTask.currentStreamingDidCheckpoint).toBe(true)
		})

		it("should save checkpoint BEFORE and AFTER search_and_replace tool execution", async () => {
			// Setup assistant message content with search_and_replace tool
			mockTask.assistantMessageContent = [
				{
					type: "tool_use",
					name: "search_and_replace",
					params: {
						path: "test.txt",
						search: "old text",
						replace: "new text",
					},
					partial: false,
				},
			]

			// Mock the search_and_replace tool execution
			const searchAndReplaceModule = await import("../../tools/searchAndReplaceTool")
			vi.spyOn(searchAndReplaceModule, "searchAndReplaceTool").mockImplementation(async () => {
				// Simulate tool execution
				return undefined
			})

			// Execute presentAssistantMessage
			await presentAssistantMessage(mockTask)

			// Verify checkpoint was saved twice (before and after the tool execution)
			expect(mockTask.checkpointSave).toHaveBeenCalledTimes(2)
			expect(mockTask.checkpointSave).toHaveBeenCalledWith(true)
			// Note: currentStreamingDidCheckpoint is only set to true after the "after" checkpoint
			expect(mockTask.currentStreamingDidCheckpoint).toBe(true)
		})

		it("should handle checkpoint errors gracefully for file edit tools", async () => {
			// Setup assistant message content with write_to_file tool
			mockTask.assistantMessageContent = [
				{
					type: "tool_use",
					name: "write_to_file",
					params: {
						path: "test.txt",
						content: "test content",
					},
					partial: false,
				},
			]

			// Mock the write_to_file tool execution
			const writeToFileModule = await import("../../tools/writeToFileTool")
			vi.spyOn(writeToFileModule, "writeToFileTool").mockImplementation(async () => {
				// Simulate tool execution
				return undefined
			})

			// Mock checkpointSave to fail on first call (before) and succeed on second (after)
			mockTask.checkpointSave
				.mockRejectedValueOnce(new Error("Checkpoint before failed"))
				.mockResolvedValueOnce(undefined)

			// Mock console.error to verify error logging
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Execute presentAssistantMessage
			await presentAssistantMessage(mockTask)

			// Verify checkpoint was attempted twice
			expect(mockTask.checkpointSave).toHaveBeenCalledTimes(2)

			// Verify error was logged for the "before" checkpoint failure
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Error saving checkpoint (before)"),
				expect.any(Error),
			)

			// Clean up
			consoleErrorSpy.mockRestore()
		})

		it("should not set currentStreamingDidCheckpoint for 'before' checkpoints", async () => {
			// Setup assistant message content with write_to_file tool
			mockTask.assistantMessageContent = [
				{
					type: "tool_use",
					name: "write_to_file",
					params: {
						path: "test.txt",
						content: "test content",
					},
					partial: false,
				},
			]

			// Mock the write_to_file tool execution to track when it's called
			const writeToFileModule = await import("../../tools/writeToFileTool")
			let toolExecuted = false
			vi.spyOn(writeToFileModule, "writeToFileTool").mockImplementation(async () => {
				// At this point, the "before" checkpoint should have been saved
				// but currentStreamingDidCheckpoint should still be false
				expect(mockTask.checkpointSave).toHaveBeenCalledTimes(1)
				expect(mockTask.currentStreamingDidCheckpoint).toBe(false)
				toolExecuted = true
				return undefined
			})

			// Execute presentAssistantMessage
			await presentAssistantMessage(mockTask)

			// Verify tool was executed
			expect(toolExecuted).toBe(true)

			// After execution, currentStreamingDidCheckpoint should be true (from "after" checkpoint)
			expect(mockTask.currentStreamingDidCheckpoint).toBe(true)
			expect(mockTask.checkpointSave).toHaveBeenCalledTimes(2)
		})
	})

	describe("Checkpoint before new prompts", () => {
		it("should save checkpoint before processing new user content in recursivelyMakeClineRequests", async () => {
			// Create a real Task instance with mocked dependencies
			const mockProvider = {
				context: {
					globalStorageUri: { fsPath: "/test/storage" },
				},
				getState: vi.fn().mockResolvedValue({
					mode: "code",
					customModes: [],
					experiments: {},
				}),
				postStateToWebview: vi.fn(),
				log: vi.fn(),
			}

			const task = new Task({
				provider: mockProvider as any,
				apiConfiguration: {
					apiProvider: "anthropic",
					apiKey: "test-key",
					apiModelId: "claude-3-opus-20240229",
				},
				enableCheckpoints: true,
				task: "test task",
				startTask: false,
			})

			// Mock the checkpointSave method
			const checkpointSaveSpy = vi.spyOn(task, "checkpointSave").mockResolvedValue(undefined)

			// Mock other necessary methods to prevent actual API calls
			vi.spyOn(task as any, "getSystemPrompt").mockResolvedValue("system prompt")
			vi.spyOn(task as any, "addToApiConversationHistory").mockResolvedValue(undefined)
			vi.spyOn(task as any, "saveClineMessages").mockResolvedValue(undefined)
			vi.spyOn(task as any, "attemptApiRequest").mockImplementation(async function* () {
				yield { type: "text", text: "response" }
			})
			vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Create user content
			const userContent = [{ type: "text" as const, text: "New user prompt" }]

			// Call recursivelyMakeClineRequests
			try {
				await task.recursivelyMakeClineRequests(userContent)
			} catch (error) {
				// Expected to fail at some point due to mocking, but we just want to verify checkpoint was called
			}

			// Verify checkpoint was saved before processing the user content
			expect(checkpointSaveSpy).toHaveBeenCalledWith(true)
			expect(checkpointSaveSpy).toHaveBeenCalledTimes(1)
		})

		it("should not save checkpoint if userContent is empty", async () => {
			// Create a real Task instance with mocked dependencies
			const mockProvider = {
				context: {
					globalStorageUri: { fsPath: "/test/storage" },
				},
				getState: vi.fn().mockResolvedValue({
					mode: "code",
					customModes: [],
					experiments: {},
				}),
				postStateToWebview: vi.fn(),
				log: vi.fn(),
			}

			const task = new Task({
				provider: mockProvider as any,
				apiConfiguration: {
					apiProvider: "anthropic",
					apiKey: "test-key",
					apiModelId: "claude-3-opus-20240229",
				},
				enableCheckpoints: true,
				task: "test task",
				startTask: false,
			})

			// Mock the checkpointSave method
			const checkpointSaveSpy = vi.spyOn(task, "checkpointSave").mockResolvedValue(undefined)

			// Mock other necessary methods
			vi.spyOn(task as any, "getSystemPrompt").mockResolvedValue("system prompt")
			vi.spyOn(task as any, "addToApiConversationHistory").mockResolvedValue(undefined)
			vi.spyOn(task as any, "saveClineMessages").mockResolvedValue(undefined)
			vi.spyOn(task as any, "attemptApiRequest").mockImplementation(async function* () {
				yield { type: "text", text: "response" }
			})
			vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Call recursivelyMakeClineRequests with empty content
			try {
				await task.recursivelyMakeClineRequests([])
			} catch (error) {
				// Expected to fail at some point due to mocking
			}

			// Verify checkpoint was NOT saved for empty content
			expect(checkpointSaveSpy).not.toHaveBeenCalled()
		})

		it("should handle checkpoint save errors gracefully", async () => {
			// Create a real Task instance with mocked dependencies
			const mockProvider = {
				context: {
					globalStorageUri: { fsPath: "/test/storage" },
				},
				getState: vi.fn().mockResolvedValue({
					mode: "code",
					customModes: [],
					experiments: {},
				}),
				postStateToWebview: vi.fn(),
				log: vi.fn(),
			}

			const task = new Task({
				provider: mockProvider as any,
				apiConfiguration: {
					apiProvider: "anthropic",
					apiKey: "test-key",
					apiModelId: "claude-3-opus-20240229",
				},
				enableCheckpoints: true,
				task: "test task",
				startTask: false,
			})

			// Mock the checkpointSave method to throw an error
			const checkpointSaveSpy = vi
				.spyOn(task, "checkpointSave")
				.mockRejectedValue(new Error("Checkpoint save failed"))

			// Mock console.error to verify error logging
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Mock other necessary methods
			vi.spyOn(task as any, "getSystemPrompt").mockResolvedValue("system prompt")
			vi.spyOn(task as any, "addToApiConversationHistory").mockResolvedValue(undefined)
			vi.spyOn(task as any, "saveClineMessages").mockResolvedValue(undefined)
			vi.spyOn(task as any, "attemptApiRequest").mockImplementation(async function* () {
				yield { type: "text", text: "response" }
			})
			vi.spyOn(task, "say").mockResolvedValue(undefined)

			// Create user content
			const userContent = [{ type: "text" as const, text: "New user prompt" }]

			// Call recursivelyMakeClineRequests
			try {
				await task.recursivelyMakeClineRequests(userContent)
			} catch (error) {
				// Expected to fail at some point due to mocking
			}

			// Verify checkpoint save was attempted
			expect(checkpointSaveSpy).toHaveBeenCalledWith(true)

			// Verify error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Error saving checkpoint before new prompt"),
				expect.any(Error),
			)

			// Clean up
			consoleErrorSpy.mockRestore()
		})
	})
})
