// npx vitest run src/api/providers/__tests__/poe.spec.ts

// Mock vscode first to avoid import errors
vitest.mock("vscode", () => ({}))

import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"

import { type PoeModelId, poeDefaultModelId, poeModels, poeDefaultModelInfo } from "@roo-code/types"

import { PoeHandler } from "../poe"

vitest.mock("openai", () => {
	const createMock = vitest.fn()
	return {
		default: vitest.fn(() => ({ chat: { completions: { create: createMock } } })),
	}
})

describe("PoeHandler", () => {
	let handler: PoeHandler
	let mockCreate: any

	beforeEach(() => {
		vitest.clearAllMocks()
		mockCreate = (OpenAI as unknown as any)().chat.completions.create
		handler = new PoeHandler({ poeApiKey: "test-poe-api-key" })
	})

	it("should use the correct Poe base URL", () => {
		new PoeHandler({ poeApiKey: "test-poe-api-key" })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://api.poe.com/v1" }))
	})

	it("should use custom base URL when provided", () => {
		const customBaseUrl = "https://custom.poe.api/v1"
		new PoeHandler({ poeApiKey: "test-poe-api-key", poeBaseUrl: customBaseUrl })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: customBaseUrl }))
	})

	it("should use the provided API key", () => {
		const poeApiKey = "test-poe-api-key"
		new PoeHandler({ poeApiKey })
		expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: poeApiKey }))
	})

	it("should return default model when no model is specified", () => {
		const model = handler.getModel()
		expect(model.id).toBe(poeDefaultModelId)
		expect(model.info).toEqual(poeModels[poeDefaultModelId as keyof typeof poeModels])
	})

	it("should return specified model when valid model is provided", () => {
		const testModelId: PoeModelId = "gpt-4o"
		const handlerWithModel = new PoeHandler({ apiModelId: testModelId, poeApiKey: "test-poe-api-key" })
		const model = handlerWithModel.getModel()
		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(poeModels[testModelId as keyof typeof poeModels])
	})

	it("should return custom bot with default info for unknown models", () => {
		const customBotName = "MyCustomBot"
		const handlerWithCustomBot = new PoeHandler({ apiModelId: customBotName, poeApiKey: "test-poe-api-key" })
		const model = handlerWithCustomBot.getModel()
		expect(model.id).toBe(customBotName)
		expect(model.info).toEqual(poeDefaultModelInfo)
	})

	it("completePrompt method should return text from Poe API", async () => {
		const expectedResponse = "This is a test response from Poe"
		mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: expectedResponse } }] })
		const result = await handler.completePrompt("test prompt")
		expect(result).toBe(expectedResponse)
	})

	it("should handle errors in completePrompt", async () => {
		const errorMessage = "Poe API error"
		mockCreate.mockRejectedValueOnce(new Error(errorMessage))
		await expect(handler.completePrompt("test prompt")).rejects.toThrow(`Poe completion error: ${errorMessage}`)
	})

	it("createMessage should yield text content from stream", async () => {
		const testContent = "This is test content from Poe stream"

		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					next: vitest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: { choices: [{ delta: { content: testContent } }] },
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}
		})

		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual({ type: "text", text: testContent })
	})

	it("createMessage should yield usage data from stream", async () => {
		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					next: vitest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: { choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 20 } },
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}
		})

		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual({ type: "usage", inputTokens: 10, outputTokens: 20 })
	})

	it("createMessage should pass correct parameters to Poe client", async () => {
		const modelId: PoeModelId = "claude-3-5-sonnet"
		const modelInfo = poeModels[modelId as keyof typeof poeModels]
		const handlerWithModel = new PoeHandler({ apiModelId: modelId, poeApiKey: "test-poe-api-key" })

		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					async next() {
						return { done: true }
					},
				}),
			}
		})

		const systemPrompt = "Test system prompt for Poe"
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Test message for Poe" }]

		const messageGenerator = handlerWithModel.createMessage(systemPrompt, messages)
		await messageGenerator.next()

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: modelId,
				max_tokens: modelInfo.maxTokens,
				temperature: 0.7,
				messages: expect.arrayContaining([{ role: "system", content: systemPrompt }]),
				stream: true,
				stream_options: { include_usage: true },
			}),
		)
	})
})
