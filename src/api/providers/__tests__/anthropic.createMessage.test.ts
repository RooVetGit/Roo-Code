// npx jest src/api/providers/__tests__/anthropic.createMessage.test.ts

import { AnthropicHandler } from "../anthropic"
import { ApiHandlerOptions } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"
import { ApiStreamChunk } from "../../transform/stream"
import { fail } from "assert"

// Define custom error type for tests
interface ApiError extends Error {
	status?: number
}

// Mock Anthropic SDK
jest.mock("@anthropic-ai/sdk", () => {
	return {
		Anthropic: jest.fn().mockImplementation(() => ({
			messages: {
				create: jest.fn(),
			},
		})),
	}
})

describe("AnthropicHandler.createMessage", () => {
	let handler: AnthropicHandler
	let mockCreate: jest.Mock
	const mockOptions: ApiHandlerOptions = {
		apiKey: "test-api-key",
		apiModelId: "claude-3-5-sonnet-20241022",
	}
	const systemPrompt = "You are a helpful assistant."
	const messages: Anthropic.Messages.MessageParam[] = [
		{
			role: "user",
			content: [{ type: "text" as const, text: "Hello" }],
		},
	]

	beforeEach(() => {
		jest.clearAllMocks()
		handler = new AnthropicHandler(mockOptions)
		mockCreate = handler["client"].messages.create as jest.Mock

		// Default mock implementation for successful streaming
		mockCreate.mockResolvedValue({
			async *[Symbol.asyncIterator]() {
				yield {
					type: "message_start",
					message: {
						usage: {
							input_tokens: 100,
							output_tokens: 50,
							cache_creation_input_tokens: 20,
							cache_read_input_tokens: 10,
						},
					},
				}
				yield {
					type: "content_block_start",
					index: 0,
					content_block: {
						type: "text",
						text: "Hello",
					},
				}
				yield {
					type: "content_block_delta",
					delta: {
						type: "text_delta",
						text: " world",
					},
				}
			},
		})
	})

	it("should handle successful streaming", async () => {
		const stream = handler.createMessage(systemPrompt, messages)
		const chunks: ApiStreamChunk[] = []

		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		expect(chunks.length).toBeGreaterThan(0)
		expect(chunks[0]).toEqual({
			type: "usage",
			inputTokens: 100,
			outputTokens: 50,
			cacheWriteTokens: 20,
			cacheReadTokens: 10,
		})
		expect(chunks[1]).toEqual({
			type: "text",
			text: "Hello",
		})
		expect(chunks[2]).toEqual({
			type: "text",
			text: " world",
		})
	})

	it("should handle standard errors with proper format", async () => {
		mockCreate.mockImplementationOnce(() => {
			throw new Error("Standard error")
		})

		const stream = handler.createMessage(systemPrompt, messages)
		try {
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(500)
			expect(parsedError.message).toBe("Standard error")
			expect(parsedError.error.metadata.raw).toBe("Standard error")
		}
	})

	it("should handle rate limit errors with proper format", async () => {
		mockCreate.mockImplementationOnce(() => {
			const error = new Error("Rate limit exceeded") as ApiError
			error.status = 429
			throw error
		})

		const stream = handler.createMessage(systemPrompt, messages)
		try {
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(429)
			expect(parsedError.message).toBe("Rate limit exceeded")
			expect(parsedError.errorDetails[0]["@type"]).toBe("type.googleapis.com/google.rpc.RetryInfo")
		}
	})

	it("should handle rate limit errors with message text", async () => {
		mockCreate.mockImplementationOnce(() => {
			throw new Error("You have exceeded your rate limit")
		})

		const stream = handler.createMessage(systemPrompt, messages)
		try {
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(429)
			expect(parsedError.message).toBe("Rate limit exceeded")
		}
	})

	it("should handle network errors with proper format", async () => {
		mockCreate.mockImplementationOnce(() => {
			const error = new Error("Network error") as ApiError
			error.status = 503
			throw error
		})

		const stream = handler.createMessage(systemPrompt, messages)
		try {
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(503)
			expect(parsedError.message).toBe("Network error")
		}
	})

	it("should handle authentication errors with proper format", async () => {
		mockCreate.mockImplementationOnce(() => {
			const error = new Error("Invalid API key") as ApiError
			error.status = 401
			throw error
		})

		const stream = handler.createMessage(systemPrompt, messages)
		try {
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(401)
			expect(parsedError.message).toBe("Authentication error")
		}
	})

	it("should handle object errors with proper format", async () => {
		mockCreate.mockImplementationOnce(() => {
			const error = {
				status: 400,
				message: "Bad request",
				error: {
					type: "invalid_request_error",
					param: "model",
				},
			}
			// Throw as object directly to test object error handling
			throw error
		})

		const stream = handler.createMessage(systemPrompt, messages)
		try {
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(400)
			expect(parsedError.message).toBe("Bad request")
			expect(parsedError.error.metadata.param).toBe("model")
		}
	})

	it("should handle errors during streaming", async () => {
		// Mock a stream that throws after yielding some data
		mockCreate.mockResolvedValueOnce({
			async *[Symbol.asyncIterator]() {
				yield {
					type: "message_start",
					message: {
						usage: {
							input_tokens: 100,
							output_tokens: 50,
						},
					},
				}
				yield {
					type: "content_block_start",
					index: 0,
					content_block: {
						type: "text",
						text: "This is the beginning of a response",
					},
				}
				// Simulate error during streaming
				throw new Error("Stream interrupted")
			},
		})

		const stream = handler.createMessage(systemPrompt, messages)
		const chunks: ApiStreamChunk[] = []

		try {
			for await (const chunk of stream) {
				chunks.push(chunk)
			}
			fail("Expected error to be thrown")
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			// Parse the error message as JSON
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(500)
			expect(parsedError.message).toBe("Stream interrupted")
			// Verify we got some chunks before the error
			expect(chunks.length).toBeGreaterThan(0)
		}
	})

	it("should handle thinking mode for supported models", async () => {
		const thinkingHandler = new AnthropicHandler({
			apiKey: "test-api-key",
			apiModelId: "claude-3-7-sonnet-20250219:thinking",
			modelMaxThinkingTokens: 16384,
		})

		const thinkingMockCreate = thinkingHandler["client"].messages.create as jest.Mock

		// Mock a stream with thinking content
		thinkingMockCreate.mockResolvedValueOnce({
			async *[Symbol.asyncIterator]() {
				yield {
					type: "message_start",
					message: {
						usage: {
							input_tokens: 100,
							output_tokens: 50,
						},
					},
				}
				yield {
					type: "content_block_start",
					index: 0,
					content_block: {
						type: "thinking",
						thinking: "Let me think about this...",
					},
				}
				yield {
					type: "content_block_delta",
					delta: {
						type: "thinking_delta",
						thinking: " I need to consider all options.",
					},
				}
				yield {
					type: "content_block_start",
					index: 1,
					content_block: {
						type: "text",
						text: "Here's my answer:",
					},
				}
				// We need to make sure the text is properly captured
				// The issue is that the handler might be ignoring empty text deltas
				// Let's add a non-empty text delta
				yield {
					type: "content_block_delta",
					delta: {
						type: "text_delta",
						text: " Additional text",
					},
				}
			},
		})

		const stream = thinkingHandler.createMessage(systemPrompt, messages)
		const chunks: ApiStreamChunk[] = []

		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		// Verify we got thinking chunks
		const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
		expect(reasoningChunks.length).toBeGreaterThan(0)
		expect(reasoningChunks[0].text).toBe("Let me think about this...")
		expect(reasoningChunks[1].text).toBe(" I need to consider all options.")

		// Verify we also got text chunks
		const textChunks = chunks.filter((chunk) => chunk.type === "text")
		expect(textChunks.length).toBeGreaterThan(0)

		// The first text chunk is a newline because chunk.index > 0 in the handler
		expect(textChunks[0].text).toBe("\n")
		// The second text chunk is from content_block_start
		expect(textChunks[1].text).toBe("Here's my answer:")
		// The third text chunk is from content_block_delta
		expect(textChunks[2].text).toBe(" Additional text")

		// Verify the API was called with thinking parameter
		expect(thinkingMockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				thinking: { type: "enabled", budget_tokens: 16384 },
			}),
			expect.anything(),
		)
	})
})
