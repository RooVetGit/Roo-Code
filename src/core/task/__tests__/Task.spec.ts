import { describe, it, expect, vi, beforeEach } from "vitest"
import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import { RooCodeEventName } from "@roo-code/types"

// Mock vscode module
vi.mock("vscode", () => ({
	RelativePattern: vi.fn().mockImplementation(() => ({})),
	workspace: {
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		})),
		getConfiguration: vi.fn(() => ({
			get: vi.fn(() => true),
		})),
		fs: {
			readFile: vi.fn(),
			writeFile: vi.fn(),
		},
	},
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
		parse: vi.fn((path) => ({ fsPath: path })),
	},
	window: {
		createTextEditorDecorationType: vi.fn(() => ({
			dispose: vi.fn(),
		})),
		activeTextEditor: undefined,
		showTextDocument: vi.fn(),
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
	},
	Range: vi.fn(),
	Position: vi.fn(),
	ViewColumn: {
		One: 1,
		Two: 2,
		Three: 3,
	},
	commands: {
		executeCommand: vi.fn(),
	},
}))

// Mock dependencies
vi.mock("../../webview/ClineProvider")
vi.mock("../../api", () => ({
	buildApiHandler: vi.fn(() => ({
		getModel: vi.fn(() => ({
			id: "gpt-5",
			info: {
				contextWindow: 100000,
				supportsComputerUse: false,
			},
		})),
	})),
}))

// Mock RooIgnoreController to avoid file system operations
vi.mock("../../core/ignore/RooIgnoreController", () => ({
	RooIgnoreController: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		getInstructions: vi.fn(),
		dispose: vi.fn(),
	})),
}))

// Mock RooProtectedController
vi.mock("../../core/protect/RooProtectedController", () => ({
	RooProtectedController: vi.fn().mockImplementation(() => ({
		initialize: vi.fn().mockResolvedValue(undefined),
		dispose: vi.fn(),
	})),
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
			captureConversationMessage: vi.fn(),
			captureLlmCompletion: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

describe("Task", () => {
	let mockProvider: any
	let task: Task

	beforeEach(() => {
		// Setup mock provider
		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/storage" },
			},
			getState: vi.fn().mockResolvedValue({
				mode: "code",
				experiments: {},
			}),
			postStateToWebview: vi.fn(),
			log: vi.fn(),
			updateTaskHistory: vi.fn(),
		}

		vi.clearAllMocks()
	})

	describe("resumePausedTask", () => {
		it("should skip previousResponseId for GPT-5 after subtask completion", async () => {
			// Create task with GPT-5 model
			const apiConfiguration = {
				apiProvider: "openai-native",
				apiModelId: "gpt-5",
			}

			task = new Task({
				provider: mockProvider as any,
				apiConfiguration: apiConfiguration as any,
				task: "Test task",
				startTask: false,
			})

			// Mock the API to return GPT-5 model
			task.api = {
				getModel: vi.fn(() => ({
					id: "gpt-5",
					info: {
						contextWindow: 100000,
						supportsComputerUse: false,
					},
				})),
			} as any

			// Spy on required methods
			const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)
			const addToApiConversationHistorySpy = vi
				.spyOn(task as any, "addToApiConversationHistory")
				.mockResolvedValue(undefined)
			const emitSpy = vi.spyOn(task, "emit")

			// Initially, skipPrevResponseIdOnce should be false
			expect(task["skipPrevResponseIdOnce"]).toBe(false)

			// Resume the task with a subtask result
			await task.resumePausedTask("Subtask completed successfully")

			// Verify the flag was set for GPT-5
			expect(task["skipPrevResponseIdOnce"]).toBe(true)

			// Verify the log was called
			expect(mockProvider.log).toHaveBeenCalledWith(
				"[GPT-5] Skipping previous_response_id for next API call after subtask completion",
			)

			// Verify other expected calls
			expect(emitSpy).toHaveBeenCalledWith(RooCodeEventName.TaskUnpaused)
			expect(saySpy).toHaveBeenCalledWith("subtask_result", "Subtask completed successfully")
			expect(addToApiConversationHistorySpy).toHaveBeenCalledWith({
				role: "user",
				content: [{ type: "text", text: "[new_task completed] Result: Subtask completed successfully" }],
			})
		})

		it("should not skip previousResponseId for non-GPT-5 models", async () => {
			// Create task with non-GPT-5 model
			const apiConfiguration = {
				apiProvider: "anthropic",
				apiModelId: "claude-3-5-sonnet-20241022",
			}

			task = new Task({
				provider: mockProvider as any,
				apiConfiguration: apiConfiguration as any,
				task: "Test task",
				startTask: false,
			})

			// Mock the API to return non-GPT-5 model
			task.api = {
				getModel: vi.fn(() => ({
					id: "claude-3-5-sonnet-20241022",
					info: {
						contextWindow: 200000,
						supportsComputerUse: true,
					},
				})),
			} as any

			// Spy on required methods
			const saySpy = vi.spyOn(task, "say").mockResolvedValue(undefined)
			const addToApiConversationHistorySpy = vi
				.spyOn(task as any, "addToApiConversationHistory")
				.mockResolvedValue(undefined)
			const emitSpy = vi.spyOn(task, "emit")

			// Initially, skipPrevResponseIdOnce should be false
			expect(task["skipPrevResponseIdOnce"]).toBe(false)

			// Resume the task with a subtask result
			await task.resumePausedTask("Subtask completed successfully")

			// Verify the flag was NOT set for non-GPT-5 models
			expect(task["skipPrevResponseIdOnce"]).toBe(false)

			// Verify the GPT-5 specific log was NOT called
			expect(mockProvider.log).not.toHaveBeenCalledWith(
				"[GPT-5] Skipping previous_response_id for next API call after subtask completion",
			)

			// Verify other expected calls still happened
			expect(emitSpy).toHaveBeenCalledWith(RooCodeEventName.TaskUnpaused)
			expect(saySpy).toHaveBeenCalledWith("subtask_result", "Subtask completed successfully")
			expect(addToApiConversationHistorySpy).toHaveBeenCalledWith({
				role: "user",
				content: [{ type: "text", text: "[new_task completed] Result: Subtask completed successfully" }],
			})
		})

		it("should handle errors gracefully", async () => {
			// Create task
			const apiConfiguration = {
				apiProvider: "openai-native",
				apiModelId: "gpt-5",
			}

			task = new Task({
				provider: mockProvider as any,
				apiConfiguration: apiConfiguration as any,
				task: "Test task",
				startTask: false,
			})

			// Mock the API to return GPT-5 model
			task.api = {
				getModel: vi.fn(() => ({
					id: "gpt-5",
					info: {
						contextWindow: 100000,
						supportsComputerUse: false,
					},
				})),
			} as any

			// Spy on methods and make addToApiConversationHistory throw an error
			vi.spyOn(task, "say").mockResolvedValue(undefined)
			vi.spyOn(task as any, "addToApiConversationHistory").mockRejectedValue(new Error("Test error"))
			vi.spyOn(task, "emit")

			// Expect the error to be thrown
			await expect(task.resumePausedTask("Subtask result")).rejects.toThrow("Test error")

			// Verify error was logged
			expect(mockProvider.log).toHaveBeenCalledWith(
				expect.stringContaining("Error failed to add reply from subtask into conversation of parent task"),
			)
		})
	})
})
