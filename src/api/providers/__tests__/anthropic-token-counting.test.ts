// npx jest src/api/providers/__tests__/anthropic-token-counting.test.ts

import { Anthropic } from "@anthropic-ai/sdk"
import { AnthropicHandler } from "../anthropic"
import { CLAUDE_MAX_SAFE_TOKEN_LIMIT } from "../constants"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock the Anthropic client
jest.mock("@anthropic-ai/sdk", () => {
	const mockCountTokensResponse = {
		input_tokens: 5000, // Default token count
	}

	const mockMessageResponse = {
		id: "msg_123",
		type: "message",
		role: "assistant",
		content: [{ type: "text", text: "This is a test response" }],
		model: "claude-3-7-sonnet-20250219",
		stop_reason: "end_turn",
		usage: {
			input_tokens: 5000,
			output_tokens: 100,
		},
	}

	// Mock stream implementation
	const mockStream = {
		[Symbol.asyncIterator]: async function* () {
			yield {
				type: "message_start",
				message: {
					id: "msg_123",
					type: "message",
					role: "assistant",
					content: [],
					model: "claude-3-7-sonnet-20250219",
					stop_reason: null,
					usage: {
						input_tokens: 5000,
						output_tokens: 0,
					},
				},
			}
			yield {
				type: "content_block_start",
				index: 0,
				content_block: {
					type: "text",
					text: "This is a test response",
				},
			}
			yield {
				type: "message_delta",
				usage: {
					output_tokens: 100,
				},
			}
			yield {
				type: "message_stop",
			}
		},
	}

	return {
		Anthropic: jest.fn().mockImplementation(() => {
			return {
				messages: {
					create: jest.fn().mockImplementation((params) => {
						if (params.stream) {
							return mockStream
						}
						return mockMessageResponse
					}),
					countTokens: jest.fn().mockImplementation((params) => {
						// If the messages array is very large, simulate a high token count
						let tokenCount = mockCountTokensResponse.input_tokens

						if (params.messages && params.messages.length > 10) {
							tokenCount = CLAUDE_MAX_SAFE_TOKEN_LIMIT + 10000
						}

						return Promise.resolve({ input_tokens: tokenCount })
					}),
				},
			}
		}),
	}
})

describe("AnthropicHandler Token Counting", () => {
	// Test with Claude 3.7 Sonnet
	describe("with Claude 3.7 Sonnet", () => {
		const options: ApiHandlerOptions = {
			apiKey: "test-key",
			apiModelId: "claude-3-7-sonnet-20250219",
		}

		let handler: AnthropicHandler

		beforeEach(() => {
			handler = new AnthropicHandler(options)
			jest.clearAllMocks()
		})

		it("should count tokens for content blocks", async () => {
			const content = [{ type: "text" as const, text: "Hello, world!" }]
			const count = await handler.countTokens(content)
			expect(count).toBe(5000) // Mock returns 5000
		})

		it("should count tokens for a complete message", async () => {
			const systemPrompt = "You are a helpful assistant."
			const messages = [
				{ role: "user" as const, content: "Hello!" },
				{ role: "assistant" as const, content: "Hi there!" },
				{ role: "user" as const, content: "How are you?" },
			]

			const count = await handler.countMessageTokens(systemPrompt, messages, "claude-3-7-sonnet-20250219")

			expect(count).toBe(5000) // Mock returns 5000
		})

		it("should truncate conversation when token count exceeds limit", async () => {
			// Create a large number of messages to trigger truncation
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = []

			// Add 20 messages to exceed the token limit
			for (let i = 0; i < 20; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}: This is a test message that should have enough content to trigger the token limit when combined with other messages.`,
				})
			}

			// Spy on console.warn to verify warning is logged
			const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()
			const consoleLogSpy = jest.spyOn(console, "log").mockImplementation()

			// Create a message stream
			const stream = handler.createMessage(systemPrompt, messages)

			// Consume the stream to trigger the token counting and truncation
			for await (const _ of stream) {
				// Just consume the stream
			}

			// Verify that warnings were logged about token limit
			expect(consoleWarnSpy).toHaveBeenCalled()
			expect(consoleLogSpy).toHaveBeenCalled()

			// Restore console.warn
			consoleWarnSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})
	})

	// Test with Claude 3 Opus
	describe("with Claude 3 Opus", () => {
		const options: ApiHandlerOptions = {
			apiKey: "test-key",
			apiModelId: "claude-3-opus-20240229",
		}

		let handler: AnthropicHandler

		beforeEach(() => {
			handler = new AnthropicHandler(options)
			jest.clearAllMocks()
		})

		it("should truncate conversation when token count exceeds limit", async () => {
			// Create a large number of messages to trigger truncation
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = []

			// Add 20 messages to exceed the token limit
			for (let i = 0; i < 20; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}: This is a test message that should have enough content to trigger the token limit when combined with other messages.`,
				})
			}

			// Spy on console.warn to verify warning is logged
			const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()
			const consoleLogSpy = jest.spyOn(console, "log").mockImplementation()

			// Create a message stream
			const stream = handler.createMessage(systemPrompt, messages)

			// Consume the stream to trigger the token counting and truncation
			for await (const _ of stream) {
				// Just consume the stream
			}

			// Verify that warnings were logged about token limit
			expect(consoleWarnSpy).toHaveBeenCalled()
			expect(consoleLogSpy).toHaveBeenCalled()

			// Restore console.warn
			consoleWarnSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})
	})

	// Test with Claude 3 Haiku
	describe("with Claude 3 Haiku", () => {
		const options: ApiHandlerOptions = {
			apiKey: "test-key",
			apiModelId: "claude-3-haiku-20240307",
		}

		let handler: AnthropicHandler

		beforeEach(() => {
			handler = new AnthropicHandler(options)
			jest.clearAllMocks()
		})

		it("should truncate conversation when token count exceeds limit", async () => {
			// Create a large number of messages to trigger truncation
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = []

			// Add 20 messages to exceed the token limit
			for (let i = 0; i < 20; i++) {
				messages.push({
					role: i % 2 === 0 ? "user" : "assistant",
					content: `Message ${i}: This is a test message that should have enough content to trigger the token limit when combined with other messages.`,
				})
			}

			// Spy on console.warn to verify warning is logged
			const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()
			const consoleLogSpy = jest.spyOn(console, "log").mockImplementation()

			// Create a message stream
			const stream = handler.createMessage(systemPrompt, messages)

			// Consume the stream to trigger the token counting and truncation
			for await (const _ of stream) {
				// Just consume the stream
			}

			// Verify that warnings were logged about token limit
			expect(consoleWarnSpy).toHaveBeenCalled()
			expect(consoleLogSpy).toHaveBeenCalled()

			// Restore console.warn
			consoleWarnSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})
	})
})
