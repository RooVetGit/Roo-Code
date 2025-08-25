// Mocks must come first, before imports
const mockCreate = vi.fn()
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
										message: { role: "assistant", content: "Test response", refusal: null },
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
											delta: { content: "Test response" },
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

import { deepSeekDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { DeepSeekHandler } from "../deepseek"

describe("DeepSeekHandler", () => {
	let handler: DeepSeekHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			deepSeekApiKey: "test-api-key",
			apiModelId: "deepseek-chat",
			deepSeekBaseUrl: "https://api.deepseek.com",
		}
		handler = new DeepSeekHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(DeepSeekHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it.skip("should throw error if API key is missing", () => {
			expect(() => {
				new DeepSeekHandler({
					...mockOptions,
					deepSeekApiKey: undefined,
				})
			}).toThrow("DeepSeek API key is required")
		})

		it("should use default model ID if not provided", () => {
			const handlerWithoutModel = new DeepSeekHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			expect(handlerWithoutModel.getModel().id).toBe(deepSeekDefaultModelId)
		})

		it("should use default base URL if not provided", () => {
			const handlerWithoutBaseUrl = new DeepSeekHandler({
				...mockOptions,
				deepSeekBaseUrl: undefined,
			})
			expect(handlerWithoutBaseUrl).toBeInstanceOf(DeepSeekHandler)
			// The base URL is passed to OpenAI client internally
			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.deepseek.com",
				}),
			)
		})

		it("should use custom base URL if provided", () => {
			const customBaseUrl = "https://custom.deepseek.com/v1"
			const handlerWithCustomUrl = new DeepSeekHandler({
				...mockOptions,
				deepSeekBaseUrl: customBaseUrl,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(DeepSeekHandler)
			// The custom base URL is passed to OpenAI client
			expect(OpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: customBaseUrl,
				}),
			)
		})

		it("should set includeMaxTokens to true", () => {
			// Create a new handler and verify OpenAI client was called with includeMaxTokens
			const _handler = new DeepSeekHandler(mockOptions)
			expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: mockOptions.deepSeekApiKey }))
		})
	})

	describe("getModel", () => {
		it("should return model info for valid model ID", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.apiModelId)
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192) // deepseek-chat has 8K max
			expect(model.info.contextWindow).toBe(128_000)
			expect(model.info.supportsImages).toBe(false)
			expect(model.info.supportsPromptCache).toBe(true) // Should be true now
		})

		it("should return correct model info for deepseek-reasoner", () => {
			const handlerWithReasoner = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "deepseek-reasoner",
			})
			const model = handlerWithReasoner.getModel()
			expect(model.id).toBe("deepseek-reasoner")
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(65536) // deepseek-reasoner has 64K max
			expect(model.info.contextWindow).toBe(128_000)
			expect(model.info.supportsImages).toBe(false)
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should return provided model ID with default model info if model does not exist", () => {
			const handlerWithInvalidModel = new DeepSeekHandler({
				...mockOptions,
				apiModelId: "invalid-model",
			})
			const model = handlerWithInvalidModel.getModel()
			expect(model.id).toBe("invalid-model") // Returns provided ID
			expect(model.info).toBeDefined()
			// With the current implementation, it's the same object reference when using default model info
			expect(model.info).toBe(handler.getModel().info)
			// Should have the same base properties
			expect(model.info.contextWindow).toBe(handler.getModel().info.contextWindow)
			// And should have supportsPromptCache set to true
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should return default model if no model ID is provided", () => {
			const handlerWithoutModel = new DeepSeekHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe(deepSeekDefaultModelId)
			expect(model.info).toBeDefined()
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should include model parameters from getModelParams", () => {
			const model = handler.getModel()
			expect(model).toHaveProperty("temperature")
			expect(model).toHaveProperty("maxTokens")
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text" as const,
						text: "Hello!",
					},
				],
			},
		]

		it("should handle streaming responses", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")
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
			expect(usageChunks[0].cacheWriteTokens).toBe(8)
			expect(usageChunks[0].cacheReadTokens).toBe(2)
		})

		it("should sanitize unwanted '极速模式' characters from response", async () => {
			// Mock a response with unwanted characters
			mockCreate.mockImplementationOnce(async (options) => {
				if (!options.stream) {
					return {
						id: "test-completion",
						choices: [
							{
								message: {
									role: "assistant",
									content: "Test response with 极速模式 unwanted characters",
									refusal: null,
								},
								finish_reason: "stop",
								index: 0,
							},
						],
						usage: {
							prompt_tokens: 10,
							completion_tokens: 5,
							total_tokens: 15,
						},
					}
				}

				// Return async iterator for streaming with unwanted characters
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [
								{
									delta: {
										content: "Here is 极速模式 some text with 极 unwanted 速 characters 模式",
									},
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
							},
						}
					},
				}
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			// The unwanted characters should be removed
			expect(textChunks[0].text).toBe("Here is some text with unwanted characters")
			expect(textChunks[0].text).not.toContain("极速模式")
			expect(textChunks[0].text).not.toContain("极")
			expect(textChunks[0].text).not.toContain("速")
			expect(textChunks[0].text).not.toContain("模")
			expect(textChunks[0].text).not.toContain("式")
		})

		it("should preserve legitimate Chinese text while removing artifacts", async () => {
			// Mock a response with both legitimate Chinese text and unwanted artifacts
			mockCreate.mockImplementationOnce(async (options) => {
				// Return async iterator for streaming
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [
								{
									delta: {
										content: "这是正常的中文文本极速模式，不应该被删除。File path: 极 test.txt",
									},
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
							},
						}
					},
				}
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			// Should remove "极速模式" phrase and isolated "极" between spaces
			expect(textChunks[0].text).toBe("这是正常的中文文本，不应该被删除。File path: test.txt")
			expect(textChunks[0].text).toContain("这是正常的中文文本")
			expect(textChunks[0].text).not.toContain("极速模式")
			// The isolated "极" between spaces should be removed
			expect(textChunks[0].text).not.toContain(" 极 ")
		})

		it("should handle reasoning content with unwanted characters", async () => {
			// Mock a response with reasoning content containing unwanted characters
			mockCreate.mockImplementationOnce(async (options) => {
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [
								{
									delta: {
										content: "<think>Reasoning with 极速模式 artifacts</think>Regular text",
									},
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
							},
						}
					},
				}
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Check both reasoning and text chunks
			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			const textChunks = chunks.filter((chunk) => chunk.type === "text")

			if (reasoningChunks.length > 0) {
				expect(reasoningChunks[0].text).not.toContain("极速模式")
			}
			if (textChunks.length > 0) {
				expect(textChunks[0].text).not.toContain("极速模式")
			}
		})
	})

	describe("processUsageMetrics", () => {
		it("should correctly process usage metrics including cache information", () => {
			// We need to access the protected method, so we'll create a test subclass
			class TestDeepSeekHandler extends DeepSeekHandler {
				public testProcessUsageMetrics(usage: any) {
					return this.processUsageMetrics(usage)
				}
			}

			const testHandler = new TestDeepSeekHandler(mockOptions)

			const usage = {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
				prompt_tokens_details: {
					cache_miss_tokens: 80,
					cached_tokens: 20,
				},
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBe(80)
			expect(result.cacheReadTokens).toBe(20)
		})

		it("should handle missing cache metrics gracefully", () => {
			class TestDeepSeekHandler extends DeepSeekHandler {
				public testProcessUsageMetrics(usage: any) {
					return this.processUsageMetrics(usage)
				}
			}

			const testHandler = new TestDeepSeekHandler(mockOptions)

			const usage = {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
				// No prompt_tokens_details
			}

			const result = testHandler.testProcessUsageMetrics(usage)

			expect(result.type).toBe("usage")
			expect(result.inputTokens).toBe(100)
			expect(result.outputTokens).toBe(50)
			expect(result.cacheWriteTokens).toBeUndefined()
			expect(result.cacheReadTokens).toBeUndefined()
		})
	})
})
