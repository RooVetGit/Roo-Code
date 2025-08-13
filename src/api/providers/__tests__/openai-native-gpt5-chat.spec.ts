import { describe, it, expect, vi, beforeEach } from "vitest"
import { OpenAiNativeHandler } from "../openai-native"
import { ApiHandlerOptions } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"

// Mock OpenAI
vi.mock("openai", () => {
	return {
		default: class MockOpenAI {
			responses = {
				create: vi.fn(),
			}
			chat = {
				completions: {
					create: vi.fn(),
				},
			}
		},
	}
})

describe("OpenAiNativeHandler - GPT-5 Chat Latest", () => {
	let handler: OpenAiNativeHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		vi.clearAllMocks()
		mockOptions = {
			apiModelId: "gpt-5-chat-latest",
			openAiNativeApiKey: "test-api-key",
			openAiNativeBaseUrl: "https://api.openai.com",
		}
		handler = new OpenAiNativeHandler(mockOptions)
	})

	describe("Model Configuration", () => {
		it("should correctly configure gpt-5-chat-latest model", () => {
			const model = handler.getModel()

			expect(model.id).toBe("gpt-5-chat-latest")
			expect(model.info.maxTokens).toBe(128000)
			expect(model.info.contextWindow).toBe(400000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
			expect(model.info.supportsReasoningEffort).toBe(false) // Non-reasoning model
			expect(model.info.description).toBe(
				"GPT-5 Chat Latest: Optimized for conversational AI and non-reasoning tasks",
			)
		})

		it("should not include reasoning effort for gpt-5-chat-latest", () => {
			const model = handler.getModel()

			// Should not have reasoning parameters since it's a non-reasoning model
			expect(model.reasoning).toBeUndefined()
		})
	})

	describe("API Endpoint Selection", () => {
		it("should use Responses API for gpt-5-chat-latest", async () => {
			// Mock fetch for Responses API
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.text.delta","delta":"Hello"}\n\n'),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.done","response":{"id":"test-id","usage":{"input_tokens":10,"output_tokens":5}}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch

			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

			const stream = handler.createMessage("System prompt", messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify it called the Responses API endpoint
			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.openai.com/v1/responses",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Content-Type": "application/json",
						Authorization: "Bearer test-api-key",
					}),
					body: expect.stringContaining('"model":"gpt-5-chat-latest"'),
				}),
			)

			// Verify the request body doesn't include reasoning parameters
			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.reasoning).toBeUndefined()
		})
	})

	describe("Conversation Features", () => {
		it("should support conversation continuity with previous_response_id", async () => {
			// Mock fetch for Responses API
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				body: new ReadableStream({
					start(controller) {
						controller.enqueue(
							new TextEncoder().encode('data: {"type":"response.text.delta","delta":"Response"}\n\n'),
						)
						controller.enqueue(
							new TextEncoder().encode(
								'data: {"type":"response.done","response":{"id":"response-123","usage":{"input_tokens":10,"output_tokens":5}}}\n\n',
							),
						)
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
						controller.close()
					},
				}),
			})
			global.fetch = mockFetch

			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Follow-up question" }]

			const stream = handler.createMessage("System prompt", messages, {
				taskId: "test-task",
				previousResponseId: "previous-response-456",
			})

			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify the request includes previous_response_id
			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
			expect(requestBody.previous_response_id).toBe("previous-response-456")
		})
	})
})
