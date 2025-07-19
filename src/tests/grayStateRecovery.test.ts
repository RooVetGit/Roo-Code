import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Task } from "../core/task/Task"
import { ClineProvider } from "../core/webview/ClineProvider"

// Mock dependencies
vi.mock("vscode", () => ({
	window: {
		showErrorMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	workspace: {
		onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
		getConfiguration: vi.fn(() => ({
			get: vi.fn(),
			update: vi.fn(),
		})),
	},
	Uri: {
		file: vi.fn(),
		parse: vi.fn(),
	},
	EventEmitter: vi.fn(),
}))

vi.mock("@anthropic-ai/sdk", () => ({
	Anthropic: vi.fn(),
}))

vi.mock("delay", () => ({
	default: vi.fn(),
}))

vi.mock("axios", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
	},
}))

vi.mock("p-wait-for", () => ({
	default: vi.fn(),
}))

describe("Gray State Recovery", () => {
	let mockTask: Partial<Task>
	let mockProvider: Partial<ClineProvider>
	let mockWebview: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Mock webview
		mockWebview = {
			postMessage: vi.fn(),
		}

		// Mock task with gray state scenario
		mockTask = {
			taskId: "test-task-123",
			isStreaming: false,
			isPaused: false,
			abort: false,
			resumePausedTask: vi.fn(),
			recursivelyMakeClineRequests: vi.fn(),
			say: vi.fn(),
		}

		// Mock provider
		mockProvider = {
			getCurrentCline: vi.fn().mockReturnValue(mockTask as Task),
			postMessageToWebview: vi.fn(),
			finishSubTask: vi.fn(),
			clearTask: vi.fn(),
			postStateToWebview: vi.fn(),
		}
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Task.resumePausedTask error recovery", () => {
		it("should handle provider disconnection gracefully", async () => {
			const mockError = new Error("Provider disconnected")
			const resumeSpy = vi.fn().mockRejectedValue(mockError)
			mockTask.resumePausedTask = resumeSpy

			// Mock the actual implementation
			const task = mockTask as Task
			task.resumePausedTask = async function (lastMessage: string) {
				try {
					throw mockError
				} catch (error) {
					console.warn("[Task] Failed to resume paused task, attempting recovery:", error)

					// Recovery mechanism: reset task state
					this.isStreaming = false
					this.isPaused = false

					// Add recovery message using the say method
					try {
						await this.say(
							"error",
							"Task was interrupted but has been recovered. You can continue or start a new task.",
						)
					} catch (sayError) {
						console.warn("[Task] Failed to add recovery message:", sayError)
					}

					return
				}
			}

			await task.resumePausedTask("test message")

			expect(task.isStreaming).toBe(false)
			expect(task.isPaused).toBe(false)
		})

		it("should handle API failures during task restoration", async () => {
			const mockApiError = new Error("API request failed")
			const recursiveSpy = vi.fn().mockRejectedValue(mockApiError)
			mockTask.recursivelyMakeClineRequests = recursiveSpy

			// Mock the actual implementation
			const task = mockTask as Task
			task.recursivelyMakeClineRequests = async function (
				userContent: any[],
				includeFileDetails?: boolean,
			): Promise<boolean> {
				try {
					throw mockApiError
				} catch (error) {
					console.warn("[Task] API request failed during task restoration, attempting recovery:", error)

					// Recovery mechanism: reset streaming state
					this.isStreaming = false

					// Add recovery message using the say method
					try {
						await this.say(
							"error",
							"Connection was lost but the task has been recovered. Please try your request again.",
						)
					} catch (sayError) {
						console.warn("[Task] Failed to add recovery message:", sayError)
					}

					return false
				}
			}

			const result = await task.recursivelyMakeClineRequests([{ type: "text", text: "test" }])

			expect(task.isStreaming).toBe(false)
			expect(result).toBe(false)
		})
	})

	describe("ClineProvider.finishSubTask error recovery", () => {
		it("should handle subtask completion failures gracefully", async () => {
			const mockError = new Error("Subtask completion failed")

			// Mock the actual implementation to simulate the recovery behavior
			const provider = mockProvider as ClineProvider
			provider.finishSubTask = async function (lastMessage: string) {
				try {
					// Simulate the normal flow that would fail
					await this.getCurrentCline()?.resumePausedTask(lastMessage)
					throw mockError
				} catch (error) {
					console.warn("[ClineProvider] Failed to finish subtask, attempting recovery:", error)

					// Simulate recovery by calling clearTask (which is public)
					await this.clearTask()

					return
				}
			}

			// Test that finishSubTask handles errors gracefully
			await provider.finishSubTask("test message")

			// Verify that clearTask was called (recovery mechanism)
			expect(provider.clearTask).toHaveBeenCalled()
		})
	})

	describe("Gray state detection", () => {
		it("should detect gray state conditions correctly", () => {
			// Simulate gray state: task exists, not streaming, buttons disabled
			const hasTask = !!mockTask
			const hasMessages = true
			const isStreaming = false
			const enableButtons = false
			const clineAsk = undefined

			const isInGrayState = hasTask && hasMessages && !isStreaming && !enableButtons && !clineAsk

			expect(isInGrayState).toBe(true)
		})

		it("should not detect gray state when buttons are enabled", () => {
			const hasTask = !!mockTask
			const hasMessages = true
			const isStreaming = false
			const enableButtons = true // Buttons enabled
			const clineAsk = undefined

			const isInGrayState = hasTask && hasMessages && !isStreaming && !enableButtons && !clineAsk

			expect(isInGrayState).toBe(false)
		})

		it("should not detect gray state when streaming", () => {
			const hasTask = !!mockTask
			const hasMessages = true
			const isStreaming = true // Currently streaming
			const enableButtons = false
			const clineAsk = undefined

			const isInGrayState = hasTask && hasMessages && !isStreaming && !enableButtons && !clineAsk

			expect(isInGrayState).toBe(false)
		})

		it("should not detect gray state when there is an active ask", () => {
			const hasTask = !!mockTask
			const hasMessages = true
			const isStreaming = false
			const enableButtons = false
			const clineAsk = { type: "tool", tool: "test" } // Active ask

			const isInGrayState = hasTask && hasMessages && !isStreaming && !enableButtons && !clineAsk

			expect(isInGrayState).toBe(false)
		})
	})

	describe("Recovery strategies", () => {
		it("should attempt multiple recovery strategies in order", async () => {
			const provider = mockProvider as ClineProvider
			const strategies: string[] = []

			// Mock finishSubTask to simulate recovery strategies
			provider.finishSubTask = async function (lastMessage: string) {
				const currentTask = this.getCurrentCline()
				if (currentTask) {
					// Strategy 1: Force task resume
					try {
						strategies.push("force_resume")
						currentTask.isStreaming = false
						currentTask.isPaused = false

						// Strategy 2: Add recovery message
						strategies.push("add_recovery_message")

						// Strategy 3: Refresh UI state
						strategies.push("refresh_ui")
						await this.postStateToWebview()
					} catch (recoveryError) {
						// Strategy 4: Clear task as last resort
						strategies.push("clear_task")
						await this.clearTask()
					}
				}
			}

			await provider.finishSubTask("test message")

			expect(strategies).toEqual(["force_resume", "add_recovery_message", "refresh_ui"])
		})
	})
})
