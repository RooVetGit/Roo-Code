// Mock ClineProvider first
const mockGetVisibleInstance = jest.fn()
jest.mock("../../core/webview/ClineProvider", () => ({
	ClineProvider: {
		getVisibleInstance: mockGetVisibleInstance,
	},
}))

import {
	isInAutomatedWorkflow,
	isInAutomatedWorkflowFromProvider,
	isInAutomatedWorkflowFromVisibleProvider,
} from "../workflow-detection"
import type { Task } from "../../core/task/Task"
import type { ClineProvider } from "../../core/webview/ClineProvider"

// Mock ClineProvider
const mockProvider = {
	getCurrentCline: jest.fn(),
	contextProxy: {
		getValue: jest.fn(),
	},
} as unknown as ClineProvider

const mockVisibleProvider = {
	getCurrentCline: jest.fn(),
	contextProxy: {
		getValue: jest.fn(),
	},
} as unknown as ClineProvider

describe("workflow-detection", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("isInAutomatedWorkflow", () => {
		it("should return false when currentTask is null", () => {
			expect(isInAutomatedWorkflow(null, false)).toBe(false)
			expect(isInAutomatedWorkflow(null, true)).toBe(false)
		})

		it("should return false when currentTask is undefined", () => {
			expect(isInAutomatedWorkflow(undefined, false)).toBe(false)
			expect(isInAutomatedWorkflow(undefined, true)).toBe(false)
		})

		it("should return true when task is streaming", () => {
			const streamingTask = {
				isStreaming: true,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: false,
			} as Task

			expect(isInAutomatedWorkflow(streamingTask, false)).toBe(true)
			expect(isInAutomatedWorkflow(streamingTask, true)).toBe(true)
		})

		it("should return true when task is waiting for first chunk", () => {
			const waitingTask = {
				isStreaming: false,
				isWaitingForFirstChunk: true,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: false,
			} as Task

			expect(isInAutomatedWorkflow(waitingTask, false)).toBe(true)
			expect(isInAutomatedWorkflow(waitingTask, true)).toBe(true)
		})

		it("should return true when auto-approval is enabled and stream not completed", () => {
			const incompleteStreamTask = {
				isStreaming: false,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: false,
				presentAssistantMessageLocked: false,
			} as Task

			expect(isInAutomatedWorkflow(incompleteStreamTask, false)).toBe(false)
			expect(isInAutomatedWorkflow(incompleteStreamTask, true)).toBe(true)
		})

		it("should return true when auto-approval is enabled and assistant message is locked", () => {
			const lockedMessageTask = {
				isStreaming: false,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: true,
			} as Task

			expect(isInAutomatedWorkflow(lockedMessageTask, false)).toBe(false)
			expect(isInAutomatedWorkflow(lockedMessageTask, true)).toBe(true)
		})

		it("should return false when task is idle and auto-approval is disabled", () => {
			const idleTask = {
				isStreaming: false,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: false,
			} as Task

			expect(isInAutomatedWorkflow(idleTask, false)).toBe(false)
		})

		it("should return false when task is idle even with auto-approval enabled", () => {
			const idleTask = {
				isStreaming: false,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: false,
			} as Task

			expect(isInAutomatedWorkflow(idleTask, true)).toBe(false)
		})

		it("should return true for multiple simultaneous conditions", () => {
			const busyTask = {
				isStreaming: true,
				isWaitingForFirstChunk: true,
				didCompleteReadingStream: false,
				presentAssistantMessageLocked: true,
			} as Task

			expect(isInAutomatedWorkflow(busyTask, false)).toBe(true)
			expect(isInAutomatedWorkflow(busyTask, true)).toBe(true)
		})

		it("should handle tasks with missing properties gracefully", () => {
			const partialTask = {} as Task

			expect(isInAutomatedWorkflow(partialTask, false)).toBe(false)
			expect(isInAutomatedWorkflow(partialTask, true)).toBe(false)
		})
	})

	describe("isInAutomatedWorkflowFromProvider", () => {
		it("should return false when no current task", () => {
			mockProvider.getCurrentCline = jest.fn().mockReturnValue(null)
			mockProvider.contextProxy.getValue = jest.fn().mockReturnValue(false)

			expect(isInAutomatedWorkflowFromProvider(mockProvider)).toBe(false)
		})

		it("should return true when task is streaming", () => {
			const streamingTask = {
				isStreaming: true,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: false,
			} as Task

			mockProvider.getCurrentCline = jest.fn().mockReturnValue(streamingTask)
			mockProvider.contextProxy.getValue = jest.fn().mockReturnValue(false)

			expect(isInAutomatedWorkflowFromProvider(mockProvider)).toBe(true)
		})

		it("should return true when auto-approval is enabled and conditions are met", () => {
			const incompleteTask = {
				isStreaming: false,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: false,
				presentAssistantMessageLocked: false,
			} as Task

			mockProvider.getCurrentCline = jest.fn().mockReturnValue(incompleteTask)
			mockProvider.contextProxy.getValue = jest.fn().mockReturnValue(true)

			expect(isInAutomatedWorkflowFromProvider(mockProvider)).toBe(true)
		})

		it("should return false when task is idle and auto-approval is disabled", () => {
			const idleTask = {
				isStreaming: false,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: false,
			} as Task

			mockProvider.getCurrentCline = jest.fn().mockReturnValue(idleTask)
			mockProvider.contextProxy.getValue = jest.fn().mockReturnValue(false)

			expect(isInAutomatedWorkflowFromProvider(mockProvider)).toBe(false)
		})

		it("should handle undefined values from contextProxy", () => {
			const streamingTask = {
				isStreaming: true,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: false,
			} as Task

			mockProvider.getCurrentCline = jest.fn().mockReturnValue(streamingTask)
			mockProvider.contextProxy.getValue = jest.fn().mockReturnValue(undefined)

			// Should still return true because isStreaming is true, regardless of autoApprovalEnabled value
			expect(isInAutomatedWorkflowFromProvider(mockProvider)).toBe(true)
		})
	})

	describe("isInAutomatedWorkflowFromVisibleProvider", () => {
		it("should return false when no visible provider", () => {
			mockGetVisibleInstance.mockReturnValue(null)

			expect(isInAutomatedWorkflowFromVisibleProvider()).toBe(false)
		})

		it("should return false when visible provider has no current task", () => {
			mockVisibleProvider.getCurrentCline = jest.fn().mockReturnValue(null)
			mockVisibleProvider.contextProxy.getValue = jest.fn().mockReturnValue(false)
			mockGetVisibleInstance.mockReturnValue(mockVisibleProvider)

			expect(isInAutomatedWorkflowFromVisibleProvider()).toBe(false)
		})

		it("should return true when visible provider has streaming task", () => {
			const streamingTask = {
				isStreaming: true,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: false,
			} as Task

			mockVisibleProvider.getCurrentCline = jest.fn().mockReturnValue(streamingTask)
			mockVisibleProvider.contextProxy.getValue = jest.fn().mockReturnValue(false)
			mockGetVisibleInstance.mockReturnValue(mockVisibleProvider)

			expect(isInAutomatedWorkflowFromVisibleProvider()).toBe(true)
		})

		it("should return true when visible provider has auto-approval enabled with incomplete task", () => {
			const incompleteTask = {
				isStreaming: false,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: false,
				presentAssistantMessageLocked: false,
			} as Task

			mockVisibleProvider.getCurrentCline = jest.fn().mockReturnValue(incompleteTask)
			mockVisibleProvider.contextProxy.getValue = jest.fn().mockReturnValue(true)
			mockGetVisibleInstance.mockReturnValue(mockVisibleProvider)

			expect(isInAutomatedWorkflowFromVisibleProvider()).toBe(true)
		})

		it("should return false when visible provider has idle task and no auto-approval", () => {
			const idleTask = {
				isStreaming: false,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: false,
			} as Task

			mockVisibleProvider.getCurrentCline = jest.fn().mockReturnValue(idleTask)
			mockVisibleProvider.contextProxy.getValue = jest.fn().mockReturnValue(false)
			mockGetVisibleInstance.mockReturnValue(mockVisibleProvider)

			expect(isInAutomatedWorkflowFromVisibleProvider()).toBe(false)
		})
	})

	describe("edge cases and type safety", () => {
		it("should handle boolean coercion correctly", () => {
			// Test that the double negation (!!) in the original function works as expected
			const truthyTask = {
				isStreaming: true,
			} as Task

			expect(isInAutomatedWorkflow(truthyTask, false)).toBe(true)

			// Test falsy values
			const falsyTask = {
				isStreaming: false,
				isWaitingForFirstChunk: false,
				didCompleteReadingStream: true,
				presentAssistantMessageLocked: false,
			} as Task

			expect(isInAutomatedWorkflow(falsyTask, false)).toBe(false)
		})

		it("should handle provider with undefined getCurrentCline", () => {
			const providerWithUndefinedTask = {
				getCurrentCline: jest.fn().mockReturnValue(undefined),
				contextProxy: {
					getValue: jest.fn().mockReturnValue(false),
				},
			} as unknown as ClineProvider

			expect(isInAutomatedWorkflowFromProvider(providerWithUndefinedTask)).toBe(false)
		})

		it("should handle all combinations of auto-approval conditions", () => {
			// Test matrix of auto-approval conditions
			const testCases = [
				// [didCompleteReadingStream, presentAssistantMessageLocked, autoApprovalEnabled, expected]
				[true, false, false, false],
				[true, false, true, false],
				[false, false, false, false],
				[false, false, true, true], // incomplete stream with auto-approval
				[true, true, false, false],
				[true, true, true, true], // locked message with auto-approval
				[false, true, false, false],
				[false, true, true, true], // both incomplete stream and locked message
			]

			testCases.forEach(([didComplete, isLocked, autoApproval, expected]) => {
				const task = {
					isStreaming: false,
					isWaitingForFirstChunk: false,
					didCompleteReadingStream: didComplete,
					presentAssistantMessageLocked: isLocked,
				} as Task

				expect(isInAutomatedWorkflow(task, autoApproval as boolean)).toBe(expected as boolean)
			})
		})
	})
})
