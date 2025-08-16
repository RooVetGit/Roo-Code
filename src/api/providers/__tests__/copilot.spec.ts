import { vi, describe, it, expect, beforeEach } from "vitest"

// Create mock functions at the top level
const mockCreate = vi.fn()

// Mock the CopilotAuthenticator
const mockAuthenticator = {
	getApiKey: vi.fn(),
	isAuthenticated: vi.fn(),
	clearAuth: vi.fn(),
}

vi.mock("../fetchers/copilot", () => ({
	CopilotAuthenticator: {
		getInstance: () => mockAuthenticator,
	},
}))

// Mock getModels from modelCache
vi.mock("../fetchers/modelCache", () => ({
	getModels: vi.fn(),
}))
vi.mock("openai", () => {
	return {
		__esModule: true,
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockCreate.mockImplementation(async (options) => {
						if (!options.stream) {
							return {
								id: "test-completion",
								choices: [
									{
										message: { role: "assistant", content: "Test Copilot response", refusal: null },
										finish_reason: "stop",
										index: 0,
									},
								],
								usage: {
									prompt_tokens: 10,
									completion_tokens: 5,
									total_tokens: 15,
									prompt_tokens_details: {
										cache_miss_tokens: 8,
										cached_tokens: 2,
									},
								},
							}
						}

						// Return async iterator for streaming
						return {
							[Symbol.asyncIterator]: async function* () {
								yield {
									choices: [
										{
											delta: { content: "Test Copilot response" },
											index: 0,
										},
									],
									usage: null,
								}
								yield {
									choices: [
										{
											delta: {},
											index: 0,
										},
									],
									usage: {
										prompt_tokens: 10,
										completion_tokens: 5,
										total_tokens: 15,
										prompt_tokens_details: {
											cache_miss_tokens: 8,
											cached_tokens: 2,
										},
									},
								}
							},
						}
					}),
				},
			},
		})),
	}
})

import OpenAI from "openai"
import type { Anthropic } from "@anthropic-ai/sdk"

import { copilotDefaultModelId, GITHUB_COPILOT_API_BASE } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../../shared/api"
import { getModels } from "../fetchers/modelCache"

import { CopilotHandler } from "../copilot"

const mockGetModels = getModels as any

describe("CopilotHandler", () => {
	let handler: CopilotHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			copilotModelId: "gpt-4",
			apiModelId: "gpt-4",
		}

		// Mock successful authentication
		mockAuthenticator.getApiKey.mockResolvedValue({
			apiKey: "test-api-key",
			apiBase: GITHUB_COPILOT_API_BASE,
		})

		// Mock models
		mockGetModels.mockResolvedValue({
			"gpt-4": {
				maxTokens: 8192,
				contextWindow: 128000,
				supportsImages: false,
				supportsPromptCache: true,
				inputPrice: 0,
				outputPrice: 0,
				description: "GPT-4 via Copilot",
			},
		})

		handler = new CopilotHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", async () => {
			expect(handler).toBeInstanceOf(CopilotHandler)
			mockAuthenticator.getApiKey.mockResolvedValueOnce({
				apiKey: "new-api-key",
				apiBase: GITHUB_COPILOT_API_BASE,
			})
			// Access private method through any cast for testing
			await (handler as any).ensureAuthenticated()

			expect(mockAuthenticator.getApiKey).toHaveBeenCalled()
			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "new-api-key",
					baseURL: GITHUB_COPILOT_API_BASE,
				}),
			)
		})

		it("should set up CopilotAuthenticator", () => {
			expect(mockAuthenticator).toBeDefined()
		})
	})

	describe("ensureAuthenticated", () => {
		it("should authenticate and update client", async () => {
			mockAuthenticator.getApiKey.mockResolvedValueOnce({
				apiKey: "new-api-key",
				apiBase: "https://custom.copilot.api",
			})

			// Access private method through any cast for testing
			await (handler as any).ensureAuthenticated()

			expect(mockAuthenticator.getApiKey).toHaveBeenCalled()
			// The client should be updated with new credentials
			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: "new-api-key",
					baseURL: "https://custom.copilot.api",
				}),
			)
		})

		it("should handle authentication errors", async () => {
			mockAuthenticator.getApiKey.mockRejectedValueOnce(new Error("Auth failed"))

			await expect((handler as any).ensureAuthenticated()).rejects.toThrow(
				"Failed to authenticate with Copilot: Error: Auth failed",
			)
		})
	})

	describe("getModel", () => {
		it("should return model info for valid model ID", async () => {
			const model = await handler.fetchModel()
			expect(model.id).toBe("gpt-4")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(128000)
		})

		it("should return default model if model ID not provided", async () => {
			const handlerWithoutModel = new CopilotHandler({
				...mockOptions,
				copilotModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe(copilotDefaultModelId)
		})

		it("should return fallback info for unknown models", async () => {
			mockGetModels.mockResolvedValueOnce({})
			const handlerWithUnknownModel = new CopilotHandler({
				...mockOptions,
				copilotModelId: "unknown-model",
			})
			const model = handlerWithUnknownModel.getModel()
			expect(model.id).toBe("unknown-model")
			expect(model.info.description).toContain("Copilot Model (Fallback)")
		})
	})

	describe("determineInitiator", () => {
		it("should return 'user' for task messages", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [{ type: "text", text: "<task>Do something</task>" }],
				},
			]
			const initiator = (handler as any).determineInitiator(messages)
			expect(initiator).toBe("user")
		})

		it("should return 'agent' for assistant messages", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [{ type: "text", text: "I can help with that." }],
				},
			]
			const initiator = (handler as any).determineInitiator(messages)
			expect(initiator).toBe("agent")
		})

		it("should return 'agent' for tool result messages", () => {
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "test-tool",
							content: "Tool executed successfully",
						},
					],
				},
			]
			const initiator = (handler as any).determineInitiator(messages)
			expect(initiator).toBe("agent")
		})

		it("should return 'user' for empty messages array", () => {
			const messages: Anthropic.Messages.MessageParam[] = []
			const initiator = (handler as any).determineInitiator(messages)
			expect(initiator).toBe("user")
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful coding assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text" as const,
						text: "<user_message>Write a function to reverse a string</user_message>",
					},
				],
			},
		]

		beforeEach(() => {
			// Reset authentication mock for each test
			mockAuthenticator.getApiKey.mockResolvedValue({
				apiKey: "test-api-key",
				apiBase: GITHUB_COPILOT_API_BASE,
			})
		})

		it("should handle streaming responses", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test Copilot response")

			// Verify authentication was called
			expect(mockAuthenticator.getApiKey).toHaveBeenCalled()
		})

		it("should include X-Initiator header", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockCreate).toHaveBeenCalledWith(
				expect.any(Object),
				expect.objectContaining({
					headers: {
						"X-Initiator": "user",
					},
				}),
			)
		})

		it("should include usage information", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
			expect(usageChunks[0].inputTokens).toBe(10)
			expect(usageChunks[0].outputTokens).toBe(5)
		})

		it("should include cache metrics in usage information", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks.length).toBeGreaterThan(0)
			const chunk = usageChunks[0]
			expect(chunk.cacheWriteTokens).toBe(8)
			expect(chunk.cacheReadTokens).toBe(2)
		})

		it("should handle authentication failures gracefully", async () => {
			mockAuthenticator.getApiKey.mockRejectedValueOnce(new Error("Auth failed"))

			const stream = handler.createMessage(systemPrompt, messages)

			await expect(async () => {
				for await (const chunk of stream) {
					// Should throw before yielding any chunks
				}
			}).rejects.toThrow("Failed to authenticate with Copilot")
		})
	})

	describe("completePrompt", () => {
		it("should complete a simple prompt", async () => {
			const prompt = "Write a hello world function"
			const result = await handler.completePrompt(prompt)

			expect(result).toBe("Test Copilot response")
			expect(mockAuthenticator.getApiKey).toHaveBeenCalled()
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: [{ role: "user", content: prompt }],
				}),
			)
		})

		it("should handle authentication errors in completePrompt", async () => {
			mockAuthenticator.getApiKey.mockRejectedValueOnce(new Error("Auth failed"))

			await expect(handler.completePrompt("test prompt")).rejects.toThrow(
				"Copilot completion error: Failed to authenticate with Copilot: Error: Auth failed",
			)
		})

		it("should handle API errors in completePrompt", async () => {
			mockCreate.mockRejectedValueOnce(new Error("API Error"))

			await expect(handler.completePrompt("test prompt")).rejects.toThrow("API Error")
		})
	})

	describe("authentication methods", () => {
		it("should check if authenticated", async () => {
			mockAuthenticator.isAuthenticated.mockResolvedValueOnce(true)

			const result = await handler.isAuthenticated()
			expect(result).toBe(true)
			expect(mockAuthenticator.isAuthenticated).toHaveBeenCalled()
		})

		it("should clear authentication", async () => {
			await handler.clearAuth()
			expect(mockAuthenticator.clearAuth).toHaveBeenCalled()
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly process usage metrics including cache information", () => {
			const usage = {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
				prompt_tokens_details: {
					cache_miss_tokens: 80,
					cached_tokens: 20,
				},
			}

			const result = (handler as any).processUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(80)
			expect(result.cacheReadTokens).toBe(20)
		})

		it("should handle missing usage data gracefully", () => {
			const usage = {
				prompt_tokens: 100,
				completion_tokens: 50,
				// No details
			}

			const result = (handler as any).processUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})
	})

	describe("fetchModel", () => {
		it("should fetch models from cache and return current model", async () => {
			const model = await handler.fetchModel()

			expect(mockGetModels).toHaveBeenCalledWith({ provider: "copilot" })
			expect(model.id).toBe("gpt-4")
			expect(model.info).toBeDefined()
		})

		it("should handle empty models cache", async () => {
			mockGetModels.mockResolvedValueOnce({})

			const model = await handler.fetchModel()

			expect(model.id).toBe("gpt-4")
			expect(model.info.description).toContain("Copilot Model (Fallback)")
		})
	})
})
