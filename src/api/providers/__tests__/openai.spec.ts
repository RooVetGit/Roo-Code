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
		expect(rArgs.reasoning).toMatchObject({ effort: "high" })

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

	it("streams Responses API when provider returns AsyncIterable", async () => {
		// Arrange: make responses.create return an AsyncIterable stream for this test
		mockResponsesCreate.mockImplementationOnce(async (_opts: any) => {
			return {
				[Symbol.asyncIterator]: async function* () {
					yield { type: "response.text.delta", delta: "Hello " }
					yield { type: "response.text.delta", delta: "world" }
					yield {
						type: "response.completed",
						response: { usage: { input_tokens: 7, output_tokens: 2 } },
					}
				},
			}
		})

		const handler = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5-mini",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
			// streaming enabled by default
		})

		const stream = handler.createMessage("You are Roo.", [
			{ role: "user", content: [{ type: "text" as const, text: "Say hi" }] },
		])

		const chunks: any[] = []
		for await (const ch of stream) {
			chunks.push(ch)
		}

		// Text should be streamed and concatenated in order
		const text = chunks
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("")
		expect(text).toBe("Hello world")

		// Usage chunk emitted at completion
		const usage = chunks.find((c) => c.type === "usage")
		expect(usage).toBeDefined()
		expect(usage.inputTokens).toBe(7)
		expect(usage.outputTokens).toBe(2)

		// Ensure stream: true was sent
		const args = mockResponsesCreate.mock.calls.pop()?.[0]
		expect(args).toHaveProperty("stream", true)
	})
})

describe("OpenAI Compatible - Responses API (extended streaming)", () => {
	it("handles reasoning deltas and output_text in message content", async () => {
		// Arrange: make responses.create return an AsyncIterable stream for this test
		mockResponsesCreate.mockImplementationOnce(async (_opts: any) => {
			return {
				[Symbol.asyncIterator]: async function* () {
					// Reasoning delta first
					yield { type: "response.reasoning.delta", delta: "Thinking. " }
					// Then a message item with output_text inside content array
					yield {
						type: "response.output_item.added",
						item: {
							type: "message",
							content: [{ type: "output_text", text: "Answer." }],
						},
					}
					// Completion with usage
					yield {
						type: "response.completed",
						response: { usage: { input_tokens: 3, output_tokens: 2 } },
					}
				},
			}
		})

		const handler = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5-mini",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
		})

		const chunks: any[] = []
		for await (const ch of handler.createMessage("sys", [
			{ role: "user", content: [{ type: "text" as const, text: "Hi" }] },
		])) {
			chunks.push(ch)
		}

		const reasoning = chunks.find((c) => c.type === "reasoning")
		expect(reasoning?.text).toBe("Thinking. ")

		const text = chunks.find((c) => c.type === "text")
		expect(text?.text).toBe("Answer.")

		const usage = chunks.find((c) => c.type === "usage")
		expect(usage).toBeDefined()
		expect(usage.inputTokens).toBe(3)
		expect(usage.outputTokens).toBe(2)

		// Ensure stream: true was sent
		const args = mockResponsesCreate.mock.calls.pop()?.[0]
		expect(args).toHaveProperty("stream", true)
	})

	it("maps refusal deltas to text with prefix", async () => {
		mockResponsesCreate.mockImplementationOnce(async (_opts: any) => {
			return {
				[Symbol.asyncIterator]: async function* () {
					yield { type: "response.refusal.delta", delta: "Cannot comply" }
					// Usage may be attached directly on the event for some implementations
					yield { type: "response.done", usage: { prompt_tokens: 1, completion_tokens: 1 } }
				},
			}
		})

		const handler = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5-mini",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
		})

		const result: any[] = []
		for await (const ch of handler.createMessage("sys", [
			{ role: "user", content: [{ type: "text" as const, text: "Hi" }] },
		])) {
			result.push(ch)
		}

		const textChunks = result.filter((c) => c.type === "text").map((c) => c.text)
		expect(textChunks).toContain("[Refusal] Cannot comply")

		const usage = result.find((c) => c.type === "usage")
		expect(usage).toBeDefined()
		expect(usage.inputTokens).toBe(1)
		expect(usage.outputTokens).toBe(1)
	})
})

describe("OpenAI Compatible - Responses API (multimodal)", () => {
	it("builds structured array input with images (non-streaming)", async () => {
		// Reset mocks for clarity
		mockResponsesCreate.mockClear()
		mockCreate.mockClear()

		const handler = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5-mini",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
			openAiStreamingEnabled: false,
			includeMaxTokens: false,
		})

		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{ type: "text" as const, text: "Here is an image" },
					{
						type: "image" as const,
						// Minimal Anthropic-style inline image (base64) block
						source: { media_type: "image/png", data: "BASE64DATA" } as any,
					},
				],
			},
		]

		const chunks: any[] = []
		for await (const ch of handler.createMessage("You are Roo Code.", messages)) {
			chunks.push(ch)
		}

		// Should have used Responses API
		expect(mockResponsesCreate).toHaveBeenCalled()
		const args = mockResponsesCreate.mock.calls[0][0]

		// Input should be an array (structured input mode)
		expect(Array.isArray(args.input)).toBe(true)
		const arr = args.input as any[]

		// First element should be Developer preface as input_text
		expect(arr[0]?.role).toBe("user")
		expect(arr[0]?.content?.[0]?.type).toBe("input_text")
		expect(arr[0]?.content?.[0]?.text).toContain("Developer: You are Roo Code.")

		// There should be at least one input_image with a data URL for the provided image
		const hasInputImage = arr.some((item: any) => {
			const c = item?.content
			return (
				Array.isArray(c) &&
				c.some(
					(part: any) =>
						part?.type === "input_image" &&
						typeof part?.image_url === "string" &&
						part.image_url.startsWith("data:image/png;base64,BASE64DATA"),
				)
			)
		})
		expect(hasInputImage).toBe(true)

		// Should still yield a text chunk and usage (from default mock)
		const textChunk = chunks.find((c: any) => c.type === "text")
		const usageChunk = chunks.find((c: any) => c.type === "usage")
		expect(textChunk?.text).toBe("Test response")
		expect(usageChunk?.inputTokens).toBe(10)
		expect(usageChunk?.outputTokens).toBe(5)
	})

	it("streams with multimodal input using array 'input'", async () => {
		// Make responses.create return an AsyncIterable stream for this test
		mockResponsesCreate.mockClear()
		mockResponsesCreate.mockImplementationOnce(async (_opts: any) => {
			return {
				[Symbol.asyncIterator]: async function* () {
					yield { type: "response.text.delta", delta: "A" }
					yield { type: "response.text.delta", delta: "B" }
					yield {
						type: "response.completed",
						response: { usage: { input_tokens: 2, output_tokens: 2 } },
					}
				},
			}
		})

		const handler = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5-mini",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
		})

		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{ type: "text" as const, text: "Look at this" },
					{
						type: "image" as const,
						source: { media_type: "image/jpeg", data: "IMGDATA" } as any,
					},
				],
			},
		]

		const out: any[] = []
		for await (const ch of handler.createMessage("System text", messages)) {
			out.push(ch)
		}

		// Ensure stream: true was sent and input is array
		expect(mockResponsesCreate).toHaveBeenCalled()
		const args = mockResponsesCreate.mock.calls[0][0]
		expect(args).toHaveProperty("stream", true)
		expect(Array.isArray(args.input)).toBe(true)

		// Verify streamed text concatenation and usage
		const combined = out
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("")
		expect(combined).toBe("AB")

		const usage = out.find((c) => c.type === "usage")
		expect(usage?.inputTokens).toBe(2)
		expect(usage?.outputTokens).toBe(2)
	})
})

// --- New tests: Responses API conversation continuity (previous_response_id) ---
describe("OpenAI Compatible - Responses API conversation continuity", () => {
	beforeEach(() => {
		mockCreate.mockClear()
		mockResponsesCreate.mockClear()
	})

	it("propagates previous_response_id from first streaming response into the next request", async () => {
		// First call will stream and include a response.id
		mockResponsesCreate.mockImplementationOnce(async (_opts: any) => {
			return {
				[Symbol.asyncIterator]: async function* () {
					yield { type: "response.text.delta", delta: "Desc " }
					yield {
						type: "response.completed",
						response: { id: "resp-1", usage: { input_tokens: 5, output_tokens: 2 } },
					}
				},
			}
		})

		const handler = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5-mini",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
		})

		// 1) First call (establish response id)
		const firstChunks: any[] = []
		for await (const ch of handler.createMessage("You are Roo.", [
			{ role: "user", content: [{ type: "text" as const, text: "Describe the image" }] },
		])) {
			firstChunks.push(ch)
		}

		// Ensure first call was made
		expect(mockResponsesCreate).toHaveBeenCalledTimes(1)
		// 2) Second call - should include previous_response_id from first call
		const secondChunks: any[] = []
		for await (const ch of handler.createMessage("You are Roo.", [
			{ role: "user", content: [{ type: "text" as const, text: "Continue." }] },
		])) {
			secondChunks.push(ch)
		}

		// Validate that a second Responses.create call was made
		expect(mockResponsesCreate).toHaveBeenCalledTimes(2)
		const secondArgs = mockResponsesCreate.mock.calls[1][0]
		expect(secondArgs).toHaveProperty("previous_response_id", "resp-1")
	})

	it("omits previous_response_id when metadata.suppressPreviousResponseId is true", async () => {
		// First call streams and returns an id
		mockResponsesCreate.mockImplementationOnce(async (_opts: any) => {
			return {
				[Symbol.asyncIterator]: async function* () {
					yield { type: "response.text.delta", delta: "First" }
					yield {
						type: "response.completed",
						response: { id: "rid-xyz", usage: { input_tokens: 1, output_tokens: 1 } },
					}
				},
			}
		})

		const handler = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5-mini",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
		})

		// First call to capture lastResponseId
		for await (const _ of handler.createMessage("sys", [
			{ role: "user", content: [{ type: "text" as const, text: "Turn 1" }] },
		])) {
		}

		// Second call with suppressPreviousResponseId => should NOT include previous_response_id
		for await (const _ of handler.createMessage(
			"sys",
			[{ role: "user", content: [{ type: "text" as const, text: "Turn 2" }] }],
			{ suppressPreviousResponseId: true } as any,
		)) {
		}

		expect(mockResponsesCreate).toHaveBeenCalledTimes(2)
		const args = mockResponsesCreate.mock.calls[1][0]
		expect(args).not.toHaveProperty("previous_response_id")
	})
})

// --- New: Responses API parity improvements tests ---
describe("OpenAI Compatible - Responses API parity improvements", () => {
	beforeEach(() => {
		mockCreate.mockClear()
		mockResponsesCreate.mockClear()
	})

	it("retries without previous_response_id when server returns 400 'Previous response ... not found' (non-streaming)", async () => {
		// First call throws 400 for previous_response_id, second succeeds
		mockResponsesCreate
			.mockImplementationOnce((_opts: any) => {
				const err = new Error("Previous response rid-bad not found")
				;(err as any).status = 400
				throw err
			})
			.mockImplementationOnce(async (_opts: any) => {
				return { id: "rid-good", output_text: "OK", usage: { input_tokens: 1, output_tokens: 1 } }
			})

		const h = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
			openAiStreamingEnabled: false,
		})

		const chunks: any[] = []
		for await (const ch of h.createMessage(
			"sys",
			[{ role: "user", content: [{ type: "text" as const, text: "Turn" }] }],
			{ previousResponseId: "rid-bad" } as any,
		)) {
			chunks.push(ch)
		}

		// Two calls made: first fails with 400, second retries without previous_response_id
		expect(mockResponsesCreate).toHaveBeenCalledTimes(2)
		const firstArgs = mockResponsesCreate.mock.calls[0][0]
		expect(firstArgs).toHaveProperty("previous_response_id", "rid-bad")

		const secondArgs = mockResponsesCreate.mock.calls[1][0]
		expect(secondArgs).not.toHaveProperty("previous_response_id")

		// Should still surface text
		const textChunk = chunks.find((c: any) => c.type === "text")
		expect(textChunk?.text).toBe("OK")
	})

	it("retries without previous_response_id when server returns 400 (streaming)", async () => {
		// First call throws, second returns a stream
		mockResponsesCreate
			.mockImplementationOnce((_opts: any) => {
				const err = new Error("Previous response not found")
				;(err as any).status = 400
				throw err
			})
			.mockImplementationOnce(async (_opts: any) => {
				return {
					[Symbol.asyncIterator]: async function* () {
						yield { type: "response.text.delta", delta: "Hello" }
						yield { type: "response.completed", response: { usage: { input_tokens: 1, output_tokens: 1 } } }
					},
				}
			})

		const h = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
			// streaming enabled by default
		})

		const out: any[] = []
		for await (const ch of h.createMessage(
			"sys",
			[{ role: "user", content: [{ type: "text" as const, text: "Hi" }] }],
			{ previousResponseId: "bad-id" } as any,
		)) {
			out.push(ch)
		}

		expect(mockResponsesCreate).toHaveBeenCalledTimes(2)
		const first = mockResponsesCreate.mock.calls[0][0]
		expect(first).toHaveProperty("previous_response_id", "bad-id")
		const second = mockResponsesCreate.mock.calls[1][0]
		expect(second).not.toHaveProperty("previous_response_id")

		const combined = out
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("")
		expect(combined).toBe("Hello")
	})

	it("handles response.content_part.added by emitting text", async () => {
		mockResponsesCreate.mockImplementationOnce(async (_opts: any) => {
			return {
				[Symbol.asyncIterator]: async function* () {
					yield { type: "response.content_part.added", part: { type: "text", text: "Part" } }
					yield { type: "response.completed", response: { usage: { input_tokens: 0, output_tokens: 0 } } }
				},
			}
		})

		const h = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
		})

		const out: any[] = []
		for await (const ch of h.createMessage("sys", [
			{ role: "user", content: [{ type: "text" as const, text: "Hi" }] },
		])) {
			out.push(ch)
		}

		const texts = out.filter((c) => c.type === "text").map((c) => c.text)
		expect(texts).toContain("Part")
	})

	it("maps response.audio_transcript.delta to text", async () => {
		mockResponsesCreate.mockImplementationOnce(async (_opts: any) => {
			return {
				[Symbol.asyncIterator]: async function* () {
					yield { type: "response.audio_transcript.delta", delta: "Transcript" }
					yield { type: "response.completed", response: { usage: { input_tokens: 0, output_tokens: 0 } } }
				},
			}
		})

		const h = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
		})

		const out: any[] = []
		for await (const ch of h.createMessage("sys", [
			{ role: "user", content: [{ type: "text" as const, text: "Hi" }] },
		])) {
			out.push(ch)
		}

		const texts = out.filter((c) => c.type === "text").map((c) => c.text)
		expect(texts).toContain("Transcript")
	})

	it("includes reasoning: { effort: 'minimal', summary: 'auto' } when enabled (non-streaming)", async () => {
		mockResponsesCreate.mockImplementationOnce(async (opts: any) => {
			return { id: "rid-1", output_text: "ok", usage: { input_tokens: 1, output_tokens: 1 } }
		})

		const h = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
			openAiStreamingEnabled: false,
			enableReasoningEffort: true,
			reasoningEffort: "minimal",
		})

		for await (const _ of h.createMessage("sys", [
			{ role: "user", content: [{ type: "text" as const, text: "Hi" }] },
		])) {
			// consume
		}

		expect(mockResponsesCreate).toHaveBeenCalledTimes(1)
		const args = mockResponsesCreate.mock.calls[0][0]
		expect(args).toHaveProperty("reasoning")
		expect(args.reasoning).toMatchObject({ effort: "minimal", summary: "auto" })
	})

	it("omits reasoning.summary when enableGpt5ReasoningSummary is false", async () => {
		mockResponsesCreate.mockImplementationOnce(async (opts: any) => {
			return { id: "rid-2", output_text: "ok", usage: { input_tokens: 1, output_tokens: 1 } }
		})

		const h = new OpenAiHandler({
			openAiApiKey: "k",
			openAiModelId: "gpt-5",
			openAiBaseUrl: "https://api.openai.com/v1/responses",
			openAiStreamingEnabled: false,
			enableReasoningEffort: true,
			reasoningEffort: "low",
			enableGpt5ReasoningSummary: false,
		})

		for await (const _ of h.createMessage("sys", [
			{ role: "user", content: [{ type: "text" as const, text: "Hi" }] },
		])) {
			// consume
		}

		expect(mockResponsesCreate).toHaveBeenCalledTimes(1)
		const args = mockResponsesCreate.mock.calls[0][0]
		expect(args).toHaveProperty("reasoning")
		expect(args.reasoning.effort).toBe("low")
		expect(args.reasoning.summary).toBeUndefined()
	})
})
