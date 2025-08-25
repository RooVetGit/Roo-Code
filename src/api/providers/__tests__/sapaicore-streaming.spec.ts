// npx vitest run src/api/providers/__tests__/sapaicore-streaming.spec.ts

import { SapAiCoreHandler } from "../sapaicore.js"
import type { ApiHandlerOptions } from "../../../shared/api.js"
import axios from "axios"

vitest.mock("axios")
const mockedAxios = vitest.mocked(axios)

// Create mock stream that implements async iteration
function createMockStream(chunks: string[]) {
	let index = 0
	return {
		async *[Symbol.asyncIterator]() {
			for (const chunk of chunks) {
				yield Buffer.from(chunk)
			}
		},
		toString() {
			return chunks.join("")
		},
	}
}

describe("SAP AI Core Streaming", () => {
	let handler: SapAiCoreHandler
	let mockOptions: ApiHandlerOptions & {
		sapAiCoreClientId?: string
		sapAiCoreClientSecret?: string
		sapAiCoreTokenUrl?: string
		sapAiResourceGroup?: string
		sapAiCoreBaseUrl?: string
	}

	beforeEach(() => {
		mockOptions = {
			apiKey: "test-api-key",
			apiModelId: "anthropic--claude-3.5-sonnet",
			sapAiCoreClientId: "test-client-id",
			sapAiCoreClientSecret: "test-client-secret",
			sapAiCoreTokenUrl: "https://test.auth.com",
			sapAiResourceGroup: "test-group",
			sapAiCoreBaseUrl: "https://test.ai-core.com",
		}
		handler = new SapAiCoreHandler(mockOptions)

		// Set up authentication and deployments
		const mockToken = {
			access_token: "test-token",
			expires_at: Date.now() + 3600000,
		}
		;(handler as any).token = mockToken
		;(handler as any).deployments = [{ id: "deployment-1", name: "anthropic--claude-3.5-sonnet:1.0" }]

		// Reset mocks
	})

	describe("Anthropic streaming", () => {
		it("should stream Anthropic responses correctly", async () => {
			const streamChunks = [
				'data: {"type":"message_start","message":{"usage":{"input_tokens":15,"output_tokens":0}}}\n',
				'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"Hello"}}\n',
				'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n',
				'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"!"}}\n',
				'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","usage":{"output_tokens":3}}}\n',
			]

			const mockStream = createMockStream(streamChunks)
			mockedAxios.post.mockResolvedValueOnce({ data: mockStream })

			const messages = [{ role: "user" as const, content: "Say hello" }]
			const responses = []

			for await (const chunk of handler.createMessage("You are helpful", messages)) {
				responses.push(chunk)
			}

			expect(responses).toContainEqual({
				type: "usage",
				inputTokens: 15,
				outputTokens: 0,
			})
			expect(responses).toContainEqual({
				type: "text",
				text: "Hello",
			})
			expect(responses).toContainEqual({
				type: "text",
				text: " world",
			})
			expect(responses).toContainEqual({
				type: "text",
				text: "!",
			})
			expect(responses).toContainEqual({
				type: "usage",
				inputTokens: 15,
				outputTokens: 0,
			})
		})
	})

	describe("OpenAI streaming", () => {
		beforeEach(() => {
			const openAiHandler = new SapAiCoreHandler({
				...mockOptions,
				apiModelId: "gpt-4o",
			})
			const mockToken = {
				access_token: "test-token",
				expires_at: Date.now() + 3600000,
			}
			;(openAiHandler as any).token = mockToken
			;(openAiHandler as any).deployments = [{ id: "deployment-2", name: "gpt-4o:1.0" }]
			handler = openAiHandler
		})

		it("should stream OpenAI responses correctly", async () => {
			const streamChunks = [
				'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
				'data: {"choices":[{"delta":{"content":" world"}}]}\n',
				'data: {"choices":[{"delta":{"content":"!"}}]}\n',
				'data: {"usage":{"prompt_tokens":10,"completion_tokens":3}}\n',
				"data: [DONE]\n",
			]

			const mockStream = createMockStream(streamChunks)
			mockedAxios.post.mockResolvedValueOnce({ data: mockStream })

			const messages = [{ role: "user" as const, content: "Say hello" }]
			const responses = []

			for await (const chunk of handler.createMessage("You are helpful", messages)) {
				responses.push(chunk)
			}

			expect(responses).toContainEqual({
				type: "text",
				text: "Hello",
			})
			expect(responses).toContainEqual({
				type: "text",
				text: " world",
			})
			expect(responses).toContainEqual({
				type: "text",
				text: "!",
			})
			expect(responses).toContainEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 3,
			})
		})

		it("should handle O3-mini non-streaming response", async () => {
			const o3Handler = new SapAiCoreHandler({
				...mockOptions,
				apiModelId: "o3-mini",
			})
			const mockToken = {
				access_token: "test-token",
				expires_at: Date.now() + 3600000,
			}
			;(o3Handler as any).token = mockToken
			;(o3Handler as any).deployments = [{ id: "deployment-3", name: "o3-mini:1.0" }]

			const mockResponse = {
				data: {
					choices: [
						{
							message: {
								content: "Hello world!",
							},
						},
					],
					usage: {
						prompt_tokens: 10,
						completion_tokens: 3,
					},
				},
			}

			// Mock both the stream and non-stream calls since o3-mini uses non-stream
			mockedAxios.post
				.mockResolvedValueOnce({ data: createMockStream([]) }) // First call (stream)
				.mockResolvedValueOnce(mockResponse) // Second call (non-stream)

			const messages = [{ role: "user" as const, content: "Say hello" }]
			const responses = []

			for await (const chunk of o3Handler.createMessage("You are helpful", messages)) {
				responses.push(chunk)
			}

			expect(responses).toContainEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 3,
			})
			expect(responses).toContainEqual({
				type: "text",
				text: "Hello world!",
			})
		})
	})

	describe("Gemini streaming", () => {
		beforeEach(() => {
			const geminiHandler = new SapAiCoreHandler({
				...mockOptions,
				apiModelId: "gemini-2.5-flash",
			})
			const mockToken = {
				access_token: "test-token",
				expires_at: Date.now() + 3600000,
			}
			;(geminiHandler as any).token = mockToken
			;(geminiHandler as any).deployments = [{ id: "deployment-3", name: "gemini-2.5-flash:1.0" }]
			handler = geminiHandler
		})

		it("should stream Gemini responses correctly", async () => {
			const streamChunks = [
				'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}],"usageMetadata":{"promptTokenCount":10}}\n',
				'data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}]}\n',
				'data: {"candidates":[{"content":{"parts":[{"text":"!"}]}}],"usageMetadata":{"candidatesTokenCount":3}}\n',
			]

			const mockStream = createMockStream(streamChunks)
			mockedAxios.post.mockResolvedValueOnce({ data: mockStream })

			const messages = [{ role: "user" as const, content: "Say hello" }]
			const responses = []

			for await (const chunk of handler.createMessage("You are helpful", messages)) {
				responses.push(chunk)
			}

			expect(responses).toContainEqual({
				type: "text",
				text: "Hello",
			})
			expect(responses).toContainEqual({
				type: "text",
				text: " world",
			})
			expect(responses).toContainEqual({
				type: "text",
				text: "!",
			})
			expect(responses).toContainEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 3,
			})
		})

		it("should handle Gemini thinking responses", async () => {
			const streamChunks = [
				'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"Let me think..."}]}}]}\n',
				'data: {"candidates":[{"content":{"parts":[{"text":"Hello world!"}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":3,"thoughtsTokenCount":5}}\n',
			]

			const mockStream = createMockStream(streamChunks)
			mockedAxios.post.mockResolvedValueOnce({ data: mockStream })

			const messages = [{ role: "user" as const, content: "Say hello" }]
			const responses = []

			for await (const chunk of handler.createMessage("You are helpful", messages)) {
				responses.push(chunk)
			}

			expect(responses).toContainEqual({
				type: "reasoning",
				text: "Let me think...",
			})
			expect(responses).toContainEqual({
				type: "text",
				text: "Hello world!",
			})
			expect(responses).toContainEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 3,
			})
		})
	})

	describe("Claude 3.7/4 Sonnet streaming", () => {
		beforeEach(() => {
			const sonnetHandler = new SapAiCoreHandler({
				...mockOptions,
				apiModelId: "anthropic--claude-3.7-sonnet",
			})
			const mockToken = {
				access_token: "test-token",
				expires_at: Date.now() + 3600000,
			}
			;(sonnetHandler as any).token = mockToken
			;(sonnetHandler as any).deployments = [{ id: "deployment-4", name: "anthropic--claude-3.7-sonnet:1.0" }]
			handler = sonnetHandler
		})

		it("should stream Claude 3.7 Sonnet responses with proper JSON parsing", async () => {
			const streamChunks = [
				"data: {metadata:{usage:{inputTokens:15,outputTokens:0}}}\n",
				'data: {contentBlockDelta:{delta:{text:"Hello"}}}\n',
				'data: {contentBlockDelta:{delta:{text:" world"}}}\n',
				"data: {metadata:{usage:{inputTokens:15,outputTokens:3,totalTokens:18}}}\n",
			]

			const mockStream = createMockStream(streamChunks)
			mockedAxios.post.mockResolvedValueOnce({ data: mockStream })

			const messages = [{ role: "user" as const, content: "Say hello" }]
			const responses = []

			for await (const chunk of handler.createMessage("You are helpful", messages)) {
				responses.push(chunk)
			}

			expect(responses).toContainEqual({
				type: "usage",
				inputTokens: 0,
				outputTokens: 0,
			})
			expect(responses).toContainEqual({
				type: "text",
				text: "Hello",
			})
			expect(responses).toContainEqual({
				type: "text",
				text: " world",
			})
			expect(responses).toContainEqual({
				type: "usage",
				inputTokens: 15,
				outputTokens: 3,
			})
		})

		it("should handle reasoning content in Claude 3.7 Sonnet", async () => {
			const streamChunks = [
				'data: {contentBlockDelta:{delta:{reasoningContent:{text:"Thinking about this..."}}}}\n',
				'data: {contentBlockDelta:{delta:{text:"Hello world!"}}}\n',
			]

			const mockStream = createMockStream(streamChunks)
			mockedAxios.post.mockResolvedValueOnce({ data: mockStream })

			const messages = [{ role: "user" as const, content: "Say hello" }]
			const responses = []

			for await (const chunk of handler.createMessage("You are helpful", messages)) {
				responses.push(chunk)
			}

			expect(responses).toContainEqual({
				type: "reasoning",
				text: "Thinking about this...",
			})
			expect(responses).toContainEqual({
				type: "text",
				text: "Hello world!",
			})
		})
	})

	describe("Error handling in streaming", () => {
		it("should handle malformed JSON in stream", async () => {
			const streamChunks = [
				'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}\n',
				"data: invalid json\n",
				'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n',
			]

			const mockStream = createMockStream(streamChunks)
			mockedAxios.post.mockResolvedValueOnce({ data: mockStream })

			const consoleSpy = vitest.spyOn(console, "error").mockImplementation(() => {})

			const messages = [{ role: "user" as const, content: "Say hello" }]
			const responses = []

			for await (const chunk of handler.createMessage("You are helpful", messages)) {
				responses.push(chunk)
			}

			expect(consoleSpy).toHaveBeenCalledWith("Failed to parse JSON data:", expect.any(Error))
			expect(responses).toContainEqual({
				type: "text",
				text: "Hello",
			})

			consoleSpy.mockRestore()
		})

		it("should handle stream errors", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield Buffer.from('data: {"type":"message_start"}\n')
					throw new Error("Stream error")
				},
			}

			mockedAxios.post.mockResolvedValueOnce({ data: mockStream })

			const messages = [{ role: "user" as const, content: "Say hello" }]

			await expect(async () => {
				for await (const chunk of handler.createMessage("You are helpful", messages)) {
					// Should throw before yielding chunks
				}
			}).rejects.toThrow("Stream error")
		})
	})
})
