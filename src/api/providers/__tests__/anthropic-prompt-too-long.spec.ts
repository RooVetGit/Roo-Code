import { describe, it, expect, vi, beforeEach } from "vitest"
import { AnthropicHandler } from "../anthropic"
import type { ApiHandlerOptions } from "../../../shared/api"

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
	const mockCreate = vi.fn()
	const mockCountTokens = vi.fn()
	
	return {
		Anthropic: vi.fn().mockImplementation(() => ({
			messages: {
				create: mockCreate,
				countTokens: mockCountTokens,
			},
		})),
	}
})

describe("AnthropicHandler - Prompt Too Long Error Handling", () => {
	let handler: AnthropicHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			apiKey: "test-api-key",
			apiModelId: "claude-3-5-sonnet-20241022",
		}
		handler = new AnthropicHandler(mockOptions)
	})

	describe("isPromptTooLongError", () => {
		it("should detect prompt too long error messages", () => {
			const error1 = { message: "prompt is too long: 208732 tokens > 200000 maximum" }
			const error2 = { error: { message: "Input is too long: 205000 tokens > 200000 maximum", type: "invalid_request_error" } }
			const error3 = { message: "Request contains 210000 tokens > 200000 maximum allowed" }
			const error4 = { name: "PromptTooLongError", message: "PROMPT_TOO_LONG: some error" }

			expect((handler as any).isPromptTooLongError(error1)).toBe(true)
			expect((handler as any).isPromptTooLongError(error2)).toBe(true)
			expect((handler as any).isPromptTooLongError(error3)).toBe(true)
			expect((handler as any).isPromptTooLongError(error4)).toBe(true)
		})

		it("should not detect other types of errors", () => {
			const error1 = { message: "Rate limit exceeded" }
			const error2 = { error: { message: "Invalid API key", type: "authentication_error" } }
			const error3 = { message: "Network error" }

			expect((handler as any).isPromptTooLongError(error1)).toBe(false)
			expect((handler as any).isPromptTooLongError(error2)).toBe(false)
			expect((handler as any).isPromptTooLongError(error3)).toBe(false)
		})

		it("should handle null/undefined errors", () => {
			expect((handler as any).isPromptTooLongError(null)).toBe(false)
			expect((handler as any).isPromptTooLongError(undefined)).toBe(false)
			expect((handler as any).isPromptTooLongError({})).toBe(false)
		})
	})

	describe("completePrompt error handling", () => {
		it("should re-throw prompt too long errors with enhanced error type", async () => {
			const originalError = { 
				message: "prompt is too long: 208732 tokens > 200000 maximum",
				error: { type: "invalid_request_error" }
			}
			
			const mockCreate = vi.fn().mockRejectedValue(originalError)
			;(handler as any).client.messages.create = mockCreate

			try {
				await handler.completePrompt("test prompt")
				expect.fail("Should have thrown an error")
			} catch (error: any) {
				expect(error.name).toBe("PromptTooLongError")
				expect(error.message).toContain("PROMPT_TOO_LONG:")
				expect(error.originalError).toBe(originalError)
				expect(error.needsContextReduction).toBe(true)
			}
		})

		it("should pass through other errors unchanged", async () => {
			const originalError = { message: "Rate limit exceeded" }
			
			const mockCreate = vi.fn().mockRejectedValue(originalError)
			;(handler as any).client.messages.create = mockCreate

			try {
				await handler.completePrompt("test prompt")
				expect.fail("Should have thrown an error")
			} catch (error: any) {
				expect(error).toBe(originalError)
				expect(error.name).not.toBe("PromptTooLongError")
			}
		})
	})

	describe("createMessage error handling", () => {
		it("should re-throw prompt too long errors with enhanced error type", async () => {
			const originalError = { 
				message: "prompt is too long: 208732 tokens > 200000 maximum",
				error: { type: "invalid_request_error" }
			}
			
			const mockCreate = vi.fn().mockRejectedValue(originalError)
			;(handler as any).client.messages.create = mockCreate

			try {
				const stream = handler.createMessage("system prompt", [{ role: "user", content: "test" }])
				await stream.next() // This should trigger the error
				expect.fail("Should have thrown an error")
			} catch (error: any) {
				expect(error.name).toBe("PromptTooLongError")
				expect(error.message).toContain("PROMPT_TOO_LONG:")
				expect(error.originalError).toBe(originalError)
				expect(error.needsContextReduction).toBe(true)
			}
		})

		it("should pass through other errors unchanged", async () => {
			const originalError = { message: "Rate limit exceeded" }
			
			const mockCreate = vi.fn().mockRejectedValue(originalError)
			;(handler as any).client.messages.create = mockCreate

			try {
				const stream = handler.createMessage("system prompt", [{ role: "user", content: "test" }])
				await stream.next()
				expect.fail("Should have thrown an error")
			} catch (error: any) {
				expect(error).toBe(originalError)
				expect(error.name).not.toBe("PromptTooLongError")
			}
		})
	})
})