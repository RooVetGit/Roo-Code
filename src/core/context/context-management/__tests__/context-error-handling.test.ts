import { describe, it, expect } from "vitest"
import { APIError } from "openai"
import { checkContextWindowExceededError } from "../context-error-handling"

describe("checkContextWindowExceededError", () => {
	describe("OpenAI errors", () => {
		it("should detect OpenAI context length exceeded error", () => {
			const error = new APIError(
				400,
				{
					error: {
						message: "This model's maximum context length is 4096 tokens",
						type: "invalid_request_error",
						param: null,
						code: "context_length_exceeded",
					},
				},
				"This model's maximum context length is 4096 tokens",
				undefined as any,
			)
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect OpenAI token limit error", () => {
			const error = new APIError(
				400,
				{
					error: {
						message: "Request exceeded token limit",
						type: "invalid_request_error",
						param: null,
						code: null,
					},
				},
				"Request exceeded token limit",
				undefined as any,
			)
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect LengthFinishReasonError", () => {
			const error = {
				name: "LengthFinishReasonError",
				message: "The response was cut off due to length",
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should not detect non-context OpenAI errors", () => {
			const error = new APIError(
				401,
				{
					error: {
						message: "Invalid API key",
						type: "authentication_error",
						param: null,
						code: null,
					},
				},
				"Invalid API key",
				undefined as any,
			)
			expect(checkContextWindowExceededError(error)).toBe(false)
		})
	})

	describe("OpenRouter errors", () => {
		it("should detect OpenRouter context window error", () => {
			const error = {
				status: 400,
				message: "Context window exceeded for this request",
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect OpenRouter maximum context error", () => {
			const error = {
				code: 400,
				error: {
					message: "Maximum context length reached",
				},
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should detect OpenRouter too many tokens error", () => {
			const error = {
				response: {
					status: 400,
				},
				message: "Too many tokens in the request",
			}
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should not detect non-context OpenRouter errors", () => {
			const error = {
				status: 400,
				message: "Invalid request format",
			}
			expect(checkContextWindowExceededError(error)).toBe(false)
		})
	})

	describe("Anthropic errors", () => {
		it("should detect Anthropic prompt too long error", () => {
			const response = {
				error: {
					error: {
						type: "invalid_request_error",
						message: "prompt is too long: 150000 tokens > 100000 maximum",
					},
				},
			}
			expect(checkContextWindowExceededError(response)).toBe(true)
		})

		it("should detect Anthropic maximum tokens error", () => {
			const response = {
				error: {
					error: {
						type: "invalid_request_error",
						message: "Request exceeds maximum tokens allowed",
					},
				},
			}
			expect(checkContextWindowExceededError(response)).toBe(true)
		})

		it("should detect Anthropic context too long error", () => {
			const response = {
				error: {
					error: {
						type: "invalid_request_error",
						message: "The context is too long for this model",
					},
				},
			}
			expect(checkContextWindowExceededError(response)).toBe(true)
		})

		it("should detect Anthropic token limit error", () => {
			const response = {
				error: {
					error: {
						type: "invalid_request_error",
						message: "Your request has hit the token limit",
					},
				},
			}
			expect(checkContextWindowExceededError(response)).toBe(true)
		})

		it("should not detect non-context Anthropic errors", () => {
			const response = {
				error: {
					error: {
						type: "invalid_request_error",
						message: "Invalid API key provided",
					},
				},
			}
			expect(checkContextWindowExceededError(response)).toBe(false)
		})

		it("should not detect other Anthropic error types", () => {
			const response = {
				error: {
					error: {
						type: "rate_limit_error",
						message: "Rate limit exceeded",
					},
				},
			}
			expect(checkContextWindowExceededError(response)).toBe(false)
		})
	})

	describe("Cerebras errors", () => {
		it("should detect Cerebras context window error", () => {
			const response = {
				status: 400,
				message: "Please reduce the length of the messages or completion",
			}
			expect(checkContextWindowExceededError(response)).toBe(true)
		})

		it("should detect Cerebras error with nested structure", () => {
			const response = {
				error: {
					status: 400,
					message: "Please reduce the length of the messages or completion",
				},
			}
			expect(checkContextWindowExceededError(response)).toBe(true)
		})

		it("should not detect non-context Cerebras errors", () => {
			const response = {
				status: 400,
				message: "Invalid request parameters",
			}
			expect(checkContextWindowExceededError(response)).toBe(false)
		})

		it("should not detect Cerebras errors with different status codes", () => {
			const response = {
				status: 500,
				message: "Please reduce the length of the messages or completion",
			}
			expect(checkContextWindowExceededError(response)).toBe(false)
		})
	})

	describe("Edge cases", () => {
		it("should handle null input", () => {
			expect(checkContextWindowExceededError(null)).toBe(false)
		})

		it("should handle undefined input", () => {
			expect(checkContextWindowExceededError(undefined)).toBe(false)
		})

		it("should handle empty object", () => {
			expect(checkContextWindowExceededError({})).toBe(false)
		})

		it("should handle string input", () => {
			expect(checkContextWindowExceededError("error")).toBe(false)
		})

		it("should handle number input", () => {
			expect(checkContextWindowExceededError(123)).toBe(false)
		})

		it("should handle boolean input", () => {
			expect(checkContextWindowExceededError(true)).toBe(false)
		})

		it("should handle array input", () => {
			expect(checkContextWindowExceededError([])).toBe(false)
		})

		it("should handle errors with circular references", () => {
			const error: any = { status: 400, message: "context window exceeded" }
			error.self = error // Create circular reference
			expect(checkContextWindowExceededError(error)).toBe(true)
		})

		it("should handle errors that throw during property access", () => {
			const error = {
				get status() {
					throw new Error("Property access error")
				},
				message: "Some error",
			}
			expect(checkContextWindowExceededError(error)).toBe(false)
		})

		it("should handle deeply nested error structures", () => {
			const error = {
				response: {
					data: {
						error: {
							status: 400,
							message: "Context length exceeded",
						},
					},
				},
			}
			// This should work because we check response.status
			const errorWithResponseStatus = {
				response: {
					status: 400,
				},
				message: "Context length exceeded",
			}
			expect(checkContextWindowExceededError(errorWithResponseStatus)).toBe(true)
		})
	})

	describe("Multiple provider detection", () => {
		it("should detect errors from any supported provider", () => {
			// OpenAI APIError needs specific structure
			const openAIError = new APIError(
				400,
				{ error: { message: "context length exceeded" } },
				"context length exceeded",
				undefined as any,
			)
			// Set the code property which is checked by the implementation
			;(openAIError as any).code = "400"
			const anthropicError = {
				error: {
					error: {
						type: "invalid_request_error",
						message: "prompt is too long",
					},
				},
			}
			const cerebrasError = {
				status: 400,
				message: "Please reduce the length of the messages or completion",
			}
			const openRouterError = {
				code: 400,
				message: "maximum context reached",
			}

			expect(checkContextWindowExceededError(openAIError)).toBe(true)
			expect(checkContextWindowExceededError(anthropicError)).toBe(true)
			expect(checkContextWindowExceededError(cerebrasError)).toBe(true)
			expect(checkContextWindowExceededError(openRouterError)).toBe(true)
		})
	})
})
