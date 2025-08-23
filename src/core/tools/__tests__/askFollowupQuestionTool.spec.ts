import { describe, it, expect, vi, beforeEach } from "vitest"
import { askFollowupQuestionTool } from "../askFollowupQuestionTool"
import { ToolUse } from "../../../shared/tools"

describe("askFollowupQuestionTool", () => {
	let mockCline: any
	let mockPushToolResult: any
	let mockAskApproval: any
	let mockHandleError: any
	let mockRemoveClosingTag: any
	let toolResult: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockCline = {
			ask: vi.fn().mockResolvedValue({ text: "Test response", images: [] }),
			say: vi.fn().mockResolvedValue(undefined),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing parameter error"),
			recordToolError: vi.fn(),
			consecutiveMistakeCount: 0,
		}

		mockPushToolResult = vi.fn((result) => {
			toolResult = result
		})

		mockAskApproval = vi.fn()
		mockHandleError = vi.fn()
		mockRemoveClosingTag = vi.fn((tag, content) => content)
	})

	describe("New nested XML format (current implementation)", () => {
		it("should parse suggestions without mode", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What is the path to the frontend-config.json file?",
					follow_up:
						"<suggest><content>./src/frontend-config.json</content></suggest><suggest><content>./config/frontend-config.json</content></suggest><suggest><content>./frontend-config.json</content></suggest>",
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining(
					'"suggest":[{"answer":"./src/frontend-config.json"},{"answer":"./config/frontend-config.json"},{"answer":"./frontend-config.json"}]',
				),
				false,
			)
			expect(mockCline.consecutiveMistakeCount).toBe(0)
		})

		it("should parse suggestions with mode", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "How would you like to proceed?",
					follow_up:
						"<suggest><mode>code</mode><content>Start implementing the solution</content></suggest><suggest><mode>architect</mode><content>Plan the architecture first</content></suggest>",
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining(
					'"suggest":[{"answer":"Start implementing the solution","mode":"code"},{"answer":"Plan the architecture first","mode":"architect"}]',
				),
				false,
			)
			expect(mockCline.consecutiveMistakeCount).toBe(0)
		})

		it("should handle mixed suggestions with and without mode", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What would you like to do next?",
					follow_up:
						"<suggest><content>Continue with current approach</content></suggest><suggest><mode>debug</mode><content>Debug the issue</content></suggest><suggest><content>Skip this step</content></suggest>",
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining(
					'"suggest":[{"answer":"Continue with current approach"},{"answer":"Debug the issue","mode":"debug"},{"answer":"Skip this step"}]',
				),
				false,
			)
			expect(mockCline.consecutiveMistakeCount).toBe(0)
		})

		it("should handle single suggestion", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "Should I proceed with the default configuration?",
					follow_up: "<suggest><content>Yes, use the default configuration</content></suggest>",
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining('"suggest":[{"answer":"Yes, use the default configuration"}]'),
				false,
			)
		})
	})

	describe("Backward compatibility with old format", () => {
		it("should parse suggestions without mode attributes", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What would you like to do?",
					follow_up: "<suggest>Option 1</suggest><suggest>Option 2</suggest>",
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining('"suggest":[{"answer":"Option 1"},{"answer":"Option 2"}]'),
				false,
			)
		})

		it("should parse suggestions with mode attributes", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What would you like to do?",
					follow_up: '<suggest mode="code">Write code</suggest><suggest mode="debug">Debug issue</suggest>',
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining(
					'"suggest":[{"answer":"Write code","mode":"code"},{"answer":"Debug issue","mode":"debug"}]',
				),
				false,
			)
		})

		it("should handle mixed suggestions with and without mode attributes", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What would you like to do?",
					follow_up: '<suggest>Regular option</suggest><suggest mode="architect">Plan architecture</suggest>',
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining(
					'"suggest":[{"answer":"Regular option"},{"answer":"Plan architecture","mode":"architect"}]',
				),
				false,
			)
		})
	})

	describe("Error handling", () => {
		it("should handle missing question parameter", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					follow_up: "<suggest><content>Option 1</content></suggest>",
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.recordToolError).toHaveBeenCalledWith("ask_followup_question")
			expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("ask_followup_question", "question")
			expect(mockPushToolResult).toHaveBeenCalledWith("Missing parameter error")
			expect(mockCline.consecutiveMistakeCount).toBe(1)
		})

		it("should handle partial tool use", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "Partial question?",
				},
				partial: true,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.ask).toHaveBeenCalledWith("followup", "Partial question?", true)
			expect(mockPushToolResult).not.toHaveBeenCalled()
		})

		it("should handle question without follow_up suggestions", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What is your preference?",
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.ask).toHaveBeenCalledWith(
				"followup",
				expect.stringContaining('"question":"What is your preference?"'),
				false,
			)
			expect(mockCline.ask).toHaveBeenCalledWith("followup", expect.stringContaining('"suggest":[]'), false)
			expect(mockCline.consecutiveMistakeCount).toBe(0)
		})

		it("should return user response with images", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "Can you show me the error?",
					follow_up: "<suggest><content>I'll paste the error message</content></suggest>",
				},
				partial: false,
			}

			const mockImages = ["image1.png", "image2.png"]
			mockCline.ask = vi.fn().mockResolvedValue({ text: "Here's the error screenshot", images: mockImages })

			// Mock formatResponse.toolResult
			const formatResponse = await import("../../prompts/responses")
			vi.spyOn(formatResponse.formatResponse, "toolResult").mockReturnValue(
				"<answer>\nHere's the error screenshot\n</answer>",
			)

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockCline.say).toHaveBeenCalledWith("user_feedback", "Here's the error screenshot", mockImages)
			expect(formatResponse.formatResponse.toolResult).toHaveBeenCalledWith(
				"<answer>\nHere's the error screenshot\n</answer>",
				mockImages,
			)
			expect(mockPushToolResult).toHaveBeenCalledWith("<answer>\nHere's the error screenshot\n</answer>")
		})

		it("should handle exception during tool execution", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "Test question",
					follow_up: "<suggest><content>Test</content></suggest>",
				},
				partial: false,
			}

			const testError = new Error("Unexpected error")
			mockCline.ask = vi.fn().mockRejectedValue(testError)

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			expect(mockHandleError).toHaveBeenCalledWith("asking question", testError)
		})
	})

	describe("Integration with tool description format", () => {
		it("should handle format matching documentation example", async () => {
			// This test ensures the implementation matches the exact format shown in the documentation
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "What is the path to the frontend-config.json file?",
					follow_up: `<suggest><content>./src/frontend-config.json</content></suggest>
<suggest><content>./config/frontend-config.json</content></suggest>
<suggest><content>./frontend-config.json</content></suggest>`,
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			const callArgs = mockCline.ask.mock.calls[0]
			const parsedJson = JSON.parse(callArgs[1])

			expect(parsedJson.question).toBe("What is the path to the frontend-config.json file?")
			expect(parsedJson.suggest).toHaveLength(3)
			expect(parsedJson.suggest[0]).toEqual({ answer: "./src/frontend-config.json" })
			expect(parsedJson.suggest[1]).toEqual({ answer: "./config/frontend-config.json" })
			expect(parsedJson.suggest[2]).toEqual({ answer: "./frontend-config.json" })
		})

		it("should handle inline format with mode switching as per documentation", async () => {
			const block: ToolUse = {
				type: "tool_use",
				name: "ask_followup_question",
				params: {
					question: "How would you like to proceed?",
					follow_up:
						"<suggest><content>First suggestion</content></suggest><suggest><mode>code</mode><content>Action with mode switch</content></suggest>",
				},
				partial: false,
			}

			await askFollowupQuestionTool(
				mockCline,
				block,
				mockAskApproval,
				mockHandleError,
				mockPushToolResult,
				mockRemoveClosingTag,
			)

			const callArgs = mockCline.ask.mock.calls[0]
			const parsedJson = JSON.parse(callArgs[1])

			expect(parsedJson.suggest[0]).toEqual({ answer: "First suggestion" })
			expect(parsedJson.suggest[1]).toEqual({ answer: "Action with mode switch", mode: "code" })
		})
	})
})
