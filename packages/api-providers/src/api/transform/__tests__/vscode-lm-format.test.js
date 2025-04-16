// npx jest src/api/transform/__tests__/vscode-lm-format.test.ts
import { convertToVsCodeLmMessages, convertToAnthropicRole } from "../vscode-lm-format"
// Mock crypto
const mockCrypto = {
	randomUUID: () => "test-uuid",
}
global.crypto = mockCrypto
// Mock vscode namespace
jest.mock("vscode", () => {
	const LanguageModelChatMessageRole = {
		Assistant: "assistant",
		User: "user",
	}
	class MockLanguageModelTextPart {
		value
		type = "text"
		constructor(value) {
			this.value = value
		}
	}
	class MockLanguageModelToolCallPart {
		callId
		name
		input
		type = "tool_call"
		constructor(callId, name, input) {
			this.callId = callId
			this.name = name
			this.input = input
		}
	}
	class MockLanguageModelToolResultPart {
		toolUseId
		parts
		type = "tool_result"
		constructor(toolUseId, parts) {
			this.toolUseId = toolUseId
			this.parts = parts
		}
	}
	return {
		LanguageModelChatMessage: {
			Assistant: jest.fn((content) => ({
				role: LanguageModelChatMessageRole.Assistant,
				name: "assistant",
				content: Array.isArray(content) ? content : [new MockLanguageModelTextPart(content)],
			})),
			User: jest.fn((content) => ({
				role: LanguageModelChatMessageRole.User,
				name: "user",
				content: Array.isArray(content) ? content : [new MockLanguageModelTextPart(content)],
			})),
		},
		LanguageModelChatMessageRole,
		LanguageModelTextPart: MockLanguageModelTextPart,
		LanguageModelToolCallPart: MockLanguageModelToolCallPart,
		LanguageModelToolResultPart: MockLanguageModelToolResultPart,
	}
})
describe("convertToVsCodeLmMessages", () => {
	it("should convert simple string messages", () => {
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there" },
		]
		const result = convertToVsCodeLmMessages(messages)
		expect(result).toHaveLength(2)
		expect(result[0].role).toBe("user")
		expect(result[0].content[0].value).toBe("Hello")
		expect(result[1].role).toBe("assistant")
		expect(result[1].content[0].value).toBe("Hi there")
	})
	it("should handle complex user messages with tool results", () => {
		const messages = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Here is the result:" },
					{
						type: "tool_result",
						tool_use_id: "tool-1",
						content: "Tool output",
					},
				],
			},
		]
		const result = convertToVsCodeLmMessages(messages)
		expect(result).toHaveLength(1)
		expect(result[0].role).toBe("user")
		expect(result[0].content).toHaveLength(2)
		const [toolResult, textContent] = result[0].content
		expect(toolResult.type).toBe("tool_result")
		expect(textContent.type).toBe("text")
	})
	it("should handle complex assistant messages with tool calls", () => {
		const messages = [
			{
				role: "assistant",
				content: [
					{ type: "text", text: "Let me help you with that." },
					{
						type: "tool_use",
						id: "tool-1",
						name: "calculator",
						input: { operation: "add", numbers: [2, 2] },
					},
				],
			},
		]
		const result = convertToVsCodeLmMessages(messages)
		expect(result).toHaveLength(1)
		expect(result[0].role).toBe("assistant")
		expect(result[0].content).toHaveLength(2)
		const [toolCall, textContent] = result[0].content
		expect(toolCall.type).toBe("tool_call")
		expect(textContent.type).toBe("text")
	})
	it("should handle image blocks with appropriate placeholders", () => {
		const messages = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Look at this:" },
					{
						type: "image",
						source: {
							type: "base64",
							media_type: "image/png",
							data: "base64data",
						},
					},
				],
			},
		]
		const result = convertToVsCodeLmMessages(messages)
		expect(result).toHaveLength(1)
		const imagePlaceholder = result[0].content[1]
		expect(imagePlaceholder.value).toContain("[Image (base64): image/png not supported by VSCode LM API]")
	})
})
describe("convertToAnthropicRole", () => {
	it("should convert assistant role correctly", () => {
		const result = convertToAnthropicRole("assistant")
		expect(result).toBe("assistant")
	})
	it("should convert user role correctly", () => {
		const result = convertToAnthropicRole("user")
		expect(result).toBe("user")
	})
	it("should return null for unknown roles", () => {
		const result = convertToAnthropicRole("unknown")
		expect(result).toBeNull()
	})
})
//# sourceMappingURL=vscode-lm-format.test.js.map
