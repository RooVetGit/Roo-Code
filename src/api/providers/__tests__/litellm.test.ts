// npx jest src/api/providers/__tests__/litellm.test.ts

import { Anthropic } from "@anthropic-ai/sdk" // For message types
import OpenAI from "openai"

import { LiteLLMHandler } from "../litellm"
import { ApiHandlerOptions, litellmDefaultModelId, litellmDefaultModelInfo, ModelInfo } from "../../../shared/api"
import * as modelCache from "../fetchers/modelCache"

const mockOpenAICreateCompletions = jest.fn()
jest.mock("openai", () => {
	return jest.fn(() => ({
		chat: {
			completions: {
				create: mockOpenAICreateCompletions,
			},
		},
	}))
})

jest.mock("../fetchers/modelCache", () => ({
	getModels: jest.fn(),
}))

const mockGetModels = modelCache.getModels as jest.Mock

describe("LiteLLMHandler", () => {
	const defaultMockOptions: ApiHandlerOptions = {
		litellmApiKey: "test-litellm-key",
		litellmModelId: "litellm-test-model",
		litellmBaseUrl: "http://mock-litellm-server:8000",
		modelTemperature: 0.1, // Add a default temperature for tests
	}

	const mockModelInfo: ModelInfo = {
		maxTokens: 4096,
		contextWindow: 128000,
		supportsImages: false,
		supportsPromptCache: true,
		supportsComputerUse: false,
		description: "A test LiteLLM model",
	}

	beforeEach(() => {
		jest.clearAllMocks()

		mockGetModels.mockResolvedValue({
			[defaultMockOptions.litellmModelId!]: mockModelInfo,
		})
		// Spy on supportsTemperature and default to true for most tests, can be overridden
		jest.spyOn(LiteLLMHandler.prototype as any, "supportsTemperature").mockReturnValue(true)
	})

	describe("constructor", () => {
		it("initializes with correct options and defaults", () => {
			const handler = new LiteLLMHandler(defaultMockOptions) // This will call new OpenAI()
			expect(handler).toBeInstanceOf(LiteLLMHandler)
			// Check if the mock constructor was called with the right params
			expect(OpenAI).toHaveBeenCalledWith({
				baseURL: defaultMockOptions.litellmBaseUrl,
				apiKey: defaultMockOptions.litellmApiKey,
			})
		})

		it("uses default baseURL if not provided", () => {
			new LiteLLMHandler({ litellmApiKey: "key", litellmModelId: "id" })
			expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "http://localhost:4000" }))
		})

		it("uses dummy API key if not provided", () => {
			new LiteLLMHandler({ litellmBaseUrl: "url", litellmModelId: "id" })
			expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "dummy-key" }))
		})
	})

	describe("fetchModel", () => {
		it("returns correct model info when modelId is provided and found in getModels", async () => {
			const handler = new LiteLLMHandler(defaultMockOptions)
			const result = await handler.fetchModel()
			expect(mockGetModels).toHaveBeenCalledWith(
				"litellm",
				defaultMockOptions.litellmApiKey,
				defaultMockOptions.litellmBaseUrl,
			)
			expect(result).toEqual({ id: defaultMockOptions.litellmModelId, info: mockModelInfo })
		})

		it("returns defaultModelInfo if provided modelId is NOT found in getModels result", async () => {
			mockGetModels.mockResolvedValueOnce({ "another-model": { contextWindow: 1, supportsPromptCache: false } })
			const handler = new LiteLLMHandler(defaultMockOptions)
			const result = await handler.fetchModel()
			expect(result.id).toBe(litellmDefaultModelId)
			expect(result.info).toEqual(litellmDefaultModelInfo)
		})

		it("uses defaultModelId and its info if litellmModelId option is undefined and defaultModelId is in getModels", async () => {
			const specificDefaultModelInfo = { ...mockModelInfo, description: "Specific Default Model Info" }
			mockGetModels.mockResolvedValueOnce({ [litellmDefaultModelId]: specificDefaultModelInfo })
			const handler = new LiteLLMHandler({ ...defaultMockOptions, litellmModelId: undefined })
			const result = await handler.fetchModel()
			expect(result.id).toBe(litellmDefaultModelId)
			expect(result.info).toEqual(specificDefaultModelInfo)
		})

		it("uses defaultModelId and defaultModelInfo if litellmModelId option is undefined and defaultModelId is NOT in getModels", async () => {
			mockGetModels.mockResolvedValueOnce({ "some-other-model": mockModelInfo })
			const handler = new LiteLLMHandler({ ...defaultMockOptions, litellmModelId: undefined })
			const result = await handler.fetchModel()
			expect(result.id).toBe(litellmDefaultModelId)
			expect(result.info).toEqual(litellmDefaultModelInfo)
		})

		it("throws an error if getModels fails", async () => {
			mockGetModels.mockRejectedValueOnce(new Error("Network error"))
			const handler = new LiteLLMHandler(defaultMockOptions)
			await expect(handler.fetchModel()).rejects.toThrow("Network error")
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]
		// mockCreateGlobal is no longer needed here, use mockOpenAICreateCompletions directly

		beforeEach(() => {
			// mockOpenAICreateCompletions is already cleared by jest.clearAllMocks() in the outer beforeEach
			// or mockOpenAICreateCompletions.mockClear() if we want to be very specific
		})

		it("streams text and usage chunks correctly", async () => {
			const mockStreamData = {
				async *[Symbol.asyncIterator]() {
					yield { id: "chunk1", choices: [{ delta: { content: "Response part 1" } }], usage: null }
					yield { id: "chunk2", choices: [{ delta: { content: " part 2" } }], usage: null }
					yield { id: "chunk3", choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 5 } }
				},
			}
			mockOpenAICreateCompletions.mockReturnValue({
				withResponse: jest.fn().mockResolvedValue({ data: mockStreamData }),
			})

			const handler = new LiteLLMHandler(defaultMockOptions)
			const generator = handler.createMessage(systemPrompt, messages)
			const chunks = []
			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "text", text: "Response part 1" },
				{ type: "text", text: " part 2" },
				{ type: "usage", inputTokens: 10, outputTokens: 5 },
			])
			expect(mockOpenAICreateCompletions).toHaveBeenCalledWith({
				model: defaultMockOptions.litellmModelId,
				max_tokens: mockModelInfo.maxTokens,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: "Hello" },
				],
				stream: true,
				stream_options: { include_usage: true },
				temperature: defaultMockOptions.modelTemperature,
			})
		})

		it("handles temperature option if supported", async () => {
			const handler = new LiteLLMHandler({ ...defaultMockOptions, modelTemperature: 0.7 })
			const mockStreamData = { async *[Symbol.asyncIterator]() {} }
			mockOpenAICreateCompletions.mockReturnValue({
				withResponse: jest.fn().mockResolvedValue({ data: mockStreamData }),
			})

			const generator = handler.createMessage(systemPrompt, messages)
			for await (const _ of generator) {
			}

			expect(mockOpenAICreateCompletions).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.7 }))
		})

		it("does not include temperature if not supported by model", async () => {
			;(LiteLLMHandler.prototype as any).supportsTemperature.mockReturnValue(false)
			const handler = new LiteLLMHandler(defaultMockOptions)
			const mockStreamData = { async *[Symbol.asyncIterator]() {} }
			mockOpenAICreateCompletions.mockReturnValue({
				withResponse: jest.fn().mockResolvedValue({ data: mockStreamData }),
			})

			const generator = handler.createMessage(systemPrompt, messages)
			for await (const _ of generator) {
			}

			const callArgs = mockOpenAICreateCompletions.mock.calls[0][0]
			expect(callArgs.temperature).toBeUndefined()
		})

		it("throws a formatted error if API call (streaming) fails", async () => {
			const apiError = new Error("LLM Provider Error")
			// Simulate the error occurring within the stream itself
			mockOpenAICreateCompletions.mockReturnValue({
				withResponse: jest.fn().mockResolvedValue({
					data: {
						async *[Symbol.asyncIterator]() {
							throw apiError
						},
					},
				}),
			})

			const handler = new LiteLLMHandler(defaultMockOptions)
			const generator = handler.createMessage(systemPrompt, messages)
			await expect(async () => {
				for await (const _ of generator) {
				}
			}).rejects.toThrow("LiteLLM streaming error: " + apiError.message)
		})
	})

	describe("completePrompt", () => {
		const prompt = "Translate 'hello' to French."
		// mockCreateGlobal is no longer needed here, use mockOpenAICreateCompletions directly

		beforeEach(() => {
			// mockOpenAICreateCompletions is already cleared by jest.clearAllMocks() in the outer beforeEach
		})

		it("returns completion successfully", async () => {
			mockOpenAICreateCompletions.mockResolvedValueOnce({ choices: [{ message: { content: "Bonjour" } }] })
			const handler = new LiteLLMHandler(defaultMockOptions)
			const result = await handler.completePrompt(prompt)

			expect(result).toBe("Bonjour")
			expect(mockOpenAICreateCompletions).toHaveBeenCalledWith({
				model: defaultMockOptions.litellmModelId,
				max_tokens: mockModelInfo.maxTokens,
				messages: [{ role: "user", content: prompt }],
				temperature: defaultMockOptions.modelTemperature,
			})
		})

		it("throws a formatted error if API call fails", async () => {
			mockOpenAICreateCompletions.mockRejectedValueOnce(new Error("Completion API Down"))
			const handler = new LiteLLMHandler(defaultMockOptions)
			await expect(handler.completePrompt(prompt)).rejects.toThrow(
				"LiteLLM completion error: Completion API Down",
			)
		})
	})
})
