// npx jest src/core/tools/__tests__/askFollowupQuestionTool.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { Task } from "../../task/Task"
import { formatResponse } from "../../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../../shared/tools"
import { parseXml } from "../../../utils/xml"

// Import the tool function
import { askFollowupQuestionTool } from "../askFollowupQuestionTool"

// Mock dependencies
jest.mock("../../task/Task")
jest.mock("../../prompts/responses")
jest.mock("../../../utils/xml")

describe("askFollowupQuestionTool - Follow-up Question Tool Tests", () => {
	// Setup common test variables
	let mockCline: jest.Mocked<Partial<Task>> & { consecutiveMistakeCount: number }
	let mockAskApproval: jest.Mock
	let mockHandleError: jest.Mock
	let mockPushToolResult: jest.Mock
	let mockRemoveClosingTag: jest.Mock
	let mockToolUse: ToolUse

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Create mock implementations
		mockCline = {
			// @ts-expect-error - Jest mock function type issues
			ask: jest.fn().mockResolvedValue({ response: {}, text: "User response", images: [] }),
			// @ts-expect-error - Jest mock function type issues
			say: jest.fn().mockResolvedValue(undefined),
			// @ts-expect-error - Jest mock function type issues
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing parameter error"),
			consecutiveMistakeCount: 0,
			recordToolError: jest.fn(),
		}

		// @ts-expect-error - Jest mock function type issues
		mockAskApproval = jest.fn().mockResolvedValue(true)
		// @ts-expect-error - Jest mock function type issues
		mockHandleError = jest.fn().mockResolvedValue(undefined)
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn().mockImplementation((_, content) => content)

		// Mock formatResponse
		;(formatResponse.toolResult as jest.Mock).mockImplementation((result) => result)
		;(formatResponse.toolError as jest.Mock).mockImplementation((error) => error)

		// Mock parseXml
		;(parseXml as jest.Mock).mockImplementation((...args: any[]) => {
			const xmlString = args[0] as string
			if (xmlString.includes("<suggest>Option 1</suggest>")) {
				return { suggest: [{ answer: "Option 1" }] }
			} else if (xmlString.includes("<suggest>")) {
				return { suggest: { answer: "Single option" } }
			}
			return { suggest: [] }
		})

		// Create a mock tool use object with default values
		mockToolUse = {
			type: "tool_use",
			name: "ask_followup_question",
			params: {
				question: "Test question?",
				follow_up: "<suggest>Option 1</suggest><suggest>Option 2</suggest>",
			},
			partial: false,
		}
	})

	describe("Core Functionality Tests - Asking questions with suggestions", () => {
		it("should ask a question with suggestions and return the user's response", async () => {
			// Execute
			await askFollowupQuestionTool(
				mockCline as unknown as Task,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.ask).toHaveBeenCalledWith("followup", expect.stringContaining("Test question?"), false)
			expect(mockCline.say).toHaveBeenCalledWith("user_feedback", "User response", [])
			expect(mockPushToolResult).toHaveBeenCalledWith(
				expect.stringContaining("<answer>\nUser response\n</answer>"),
			)
			expect(mockCline.consecutiveMistakeCount).toBe(0)
		})

		it("should handle partial tool use (incomplete question format)", async () => {
			// Setup
			mockToolUse.partial = true
			mockToolUse.params.question = "Partial question?"

			// Execute
			await askFollowupQuestionTool(
				mockCline as unknown as Task,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockRemoveClosingTag).toHaveBeenCalledWith("question", "Partial question?")
			expect(mockCline.ask).toHaveBeenCalledWith("followup", "Partial question?", true)
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})
	})

	describe("Error Handling Tests - Parameter and parsing issues", () => {
		it("should handle missing question parameter and display appropriate error", async () => {
			// Setup
			mockToolUse.params.question = undefined

			// Execute
			await askFollowupQuestionTool(
				mockCline as unknown as Task,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("ask_followup_question")
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("ask_followup_question", "question")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
			expect(mockCline.ask).not.toHaveBeenCalled()
		})

		it("should handle XML parsing errors in follow_up suggestions", async () => {
			// Setup
			mockToolUse.params.follow_up = "<invalid>XML</invalid>"
			;(parseXml as jest.Mock).mockImplementation(() => {
				throw new Error("XML parsing error")
			})

			// Execute
			await askFollowupQuestionTool(
				mockCline as unknown as Task,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("ask_followup_question")
			expect(mockCline.say).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("Failed to parse follow-up suggestions"),
			)
			expect(formatResponse.toolError).toHaveBeenCalledWith(expect.stringContaining("Invalid suggestions format"))
			expect(mockPushToolResult).toHaveBeenCalled()
		})

		it("should handle malformed XML in follow_up suggestions leading to 'Invalid operations xml format'", async () => {
			// Setup
			mockToolUse.params.follow_up = "<suggest>Malformed</suggest><suggest>XML" // Intentionally malformed
			const parsingError = new Error("Simulated XML parsing error")
			;(parseXml as jest.Mock).mockImplementation(() => {
				throw parsingError
			})

			// Temporarily override formatResponse.toolError for this specific test case
			// to match the user-facing error log.
			const originalToolErrorMock = formatResponse.toolError
			;(formatResponse.toolError as jest.Mock).mockImplementation((...args: any[]) => {
				const message = args[0] as string
				if (message === "Invalid suggestions format. Please provide well-formed XML with <suggest> tags.") {
					return "<error>Invalid operations xml format</error>"
				}
				return message // Fallback for any other error messages
			})

			// Execute
			await askFollowupQuestionTool(
				mockCline as unknown as Task,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("ask_followup_question")
			expect(mockCline.say).toHaveBeenCalledWith(
				"error",
				`Failed to parse follow-up suggestions: ${parsingError.message}`,
			)
			// Check that the internal, more detailed error message was passed to formatResponse.toolError
			expect(formatResponse.toolError).toHaveBeenCalledWith(
				"Invalid suggestions format. Please provide well-formed XML with <suggest> tags.",
			)
			// Check that pushToolResult was called with the user-facing error message from the log
			expect(mockPushToolResult).toHaveBeenCalledWith("<error>Invalid operations xml format</error>")

			// Restore the original mock for formatResponse.toolError
			formatResponse.toolError = originalToolErrorMock
		})

		it("should handle general runtime errors during question asking", async () => {
			// Setup
			// @ts-expect-error - Jest mock function type issues
			mockCline.ask = jest.fn().mockRejectedValue(new Error("General error"))

			// Execute
			await askFollowupQuestionTool(
				mockCline as unknown as Task,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockHandleError).toHaveBeenCalledWith("asking question", expect.any(Error))
		})
	})

	describe("Suggestion Format Handling Tests - Different XML formats", () => {
		it("should handle multiple suggestions correctly formatted as an array", async () => {
			// Setup
			mockToolUse.params.follow_up = "<suggest>Option 1</suggest><suggest>Option 2</suggest>"
			;(parseXml as jest.Mock).mockReturnValue({ suggest: [{ answer: "Option 1" }, { answer: "Option 2" }] })

			// Execute
			await askFollowupQuestionTool(
				mockCline as unknown as Task,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(parseXml).toHaveBeenCalledWith(expect.stringContaining("<suggestions>"), ["suggest"])
			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining('"suggest":[{"answer":"Option 1"},{"answer":"Option 2"}]'),
				false,
			)
		})

		it("should handle a single suggestion by converting to array format", async () => {
			// Setup
			mockToolUse.params.follow_up = "<suggest>Single option</suggest>"
			;(parseXml as jest.Mock).mockReturnValue({ suggest: { answer: "Single option" } })

			// Execute
			await askFollowupQuestionTool(
				mockCline as unknown as Task,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(parseXml).toHaveBeenCalledWith(expect.stringContaining("<suggestions>"), ["suggest"])
			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining('"suggest":[{"answer":"Single option"}]'),
				false,
			)
		})

		it("should handle missing suggestions parameter (undefined follow_up)", async () => {
			// Setup
			mockToolUse.params.follow_up = undefined

			// Execute
			await askFollowupQuestionTool(
				mockCline as unknown as Task,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(parseXml).not.toHaveBeenCalled()
			expect(mockCline.ask).toHaveBeenCalledWith("followup", expect.stringContaining('"suggest":[]'), false)
		})
	})

	describe("Real-world Example Test - Performance budget suggestions", () => {
		it("should handle the exact XML structure from the user example with multiple complex options", async () => {
			// Setup with the exact XML structure from the example
			mockToolUse.params = {
				question:
					"Should we define any specific performance budgets (e.g., TTI < 5s on slow 3G, FCP < 2s, max JS bundle size < 200KB)?",
				follow_up: `<suggest>Yes, TTI < 5s on simulated slow 3G, FCP < 2s.</suggest>
<suggest>Let's aim for Lighthouse scores above 90 for performance.</suggest>
<suggest>No specific budgets for now, but we should prioritize good performance generally.</suggest>
<suggest>Use best practice (e.g., Aim for Lighthouse performance score > 90. Target FCP < 1.8s, LCP < 2.5s, TTI < 5s on a representative mobile device/network. Keep main thread JS bundle (post-compression) < 150-200KB. These are good starting points to ensure a snappy experience).</suggest>`,
			}

			// Mock parseXml to throw the specific error
			;(parseXml as jest.Mock).mockImplementation((..._args: any[]) => {
				throw new Error("Invalid operations xml format")
			})

			// Override formatResponse.toolError to return the exact error format
			const originalToolErrorMock = formatResponse.toolError
			;(formatResponse.toolError as jest.Mock).mockImplementation((..._args: any[]) => {
				return "<error>\nInvalid operations xml format\n</error>"
			})

			// Execute
			await askFollowupQuestionTool(
				mockCline as unknown as Task,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.recordToolError).toHaveBeenCalledWith("ask_followup_question")
			expect(mockCline.say).toHaveBeenCalledWith(
				"error",
				expect.stringContaining("Failed to parse follow-up suggestions"),
			)

			// Verify the exact error format is returned
			expect(mockPushToolResult).toHaveBeenCalledWith("<error>\nInvalid operations xml format\n</error>")

			// Restore the original mock
			formatResponse.toolError = originalToolErrorMock
		})
	})
})
