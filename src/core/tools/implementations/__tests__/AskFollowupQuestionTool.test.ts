// npx jest src/core/tools/implementations/__tests__/AskFollowupQuestionTool.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { AskFollowupQuestionTool } from "../AskFollowupQuestionTool"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../types"
import { formatResponse } from "../../../prompts/responses"
import * as xml from "../../../../utils/xml"

// Mock dependencies
jest.mock("../../../../utils/xml")
jest.mock("../../../prompts/responses")

describe("AskFollowupQuestionTool", () => {
	// Setup common test variables
	let askFollowupQuestionTool: AskFollowupQuestionTool
	let mockCline: jest.Mocked<Partial<Cline>> & {
		consecutiveMistakeCount: number
	}
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
			consecutiveMistakeCount: 0,
			say: jest.fn().mockResolvedValue(undefined),
			sayAndCreateMissingParamError: jest.fn().mockResolvedValue("Missing parameter error"),
			ask: jest.fn().mockResolvedValue({ text: "User response", images: [] }),
		} as unknown as jest.Mocked<Partial<Cline>> & {
			consecutiveMistakeCount: number
		}

		mockAskApproval = jest.fn().mockResolvedValue(true)
		mockHandleError = jest.fn().mockResolvedValue(undefined)
		mockPushToolResult = jest.fn()
		mockRemoveClosingTag = jest.fn().mockImplementation((tag, value) => value || "")

		// Create a mock tool use object
		mockToolUse = {
			type: "tool_use",
			name: "ask_followup_question",
			params: {
				question: "What is your preferred programming language?",
				follow_up: "<suggest>JavaScript</suggest><suggest>Python</suggest>",
			},
			partial: false,
		}

		// Mock xml parsing
		;(xml.parseXml as jest.Mock).mockReturnValue({
			suggest: [{ answer: "JavaScript" }, { answer: "Python" }],
		})

		// Mock formatResponse
		;(formatResponse.toolResult as jest.Mock).mockImplementation((text) => text)

		// Create AskFollowupQuestionTool instance
		askFollowupQuestionTool = new AskFollowupQuestionTool()
	})

	describe("getName", () => {
		it("should return the correct tool name", () => {
			expect(askFollowupQuestionTool.getName()).toBe("ask_followup_question")
		})
	})

	describe("execute", () => {
		it("should ask followup question successfully", async () => {
			// Execute
			await askFollowupQuestionTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(xml.parseXml).toHaveBeenCalledWith("<suggest>JavaScript</suggest><suggest>Python</suggest>", [
				"suggest",
			])
			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				JSON.stringify({
					question: "What is your preferred programming language?",
					suggest: [{ answer: "JavaScript" }, { answer: "Python" }],
				}),
				false,
			)
			expect(mockCline.say).toHaveBeenCalledWith("user_feedback", "User response", [])
			expect(mockPushToolResult).toHaveBeenCalledWith("<answer>\nUser response\n</answer>")
		})

		it("should handle partial blocks", async () => {
			// Setup
			mockToolUse.partial = true

			// Execute
			await askFollowupQuestionTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.ask).toHaveBeenCalledWith("followup", "What is your preferred programming language?", true)
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})

		it("should handle missing question parameter", async () => {
			// Setup
			mockToolUse.params = {
				follow_up: "<suggest>JavaScript</suggest><suggest>Python</suggest>",
			}

			// Execute
			await askFollowupQuestionTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("ask_followup_question", "question")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
		})

		it("should handle XML parsing errors", async () => {
			// Setup
			const error = new Error("XML parsing error")
			;(xml.parseXml as jest.Mock).mockImplementation(() => {
				throw error
			})
			;(formatResponse.toolError as jest.Mock).mockReturnValue("Invalid operations xml format")

			// Execute
			await askFollowupQuestionTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.consecutiveMistakeCount).toBe(1)
			expect(mockCline.say).toHaveBeenCalledWith("error", "Failed to parse operations: XML parsing error")
			expect(formatResponse.toolError).toHaveBeenCalledWith("Invalid operations xml format")
			expect(mockPushToolResult).toHaveBeenCalledWith("Invalid operations xml format")
		})

		it("should handle question without suggestions", async () => {
			// Setup
			mockToolUse.params = {
				question: "What is your preferred programming language?",
			}

			// Execute
			await askFollowupQuestionTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				JSON.stringify({
					question: "What is your preferred programming language?",
					suggest: [],
				}),
				false,
			)
			expect(mockCline.say).toHaveBeenCalledWith("user_feedback", "User response", [])
			expect(mockPushToolResult).toHaveBeenCalledWith("<answer>\nUser response\n</answer>")
		})

		it("should handle errors", async () => {
			// Setup
			const error = new Error("Test error")
			mockCline.ask.mockRejectedValue(error)

			// Execute
			await askFollowupQuestionTool.execute(
				mockCline as unknown as Cline,
				mockToolUse,
				mockAskApproval as unknown as AskApproval,
				mockHandleError as unknown as HandleError,
				mockPushToolResult as unknown as PushToolResult,
				mockRemoveClosingTag as unknown as RemoveClosingTag,
			)

			// Verify
			expect(mockHandleError).toHaveBeenCalledWith("asking question", error)
		})
	})
})
