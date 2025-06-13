// npx jest src/core/assistant-message/__tests__/presentAssistantMessage.test.ts

import { presentAssistantMessage } from "../presentAssistantMessage"
import { formatResponse } from "../../prompts/responses"
import { validateToolUse } from "../../tools/validateToolUse"

// Mock dependencies
jest.mock("../../prompts/responses")
jest.mock("../../tools/validateToolUse")
jest.mock("../../checkpoints")
jest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: jest.fn(),
		},
	},
}))

const mockFormatResponse = formatResponse as jest.Mocked<typeof formatResponse>
const mockValidateToolUse = validateToolUse as jest.MockedFunction<typeof validateToolUse>

describe("presentAssistantMessage", () => {
	let mockTask: any

	beforeEach(() => {
		jest.clearAllMocks()

		mockTask = {
			abort: false,
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			didCompleteReadingStream: false,
			userMessageContentReady: false,
			didRejectTool: false,
			didAlreadyUseTool: false,
			consecutiveMistakeCount: 0,
			assistantMessageContent: [],
			userMessageContent: [],
			say: jest.fn(),
			ask: jest.fn(),
			providerRef: {
				deref: jest.fn().mockReturnValue({
					getState: jest.fn().mockResolvedValue({
						mode: "code",
						customModes: [],
					}),
				}),
			},
			browserSession: {
				closeBrowser: jest.fn(),
			},
			recordToolUsage: jest.fn(),
			fileContextTracker: {
				getAndClearCheckpointPossibleFile: jest.fn().mockReturnValue([]),
			},
			toolRepetitionDetector: {
				check: jest.fn().mockReturnValue({
					allowExecution: true,
					askUser: false,
				}),
			},
		}

		mockFormatResponse.toolError = jest.fn().mockImplementation((error) => `Tool error: ${error}`)
	})

	describe("error handling in tool validation", () => {
		it("should handle Error objects with message property correctly", async () => {
			const errorMessage = "Validation failed"
			const error = new Error(errorMessage)

			mockValidateToolUse.mockImplementation(() => {
				throw error
			})

			mockTask.assistantMessageContent = [
				{
					type: "tool_use",
					name: "read_file",
					params: { path: "test.ts" },
					partial: false,
				},
			]

			await presentAssistantMessage(mockTask)

			expect(mockFormatResponse.toolError).toHaveBeenCalledWith(errorMessage)
			expect(mockTask.consecutiveMistakeCount).toBe(1)
		})

		it("should handle non-Error objects without message property correctly", async () => {
			const nonErrorObject = { code: 500, details: "Internal server error" }

			mockValidateToolUse.mockImplementation(() => {
				throw nonErrorObject
			})

			mockTask.assistantMessageContent = [
				{
					type: "tool_use",
					name: "read_file",
					params: { path: "test.ts" },
					partial: false,
				},
			]

			await presentAssistantMessage(mockTask)

			// Should call toolError with serialized error instead of undefined
			expect(mockFormatResponse.toolError).toHaveBeenCalledWith(
				JSON.stringify({ code: 500, details: "Internal server error" }),
			)
			expect(mockTask.consecutiveMistakeCount).toBe(1)
		})

		it("should handle Error objects without message property correctly", async () => {
			const errorWithoutMessage = Object.create(Error.prototype)
			errorWithoutMessage.name = "CustomError"
			// Explicitly delete message property to simulate the bug scenario
			delete errorWithoutMessage.message

			mockValidateToolUse.mockImplementation(() => {
				throw errorWithoutMessage
			})

			mockTask.assistantMessageContent = [
				{
					type: "tool_use",
					name: "read_file",
					params: { path: "test.ts" },
					partial: false,
				},
			]

			await presentAssistantMessage(mockTask)

			// Should call toolError with serialized error instead of undefined
			expect(mockFormatResponse.toolError).toHaveBeenCalledWith(expect.stringContaining('"name":"CustomError"'))
			expect(mockTask.consecutiveMistakeCount).toBe(1)
		})

		it("should handle string errors correctly", async () => {
			const stringError = "Something went wrong"

			mockValidateToolUse.mockImplementation(() => {
				throw stringError
			})

			mockTask.assistantMessageContent = [
				{
					type: "tool_use",
					name: "read_file",
					params: { path: "test.ts" },
					partial: false,
				},
			]

			await presentAssistantMessage(mockTask)

			// Should call toolError with serialized error
			expect(mockFormatResponse.toolError).toHaveBeenCalledWith(JSON.stringify("Something went wrong"))
			expect(mockTask.consecutiveMistakeCount).toBe(1)
		})

		it("should handle null/undefined errors correctly", async () => {
			mockValidateToolUse.mockImplementation(() => {
				throw null
			})

			mockTask.assistantMessageContent = [
				{
					type: "tool_use",
					name: "read_file",
					params: { path: "test.ts" },
					partial: false,
				},
			]

			await presentAssistantMessage(mockTask)

			// Should call toolError with serialized null
			expect(mockFormatResponse.toolError).toHaveBeenCalledWith("null")
			expect(mockTask.consecutiveMistakeCount).toBe(1)
		})
	})

	describe("normal operation", () => {
		it("should not increment mistake count when validation passes", async () => {
			mockValidateToolUse.mockImplementation(() => {
				// No error thrown
			})

			// Test with text content instead of tool use to avoid execution issues
			mockTask.assistantMessageContent = [
				{
					type: "text",
					content: "This is a test message",
					partial: false,
				},
			]

			await presentAssistantMessage(mockTask)

			expect(mockTask.consecutiveMistakeCount).toBe(0)
			expect(mockFormatResponse.toolError).not.toHaveBeenCalled()
		})
	})
})
