// npx vitest run api/providers/__tests__/openai.spec.ts

import { OpenAiHandler, getOpenAiModels } from "../openai"
import { ApiHandlerOptions } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { Package } from "../../../shared/package"
import axios from "axios"

const mockCreate = vitest.fn()
const mockResponsesCreate = vitest.fn()

vitest.mock("openai", () => {
	const mockConstructor = vitest.fn()
	const makeClient = () => ({
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
							},
						}
					}

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
								},
							}
						},
					}
				}),
			},
		},
		responses: {
			create: mockResponsesCreate.mockImplementation(async (options) => {
				// Default happy-path mock for non-streaming Responses API
				return {
					id: "test-response",
					output_text: "Test response",
					usage: {
						input_tokens: 10,
						output_tokens: 5,
						total_tokens: 15,
					},
				}
			}),
		},
	})
	return {
		__esModule: true,
		default: mockConstructor.mockImplementation((args: any) => makeClient()),
		AzureOpenAI: mockConstructor.mockImplementation((args: any) => makeClient()),
	}
})

// Mock axios for getOpenAiModels tests
vitest.mock("axios", () => ({
	default: {
		get: vitest.fn(),
	},
}))

describe("OpenAiHandler", () => {
	let handler: OpenAiHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			openAiApiKey: "test-api-key",
			openAiModelId: "gpt-4",
			openAiBaseUrl: "https://api.openai.com/v1",
		}
		handler = new OpenAiHandler(mockOptions)
		mockCreate.mockClear()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(OpenAiHandler)
			expect(handler.getModel().id).toBe(mockOptions.openAiModelId)
		})

		it("should use custom base URL if provided", () => {
			const customBaseUrl = "https://custom.openai.com/v1"
			const handlerWithCustomUrl = new OpenAiHandler({
				...mockOptions,
				openAiBaseUrl: customBaseUrl,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(OpenAiHandler)
		})

		it("should set default headers correctly", () => {
			// Check that the OpenAI constructor was called with correct parameters
			expect(vi.mocked(OpenAI)).toHaveBeenCalledWith({
				baseURL: expect.any(String),
				apiKey: expect.any(String),
				defaultHeaders: {
					"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
					"X-Title": "Roo Code",
					"User-Agent": `RooCode/${Package.version}`,
				},
				timeout: expect.any(Number),
			})
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

		it("should handle non-streaming mode", async () => {
			const handler = new OpenAiHandler({
				...mockOptions,
				openAiStreamingEnabled: false,
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunk = chunks.find((chunk) => chunk.type === "text")
			const usageChunk = chunks.find((chunk) => chunk.type === "usage")

			expect(textChunk).toBeDefined()
			expect(textChunk?.text).toBe("Test response")
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.inputTokens).toBe(10)
			expect(usageChunk?.outputTokens).toBe(5)
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
			expect(textChunks[0].text).toBe("Test response")
		})

		it("should include reasoning_effort when reasoning effort is enabled", async () => {
			const reasoningOptions: ApiHandlerOptions = {
				...mockOptions,
				enableReasoningEffort: true,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					supportsPromptCache: false,
					supportsReasoningEffort: true,
					reasoningEffort: "high",
				},
			}
			const reasoningHandler = new OpenAiHandler(reasoningOptions)
			const stream = reasoningHandler.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called with reasoning_effort
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.reasoning_effort).toBe("high")
		})

		it("should not include reasoning_effort when reasoning effort is disabled", async () => {
			const noReasoningOptions: ApiHandlerOptions = {
				...mockOptions,
				enableReasoningEffort: false,
				openAiCustomModelInfo: { contextWindow: 128_000, supportsPromptCache: false },
			}
			const noReasoningHandler = new OpenAiHandler(noReasoningOptions)
			const stream = noReasoningHandler.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called without reasoning_effort
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.reasoning_effort).toBeUndefined()
		})

		it("should include max_tokens when includeMaxTokens is true", async () => {
			const optionsWithMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: true,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithMaxTokens = new OpenAiHandler(optionsWithMaxTokens)
			const stream = handlerWithMaxTokens.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called with max_tokens
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.max_completion_tokens).toBe(4096)
		})

		it("should not include max_tokens when includeMaxTokens is false", async () => {
			const optionsWithoutMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: false,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithoutMaxTokens = new OpenAiHandler(optionsWithoutMaxTokens)
			const stream = handlerWithoutMaxTokens.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called without max_tokens
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.max_completion_tokens).toBeUndefined()
		})

		it("should not include max_tokens when includeMaxTokens is undefined", async () => {
			const optionsWithUndefinedMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				// includeMaxTokens is not set, should not include max_tokens
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096,
					supportsPromptCache: false,
				},
			}
			const handlerWithDefaultMaxTokens = new OpenAiHandler(optionsWithUndefinedMaxTokens)
			const stream = handlerWithDefaultMaxTokens.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called without max_tokens
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.max_completion_tokens).toBeUndefined()
		})

		it("should use user-configured modelMaxTokens instead of model default maxTokens", async () => {
			const optionsWithUserMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: true,
				modelMaxTokens: 32000, // User-configured value
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096, // Model's default value (should not be used)
					supportsPromptCache: false,
				},
			}
			const handlerWithUserMaxTokens = new OpenAiHandler(optionsWithUserMaxTokens)
			const stream = handlerWithUserMaxTokens.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called with user-configured modelMaxTokens (32000), not model default maxTokens (4096)
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.max_completion_tokens).toBe(32000)
		})

		it("should fallback to model default maxTokens when user modelMaxTokens is not set", async () => {
			const optionsWithoutUserMaxTokens: ApiHandlerOptions = {
				...mockOptions,
				includeMaxTokens: true,
				// modelMaxTokens is not set
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 4096, // Model's default value (should be used as fallback)
					supportsPromptCache: false,
				},
			}
			const handlerWithoutUserMaxTokens = new OpenAiHandler(optionsWithoutUserMaxTokens)
			const stream = handlerWithoutUserMaxTokens.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called with model default maxTokens (4096) as fallback
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.max_completion_tokens).toBe(4096)
		})

		it("should omit temperature when modelTemperature is undefined", async () => {
			const optionsWithoutTemperature: ApiHandlerOptions = {
				...mockOptions,
				// modelTemperature is not set, should not include temperature
			}
			const handlerWithoutTemperature = new OpenAiHandler(optionsWithoutTemperature)
			const stream = handlerWithoutTemperature.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called without temperature
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("temperature")
		})

		it("should include temperature when modelTemperature is explicitly set to 0", async () => {
			const optionsWithZeroTemperature: ApiHandlerOptions = {
				...mockOptions,
				modelTemperature: 0,
			}
			const handlerWithZeroTemperature = new OpenAiHandler(optionsWithZeroTemperature)
			const stream = handlerWithZeroTemperature.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called with temperature: 0
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.temperature).toBe(0)
		})

		it("should include temperature when modelTemperature is set to a non-zero value", async () => {
			const optionsWithCustomTemperature: ApiHandlerOptions = {
				...mockOptions,
				modelTemperature: 0.7,
			}
			const handlerWithCustomTemperature = new OpenAiHandler(optionsWithCustomTemperature)
			const stream = handlerWithCustomTemperature.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called with temperature: 0.7
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.temperature).toBe(0.7)
		})

		it("should include DEEP_SEEK_DEFAULT_TEMPERATURE for deepseek-reasoner models when temperature is not set", async () => {
			const deepseekOptions: ApiHandlerOptions = {
				...mockOptions,
				openAiModelId: "deepseek-reasoner",
				// modelTemperature is not set
			}
			const deepseekHandler = new OpenAiHandler(deepseekOptions)
			const stream = deepseekHandler.createMessage(systemPrompt, messages)
			// Consume the stream to trigger the API call
			for await (const _chunk of stream) {
			}
			// Assert the mockCreate was called with DEEP_SEEK_DEFAULT_TEMPERATURE (0.6)
			expect(mockCreate).toHaveBeenCalled()
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.temperature).toBe(0.6)
		})
	})

	describe("error handling", () => {
		const testMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text" as const,
						text: "Hello",
					},
				],
			},
		]

		it("should handle API errors", async () => {
			mockCreate.mockRejectedValueOnce(new Error("API Error"))

			const stream = handler.createMessage("system prompt", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow("API Error")
		})

		it("should handle rate limiting", async () => {
			const rateLimitError = new Error("Rate limit exceeded")
			rateLimitError.name = "Error"
			;(rateLimitError as any).status = 429
			mockCreate.mockRejectedValueOnce(rateLimitError)

			const stream = handler.createMessage("system prompt", testMessages)

			await expect(async () => {
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow("Rate limit exceeded")
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockCreate).toHaveBeenCalledWith(
				{
					model: mockOptions.openAiModelId,
					messages: [{ role: "user", content: "Test prompt" }],
				},
				{},
			)
		})

		it("should handle API errors", async () => {
			mockCreate.mockRejectedValueOnce(new Error("API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("OpenAI completion error: API Error")
		})

		it("should handle empty response", async () => {
			mockCreate.mockImplementationOnce(() => ({
				choices: [{ message: { content: "" } }],
			}))
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})

	describe("getModel", () => {
		it("should return model info with sane defaults", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.openAiModelId)
			expect(model.info).toBeDefined()
			expect(model.info.contextWindow).toBe(128_000)
			expect(model.info.supportsImages).toBe(true)
		})

		it("should handle undefined model ID", () => {
			const handlerWithoutModel = new OpenAiHandler({
				...mockOptions,
				openAiModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe("")
			expect(model.info).toBeDefined()
		})
	})

	describe("Azure AI Inference Service", () => {
		const azureOptions = {
			...mockOptions,
			openAiBaseUrl: "https://test.services.ai.azure.com",
			openAiModelId: "deepseek-v3",
			azureApiVersion: "2024-05-01-preview",
		}

		it("should initialize with Azure AI Inference Service configuration", () => {
			const azureHandler = new OpenAiHandler(azureOptions)
			expect(azureHandler).toBeInstanceOf(OpenAiHandler)
			expect(azureHandler.getModel().id).toBe(azureOptions.openAiModelId)
		})

		it("should handle streaming responses with Azure AI Inference Service", async () => {
			const azureHandler = new OpenAiHandler(azureOptions)
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = azureHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Test response")

			// Verify the API call was made with correct Azure AI Inference Service path
			expect(mockCreate).toHaveBeenCalledWith(
				{
					model: azureOptions.openAiModelId,
					messages: [
						{ role: "system", content: systemPrompt },
						{ role: "user", content: "Hello!" },
					],
					stream: true,
					stream_options: { include_usage: true },
					// temperature should be omitted when not set
				},
				{ path: "/models/chat/completions" },
			)

			// Verify max_tokens is NOT included when includeMaxTokens is not set
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("max_completion_tokens")
		})

		it("should handle non-streaming responses with Azure AI Inference Service", async () => {
			const azureHandler = new OpenAiHandler({
				...azureOptions,
				openAiStreamingEnabled: false,
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = azureHandler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBeGreaterThan(0)
			const textChunk = chunks.find((chunk) => chunk.type === "text")
			const usageChunk = chunks.find((chunk) => chunk.type === "usage")

			expect(textChunk).toBeDefined()
			expect(textChunk?.text).toBe("Test response")
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.inputTokens).toBe(10)
			expect(usageChunk?.outputTokens).toBe(5)

			// Verify the API call was made with correct Azure AI Inference Service path
			expect(mockCreate).toHaveBeenCalledWith(
				{
					model: azureOptions.openAiModelId,
					messages: [
						{ role: "user", content: systemPrompt },
						{ role: "user", content: "Hello!" },
					],
				},
				{ path: "/models/chat/completions" },
			)

			// Verify max_tokens is NOT included when includeMaxTokens is not set
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("max_completion_tokens")
		})

		it("should handle completePrompt with Azure AI Inference Service", async () => {
			const azureHandler = new OpenAiHandler(azureOptions)
			const result = await azureHandler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockCreate).toHaveBeenCalledWith(
				{
					model: azureOptions.openAiModelId,
					messages: [{ role: "user", content: "Test prompt" }],
				},
				{ path: "/models/chat/completions" },
			)

			// Verify max_tokens is NOT included when includeMaxTokens is not set
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("max_completion_tokens")
		})
	})

	describe("Grok xAI Provider", () => {
		const grokOptions = {
			...mockOptions,
			openAiBaseUrl: "https://api.x.ai/v1",
			openAiModelId: "grok-1",
		}

		it("should initialize with Grok xAI configuration", () => {
			const grokHandler = new OpenAiHandler(grokOptions)
			expect(grokHandler).toBeInstanceOf(OpenAiHandler)
			expect(grokHandler.getModel().id).toBe(grokOptions.openAiModelId)
		})

		it("should exclude stream_options when streaming with Grok xAI", async () => {
			const grokHandler = new OpenAiHandler(grokOptions)
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = grokHandler.createMessage(systemPrompt, messages)
			await stream.next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: grokOptions.openAiModelId,
					stream: true,
				}),
				{},
			)

			const mockCalls = mockCreate.mock.calls
			const lastCall = mockCalls[mockCalls.length - 1]
			expect(lastCall[0]).not.toHaveProperty("stream_options")
		})
	})

	describe("O3 Family Models", () => {
		const o3Options = {
			...mockOptions,
			openAiModelId: "o3-mini",
			openAiCustomModelInfo: {
				contextWindow: 128_000,
				maxTokens: 65536,
				supportsPromptCache: false,
				reasoningEffort: "medium" as "low" | "medium" | "high",
			},
		}

		it("should handle O3 model with streaming and include max_completion_tokens when includeMaxTokens is true", async () => {
			const o3Handler = new OpenAiHandler({
				...o3Options,
				includeMaxTokens: true,
				modelMaxTokens: 32000,
				modelTemperature: 0.5,
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = o3Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "o3-mini",
					messages: [
						{
							role: "developer",
							content: "Formatting re-enabled\nYou are a helpful assistant.",
						},
						{ role: "user", content: "Hello!" },
					],
					stream: true,
					stream_options: { include_usage: true },
					reasoning_effort: "medium",
					temperature: undefined,
					// O3 models do not support deprecated max_tokens but do support max_completion_tokens
					max_completion_tokens: 32000,
				}),
				{},
			)
		})

		it("should handle O3 model with streaming and exclude max_tokens when includeMaxTokens is false", async () => {
			const o3Handler = new OpenAiHandler({
				...o3Options,
				includeMaxTokens: false,
				modelTemperature: 0.7,
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = o3Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "o3-mini",
					messages: [
						{
							role: "developer",
							content: "Formatting re-enabled\nYou are a helpful assistant.",
						},
						{ role: "user", content: "Hello!" },
					],
					stream: true,
					stream_options: { include_usage: true },
					reasoning_effort: "medium",
					temperature: undefined,
				}),
				{},
			)

			// Verify max_tokens is NOT included
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("max_completion_tokens")
		})

		it("should handle O3 model non-streaming with reasoning_effort and max_completion_tokens when includeMaxTokens is true", async () => {
			const o3Handler = new OpenAiHandler({
				...o3Options,
				openAiStreamingEnabled: false,
				includeMaxTokens: true,
				modelTemperature: 0.3,
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = o3Handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "o3-mini",
					messages: [
						{
							role: "developer",
							content: "Formatting re-enabled\nYou are a helpful assistant.",
						},
						{ role: "user", content: "Hello!" },
					],
					reasoning_effort: "medium",
					temperature: undefined,
					// O3 models do not support deprecated max_tokens but do support max_completion_tokens
					max_completion_tokens: 65536, // Using default maxTokens from o3Options
				}),
				{},
			)

			// Verify stream is not set
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("stream")
		})

		it("should use default temperature of 0 when not specified for O3 models", async () => {
			const o3Handler = new OpenAiHandler({
				...o3Options,
				// No modelTemperature specified
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = o3Handler.createMessage(systemPrompt, messages)
			await stream.next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: undefined, // Temperature is not supported for O3 models
				}),
				{},
			)
		})

		it("should handle O3 model with Azure AI Inference Service respecting includeMaxTokens", async () => {
			const o3AzureHandler = new OpenAiHandler({
				...o3Options,
				openAiBaseUrl: "https://test.services.ai.azure.com",
				includeMaxTokens: false, // Should NOT include max_tokens
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = o3AzureHandler.createMessage(systemPrompt, messages)
			await stream.next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "o3-mini",
				}),
				{ path: "/models/chat/completions" },
			)

			// Verify max_tokens is NOT included when includeMaxTokens is false
			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("max_completion_tokens")
		})

		it("should NOT include max_tokens for O3 model with Azure AI Inference Service even when includeMaxTokens is true", async () => {
			const o3AzureHandler = new OpenAiHandler({
				...o3Options,
				openAiBaseUrl: "https://test.services.ai.azure.com",
				includeMaxTokens: true, // Should include max_tokens
			})
			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: "Hello!",
				},
			]

			const stream = o3AzureHandler.createMessage(systemPrompt, messages)
			await stream.next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "o3-mini",
					// O3 models do not support max_tokens
				}),
				{ path: "/models/chat/completions" },
			)
		})
	})
})

describe("getOpenAiModels", () => {
	beforeEach(() => {
		vi.mocked(axios.get).mockClear()
	})

	it("should return empty array when baseUrl is not provided", async () => {
		const result = await getOpenAiModels(undefined, "test-key")
		expect(result).toEqual([])
		expect(axios.get).not.toHaveBeenCalled()
	})

	it("should return empty array when baseUrl is empty string", async () => {
		const result = await getOpenAiModels("", "test-key")
		expect(result).toEqual([])
		expect(axios.get).not.toHaveBeenCalled()
	})

	it("should trim whitespace from baseUrl", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "gpt-4" }, { id: "gpt-3.5-turbo" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		const result = await getOpenAiModels("  https://api.openai.com/v1  ", "test-key")

		expect(axios.get).toHaveBeenCalledWith("https://api.openai.com/v1/models", expect.any(Object))
		expect(result).toEqual(["gpt-4", "gpt-3.5-turbo"])
	})

	it("should handle baseUrl with trailing spaces", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "model-1" }, { id: "model-2" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		const result = await getOpenAiModels("https://api.example.com/v1 ", "test-key")

		expect(axios.get).toHaveBeenCalledWith("https://api.example.com/v1/models", expect.any(Object))
		expect(result).toEqual(["model-1", "model-2"])
	})

	it("should handle baseUrl with leading spaces", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "model-1" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		const result = await getOpenAiModels(" https://api.example.com/v1", "test-key")

		expect(axios.get).toHaveBeenCalledWith("https://api.example.com/v1/models", expect.any(Object))
		expect(result).toEqual(["model-1"])
	})

	it("should return empty array for invalid URL after trimming", async () => {
		const result = await getOpenAiModels("   not-a-valid-url   ", "test-key")
		expect(result).toEqual([])
		expect(axios.get).not.toHaveBeenCalled()
	})

	it("should include authorization header when apiKey is provided", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "model-1" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		await getOpenAiModels("https://api.example.com/v1", "test-api-key")

		expect(axios.get).toHaveBeenCalledWith(
			"https://api.example.com/v1/models",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer test-api-key",
				}),
			}),
		)
	})

	it("should include custom headers when provided", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "model-1" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		const customHeaders = {
			"X-Custom-Header": "custom-value",
		}

		await getOpenAiModels("https://api.example.com/v1", "test-key", customHeaders)

		expect(axios.get).toHaveBeenCalledWith(
			"https://api.example.com/v1/models",
			expect.objectContaining({
				headers: expect.objectContaining({
					"X-Custom-Header": "custom-value",
					Authorization: "Bearer test-key",
				}),
			}),
		)
	})

	it("should handle API errors gracefully", async () => {
		vi.mocked(axios.get).mockRejectedValueOnce(new Error("Network error"))

		const result = await getOpenAiModels("https://api.example.com/v1", "test-key")

		expect(result).toEqual([])
	})

	it("should handle malformed response data", async () => {
		vi.mocked(axios.get).mockResolvedValueOnce({ data: null })

		const result = await getOpenAiModels("https://api.example.com/v1", "test-key")

		expect(result).toEqual([])
	})

	describe("Azure portal Responses URL normalization", () => {
		beforeEach(() => {
			mockCreate.mockClear()
			mockResponsesCreate.mockClear()
		})

		it("Responses URL from Azure portal is converted to use Responses API", async () => {
			const handler = new OpenAiHandler({
				openAiApiKey: "test-azure",
				openAiModelId: "my-deployment",
				openAiBaseUrl: "https://sample-name.openai.azure.com/openai/responses?api-version=2025-04-01-preview",
				openAiUseAzure: true,
				openAiStreamingEnabled: false,
				includeMaxTokens: true,
				openAiCustomModelInfo: {
					contextWindow: 128_000,
					maxTokens: 64,
					supportsPromptCache: false,
				},
			})

			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: [{ type: "text", text: "Hello!" }] },
			]

			const stream = handler.createMessage("You are Roo Code.", messages)
			const chunks: any[] = []
			for await (const ch of stream) {
				chunks.push(ch)
			}

			// Should have used Responses API, not Chat Completions
			expect(mockResponsesCreate).toHaveBeenCalled()
			expect(mockCreate).not.toHaveBeenCalled()

			// Payload shape sanity
			const args = mockResponsesCreate.mock.calls[0][0]
			expect(args).toHaveProperty("model", "my-deployment")
			expect(args).toHaveProperty("input")
			expect(typeof args.input).toBe("string")
			expect(args.input).toContain("Developer: You are Roo Code.")
			expect(args.input).toContain("User: Hello!")
			expect(args).toHaveProperty("max_output_tokens", 64)

			// Ensure returned text chunk surfaced
			const textChunk = chunks.find((c) => c.type === "text")
			expect(textChunk?.text).toBe("Test response")
		})
	})

	it("should deduplicate model IDs", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "gpt-4" }, { id: "gpt-4" }, { id: "gpt-3.5-turbo" }, { id: "gpt-4" }],
			},
		}
		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse)

		const result = await getOpenAiModels("https://api.example.com/v1", "test-key")

		expect(result).toEqual(["gpt-4", "gpt-3.5-turbo"])
	})
})

// -- Added Responses API tests (TDD) --

describe("OpenAI Compatible - Responses API", () => {
	let handler: OpenAiHandler
	const baseMessages: Anthropic.Messages.MessageParam[] = [
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

	beforeEach(() => {
		mockCreate.mockClear()
		mockResponsesCreate.mockClear()
	})

	it("Azure Responses happy path uses string input (no messages) and max_output_tokens", async () => {
		const opts: ApiHandlerOptions = {
			openAiApiKey: "test-azure",
			openAiModelId: "my-deployment",
			openAiBaseUrl: "https://myres.openai.azure.com/openai/v1/responses?api-version=preview",
			openAiStreamingEnabled: false,
			includeMaxTokens: true,
			openAiCustomModelInfo: {
				contextWindow: 128_000,
				maxTokens: 256,
				supportsPromptCache: false,
			},
			enableReasoningEffort: false,
		}
		handler = new OpenAiHandler(opts)

		const stream = handler.createMessage("You are Roo Code.", baseMessages)
		const chunks: any[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		// Should have produced a text chunk
		const textChunk = chunks.find((c) => c.type === "text")
		expect(textChunk?.text).toBe("Test response")

		// Ensure Responses API was used
		expect(mockResponsesCreate).toHaveBeenCalled()
		expect(mockCreate).not.toHaveBeenCalled()

		const callArgs = mockResponsesCreate.mock.calls[0][0]
		expect(callArgs).not.toHaveProperty("messages")
		expect(callArgs).toHaveProperty("input")
		expect(typeof callArgs.input).toBe("string")
		expect(callArgs.input).toContain("Developer: You are Roo Code.")
		expect(callArgs.input).toContain("User: Hello!")
		expect(callArgs).toHaveProperty("model", "my-deployment")
		// Azure Responses naming
		expect(callArgs).toHaveProperty("max_output_tokens", 256)
	})

	it("Auto-detect: '/v1/responses' => Responses payload; '/chat/completions' => Chat Completions payload", async () => {
		// Responses URL
		const respHandler = new OpenAiHandler({
			openAiApiKey: "test",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
			openAiStreamingEnabled: false,
		})
		for await (const _ of respHandler.createMessage("sys", baseMessages)) {
		}
		expect(mockResponsesCreate).toHaveBeenCalled()
		const respArgs = mockResponsesCreate.mock.calls.pop()?.[0]
		expect(respArgs).not.toHaveProperty("messages")
		expect(respArgs).toHaveProperty("input")

		// Chat Completions URL
		mockResponsesCreate.mockClear()
		mockCreate.mockClear()
		const chatHandler = new OpenAiHandler({
			openAiApiKey: "test",
			openAiModelId: "gpt-4o",
			openAiBaseUrl: "https://api.openai.com/v1/chat/completions",
			openAiStreamingEnabled: false,
		})
		for await (const _ of chatHandler.createMessage("sys", baseMessages)) {
		}
		expect(mockCreate).toHaveBeenCalled()
		const chatArgs = mockCreate.mock.calls.pop()?.[0]
		expect(chatArgs).toHaveProperty("messages")
		expect(chatArgs).not.toHaveProperty("input")
	})

	it("Manual override: force Responses or Chat regardless of URL", async () => {
		// Force Responses
		const forceResp = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1", // no responses segment
			openAiStreamingEnabled: false,
			openAiApiFlavor: "responses",
		})
		for await (const _ of forceResp.createMessage("sys", baseMessages)) {
		}
		expect(mockResponsesCreate).toHaveBeenCalled()
		const rArgs = mockResponsesCreate.mock.calls.pop()?.[0]
		expect(rArgs).toHaveProperty("input")
		expect(rArgs).not.toHaveProperty("messages")

		// Force Chat
		mockResponsesCreate.mockClear()
		mockCreate.mockClear()
		const forceChat = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-4o",
			openAiBaseUrl: "https://api.openai.com/v1/responses", // would auto-detect as responses
			openAiStreamingEnabled: false,
			openAiApiFlavor: "chat",
		})
		for await (const _ of forceChat.createMessage("sys", baseMessages)) {
		}
		expect(mockCreate).toHaveBeenCalled()
		const cArgs = mockCreate.mock.calls.pop()?.[0]
		expect(cArgs).toHaveProperty("messages")
	})

	it("Reasoning effort mapping: Responses uses reasoning: { effort }, Chat uses reasoning_effort", async () => {
		// Responses path
		const responsesHandler = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
			openAiStreamingEnabled: false,
			enableReasoningEffort: true,
			reasoningEffort: "high",
			openAiCustomModelInfo: {
				contextWindow: 128_000,
				supportsPromptCache: false,
				supportsReasoningEffort: true,
			},
		})
		for await (const _ of responsesHandler.createMessage("sys", baseMessages)) {
		}
		expect(mockResponsesCreate).toHaveBeenCalled()
		const rArgs = mockResponsesCreate.mock.calls.pop()?.[0]
		expect(rArgs).toHaveProperty("reasoning")
		expect(rArgs.reasoning).toEqual({ effort: "high" })

		// Chat path
		mockResponsesCreate.mockClear()
		mockCreate.mockClear()
		const chatHandler = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-4o",
			openAiBaseUrl: "https://api.openai.com/v1/chat/completions",
			openAiStreamingEnabled: false,
			enableReasoningEffort: true,
			reasoningEffort: "high",
			openAiCustomModelInfo: {
				contextWindow: 128_000,
				supportsPromptCache: false,
				supportsReasoningEffort: true,
			},
		})
		for await (const _ of chatHandler.createMessage("sys", baseMessages)) {
		}
		expect(mockCreate).toHaveBeenCalled()
		const cArgs = mockCreate.mock.calls.pop()?.[0]
		expect(cArgs).toHaveProperty("reasoning_effort", "high")
	})

	it("Verbosity (Responses): include when set; if server rejects, retry without it (warn once)", async () => {
		// First call throws 400 for 'verbosity', second succeeds
		mockResponsesCreate.mockImplementationOnce((_opts: any) => {
			const err = new Error("Unsupported parameter: 'verbosity'")
			;(err as any).status = 400
			throw err
		})

		const h = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
			openAiStreamingEnabled: false,
			verbosity: "high",
		})

		const stream = h.createMessage("sys", baseMessages)
		const chunks: any[] = []
		for await (const ch of stream) {
			chunks.push(ch)
		}

		expect(mockResponsesCreate).toHaveBeenCalledTimes(2)
		const first = mockResponsesCreate.mock.calls[0][0]
		const second = mockResponsesCreate.mock.calls[1][0]
		expect(first).toHaveProperty("text")
		expect(first.text).toEqual({ verbosity: "high" })
		expect(second).not.toHaveProperty("text")

		// Should still yield text
		const textChunk = chunks.find((c) => c.type === "text")
		expect(textChunk?.text).toBe("Test response")
	})

	it("Azure naming: use max_output_tokens for Responses; keep max_completion_tokens for Chat Completions", async () => {
		// Responses + includeMaxTokens
		const r = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
			openAiStreamingEnabled: false,
			includeMaxTokens: true,
			modelMaxTokens: 128,
			openAiCustomModelInfo: {
				contextWindow: 128_000,
				maxTokens: 4096,
				supportsPromptCache: false,
			},
		})
		for await (const _ of r.createMessage("sys", baseMessages)) {
		}
		const rArgs = mockResponsesCreate.mock.calls.pop()?.[0]
		expect(rArgs).toHaveProperty("max_output_tokens", 128)
		expect(rArgs).not.toHaveProperty("max_completion_tokens")

		// Chat + includeMaxTokens
		mockResponsesCreate.mockClear()
		mockCreate.mockClear()
		const c = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-4o",
			openAiBaseUrl: "https://api.openai.com/v1/chat/completions",
			openAiStreamingEnabled: false,
			includeMaxTokens: true,
			modelMaxTokens: 128,
			openAiCustomModelInfo: {
				contextWindow: 128_000,
				maxTokens: 4096,
				supportsPromptCache: false,
			},
		})
		for await (const _ of c.createMessage("sys", baseMessages)) {
		}
		const cArgs = mockCreate.mock.calls.pop()?.[0]
		expect(cArgs).toHaveProperty("max_completion_tokens", 128)
		expect(cArgs).not.toHaveProperty("max_output_tokens")
	})

	it("Normalizes Azure portal responses URL to /openai/v1 with apiVersion=preview", async () => {
		mockResponsesCreate.mockClear()
		mockCreate.mockClear()

		const portalUrl = "https://sample-name.openai.azure.com/openai/responses?api-version=2025-04-01-preview"

		const handler = new OpenAiHandler({
			openAiApiKey: "test-azure",
			openAiModelId: "my-deployment",
			openAiBaseUrl: portalUrl,
			openAiStreamingEnabled: false,
		})

		for await (const _ of handler.createMessage("sys", baseMessages)) {
		}

		// Ensures Responses API path was used
		expect(mockResponsesCreate).toHaveBeenCalled()

		// Ensure SDK constructor was called with normalized baseURL and 'preview' apiVersion (per requirement)
		// Note: AzureOpenAI and OpenAI share same mock constructor; inspect last call
		const ctorCalls = vi.mocked(OpenAI as unknown as any).mock.calls as any[]
		const lastCtorArgs = ctorCalls[ctorCalls.length - 1]?.[0] || {}
		expect(lastCtorArgs.baseURL).toBe("https://sample-name.openai.azure.com/openai/v1")
		expect(lastCtorArgs.apiVersion).toBe("preview")
	})
})
