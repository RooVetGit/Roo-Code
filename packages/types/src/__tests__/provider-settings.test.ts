import { describe, it, expect } from "vitest"
import { getApiProtocol } from "../provider-settings.js"

describe("getApiProtocol", () => {
	describe("Anthropic-style providers", () => {
		it("should return 'anthropic' for anthropic provider", () => {
			expect(getApiProtocol("anthropic")).toBe("anthropic")
		})

		it("should return 'anthropic' for claude-code provider", () => {
			expect(getApiProtocol("claude-code")).toBe("anthropic")
		})
	})

	describe("Non-Anthropic providers", () => {
		it("should return 'openai' for vertex provider", () => {
			expect(getApiProtocol("vertex")).toBe("openai")
		})

		it("should return 'openai' for bedrock provider", () => {
			expect(getApiProtocol("bedrock")).toBe("openai")
		})

		it("should return 'openai' for other providers", () => {
			expect(getApiProtocol("openrouter")).toBe("openai")
			expect(getApiProtocol("openai")).toBe("openai")
			expect(getApiProtocol("litellm")).toBe("openai")
			expect(getApiProtocol("ollama")).toBe("openai")
		})
	})

	describe("Edge cases", () => {
		it("should return 'openai' when provider is undefined", () => {
			expect(getApiProtocol(undefined)).toBe("openai")
		})
	})
})
