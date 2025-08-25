import { describe, it, expect } from "vitest"
import { getSharedToolUseSection } from "../tool-use"

describe("getSharedToolUseSection", () => {
	it("should return standard tool use section for non-GPT-5 models", () => {
		const result = getSharedToolUseSection("gpt-4")
		expect(result).toContain("You have access to a set of tools")
		expect(result).toContain("You can use one tool per message")
		expect(result).not.toContain("IMPORTANT for GPT-5")
		expect(result).not.toContain("explanatory text before or after the tool invocation")
	})

	it("should return standard tool use section when no model is provided", () => {
		const result = getSharedToolUseSection()
		expect(result).toContain("You have access to a set of tools")
		expect(result).toContain("You can use one tool per message")
		expect(result).not.toContain("IMPORTANT for GPT-5")
		expect(result).not.toContain("explanatory text before or after the tool invocation")
	})

	it("should return GPT-5 specific tool use section for gpt-5 models", () => {
		const result = getSharedToolUseSection("gpt-5-2025-08-07")
		expect(result).toContain("You have access to a set of tools")
		expect(result).toContain("You can use one tool per message")
		expect(result).toContain("IMPORTANT for GPT-5")
		expect(result).toContain("When using tools to make code changes, you should provide explanations")
		expect(result).toContain("explanatory text before or after the tool invocation")
		expect(result).toContain("describe what you're doing and why")
	})

	it("should return GPT-5 specific tool use section for gpt-5-mini models", () => {
		const result = getSharedToolUseSection("gpt-5-mini-2025-08-07")
		expect(result).toContain("IMPORTANT for GPT-5")
		expect(result).toContain("When using tools to make code changes, you should provide explanations")
	})

	it("should return GPT-5 specific tool use section for gpt-5-nano models", () => {
		const result = getSharedToolUseSection("gpt-5-nano-2025-08-07")
		expect(result).toContain("IMPORTANT for GPT-5")
		expect(result).toContain("When using tools to make code changes, you should provide explanations")
	})

	it("should return GPT-5 specific tool use section for gpt-5-chat-latest", () => {
		const result = getSharedToolUseSection("gpt-5-chat-latest")
		expect(result).toContain("IMPORTANT for GPT-5")
		expect(result).toContain("When using tools to make code changes, you should provide explanations")
	})

	it("should handle case-insensitive GPT-5 model detection", () => {
		const result1 = getSharedToolUseSection("GPT-5-2025-08-07")
		expect(result1).toContain("IMPORTANT for GPT-5")

		const result2 = getSharedToolUseSection("Gpt-5-Mini")
		expect(result2).toContain("IMPORTANT for GPT-5")

		const result3 = getSharedToolUseSection("openai/gpt5-turbo")
		expect(result3).toContain("IMPORTANT for GPT-5")
	})

	it("should maintain consistent formatting structure", () => {
		const standardResult = getSharedToolUseSection("gpt-4")
		const gpt5Result = getSharedToolUseSection("gpt-5-2025-08-07")

		// Both should have the same overall structure
		expect(standardResult).toContain("====")
		expect(standardResult).toContain("TOOL USE")
		expect(standardResult).toContain("# Tool Use Formatting")
		expect(standardResult).toContain("<actual_tool_name>")

		expect(gpt5Result).toContain("====")
		expect(gpt5Result).toContain("TOOL USE")
		expect(gpt5Result).toContain("# Tool Use Formatting")
		expect(gpt5Result).toContain("<actual_tool_name>")
	})
})
