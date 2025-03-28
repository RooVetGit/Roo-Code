import { AskFollowupQuestionHandler } from "../AskFollowupQuestionHandler"
import { Cline } from "../../../Cline"
import { ToolUse } from "../../../assistant-message"
import { formatResponse } from "../../../prompts/responses"
import { parseXml } from "../../../../utils/xml"
import { telemetryService } from "../../../../services/telemetry/TelemetryService"

// --- Mocks ---
jest.mock("../../../Cline")
const MockCline = Cline as jest.MockedClass<typeof Cline>

jest.mock("../../../prompts/responses", () => ({
	formatResponse: {
		toolError: jest.fn((msg) => `ERROR: ${msg}`),
		toolResult: jest.fn((text, images) => (images ? `${text} [with images]` : text)), // Simple mock
	},
}))

jest.mock("../../../../utils/xml", () => ({
	parseXml: jest.fn(), // Will configure per test
}))

jest.mock("../../../../services/telemetry/TelemetryService", () => ({
	telemetryService: {
		captureToolUsage: jest.fn(),
	},
}))

describe("AskFollowupQuestionHandler", () => {
	let mockClineInstance: jest.MockedObject<Cline>
	let mockToolUse: ToolUse

	beforeEach(() => {
		jest.clearAllMocks()

		mockClineInstance = {
			cwd: "/workspace",
			consecutiveMistakeCount: 0,
			ask: jest.fn(() => Promise.resolve({ text: "User answer", images: undefined })), // Default ask response
			say: jest.fn(() => Promise.resolve()),
			pushToolResult: jest.fn(() => Promise.resolve()),
			handleErrorHelper: jest.fn(() => Promise.resolve()),
			sayAndCreateMissingParamError: jest.fn((tool, param) => Promise.resolve(`Missing ${param}`)),
			providerRef: { deref: () => ({ getState: () => Promise.resolve({}) }) },
			emit: jest.fn(),
			getTokenUsage: jest.fn(() => ({})),
		} as unknown as jest.MockedObject<Cline>

		mockToolUse = {
			type: "tool_use",
			name: "ask_followup_question",
			params: {
				question: "What is the file path?",
				follow_up: "<suggest>path/one</suggest><suggest>path/two</suggest>",
			},
			partial: false,
		}
	})

	// --- Test validateParams ---
	test("validateParams should throw if question is missing", () => {
		delete mockToolUse.params.question
		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).toThrow("Missing required parameter 'question'")
	})

	test("validateParams should not throw if follow_up is missing", () => {
		delete mockToolUse.params.follow_up
		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		expect(() => handler.validateParams()).not.toThrow()
	})

	// --- Test handlePartial ---
	test("handlePartial should call ask with question and partial flag", async () => {
		mockToolUse.partial = true
		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"followup",
			mockToolUse.params.question, // Should remove closing tag, but mock doesn't need it
			true,
		)
	})

	// --- Test handleComplete ---
	test("handleComplete should fail if question param is missing", async () => {
		delete mockToolUse.params.question
		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		await handler.handle()
		expect(mockClineInstance.sayAndCreateMissingParamError).toHaveBeenCalledWith(
			"ask_followup_question",
			"question",
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(mockToolUse, "Missing question")
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
	})

	test("handleComplete should parse follow_up XML and call ask", async () => {
		const mockParsedSuggestions = { suggest: ["path/one", "path/two"] }
		;(parseXml as jest.Mock).mockReturnValue(mockParsedSuggestions)

		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(parseXml).toHaveBeenCalledWith(mockToolUse.params.follow_up, ["suggest"])
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"followup",
			JSON.stringify({
				question: mockToolUse.params.question,
				suggest: ["path/one", "path/two"],
			}),
			false,
		)
		expect(mockClineInstance.consecutiveMistakeCount).toBe(0) // Reset on success
	})

	test("handleComplete should handle single suggest tag", async () => {
		mockToolUse.params.follow_up = "<suggest>single/path</suggest>"
		const mockParsedSuggestions = { suggest: "single/path" } // parseXml might return string for single
		;(parseXml as jest.Mock).mockReturnValue(mockParsedSuggestions)

		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(parseXml).toHaveBeenCalledWith(mockToolUse.params.follow_up, ["suggest"])
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"followup",
			JSON.stringify({
				question: mockToolUse.params.question,
				suggest: ["single/path"], // Handler should normalize to array
			}),
			false,
		)
	})

	test("handleComplete should handle missing follow_up param", async () => {
		delete mockToolUse.params.follow_up
		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(parseXml).not.toHaveBeenCalled()
		expect(mockClineInstance.ask).toHaveBeenCalledWith(
			"followup",
			JSON.stringify({
				question: mockToolUse.params.question,
				suggest: [], // Empty array when no follow_up
			}),
			false,
		)
	})

	test("handleComplete should handle invalid follow_up XML", async () => {
		const parseError = new Error("Invalid XML")
		;(parseXml as jest.Mock).mockImplementation(() => {
			throw parseError
		})
		mockToolUse.params.follow_up = "<suggest>invalid" // Malformed XML

		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"error",
			expect.stringContaining("Failed to parse follow_up XML"),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("Invalid follow_up XML format"),
		)
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
		expect(mockClineInstance.ask).not.toHaveBeenCalled()
	})

	test("handleComplete should handle non-string content in suggest tags", async () => {
		const mockParsedSuggestions = { suggest: ["path/one", { complex: "object" }] } // Invalid structure
		;(parseXml as jest.Mock).mockReturnValue(mockParsedSuggestions)

		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith(
			"error",
			expect.stringContaining("Failed to parse follow_up XML"),
		)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			expect.stringContaining("Content within each <suggest> tag must be a string"),
		)
		expect(mockClineInstance.consecutiveMistakeCount).toBe(1)
		expect(mockClineInstance.ask).not.toHaveBeenCalled()
	})

	test("handleComplete should process user response and push tool result", async () => {
		const mockParsedSuggestions = { suggest: ["path/one", "path/two"] }
		;(parseXml as jest.Mock).mockReturnValue(mockParsedSuggestions)
		const userAnswer = "User chose path/one"
		const userImages = [{ uri: "image1.png" }]
		;(mockClineInstance.ask as jest.Mock).mockResolvedValue({ text: userAnswer, images: userImages })

		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.say).toHaveBeenCalledWith("user_feedback", userAnswer, userImages)
		expect(mockClineInstance.pushToolResult).toHaveBeenCalledWith(
			mockToolUse,
			`<answer>\n${userAnswer}\n</answer> [with images]`, // From mock formatResponse.toolResult
		)
		expect(telemetryService.captureToolUsage).toHaveBeenCalledWith(
			mockClineInstance.taskId,
			"ask_followup_question",
		)
	})

	test("handleComplete should handle errors during ask", async () => {
		const askError = new Error("Ask failed")
		;(mockClineInstance.ask as jest.Mock).mockRejectedValue(askError)
		const mockParsedSuggestions = { suggest: ["path/one", "path/two"] }
		;(parseXml as jest.Mock).mockReturnValue(mockParsedSuggestions)

		const handler = new AskFollowupQuestionHandler(mockClineInstance, mockToolUse)
		await handler.handle()

		expect(mockClineInstance.handleErrorHelper).toHaveBeenCalledWith(mockToolUse, "asking question", askError)
		expect(mockClineInstance.say).not.toHaveBeenCalledWith("user_feedback", expect.anything(), expect.anything())
		expect(mockClineInstance.pushToolResult).not.toHaveBeenCalled()
	})
})
