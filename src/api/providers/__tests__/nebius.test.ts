// npx jest src/api/providers/__tests__/nebius.test.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { NebiusHandler } from "../nebius"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock dependencies
jest.mock("openai")
jest.mock("delay", () => jest.fn(() => Promise.resolve()))
jest.mock("../fetchers/modelCache", () => ({
	getModels: jest.fn().mockImplementation(() => {
		return Promise.resolve({
			"Qwen/Qwen2.5-32B-Instruct-fast": {
				maxTokens: 8192,
				contextWindow: 32768,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0.13,
				outputPrice: 0.4,
				description: "Qwen 2.5 32B Instruct Fast",
			},
			"deepseek-ai/DeepSeek-R1": {
				maxTokens: 32000,
				contextWindow: 96000,
				supportsImages: false,
				supportsPromptCache: false,
				inputPrice: 0.8,
				outputPrice: 2.4,
				description: "DeepSeek R1",
			},
		})
	}),
}))

describe("NebiusHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		nebiusApiKey: "test-key",
		nebiusModelId: "Qwen/Qwen2.5-32B-Instruct-fast",
		nebiusBaseUrl: "https://api.studio.nebius.ai/v1",
	}

	beforeEach(() => jest.clearAllMocks())

	it("initializes with correct options", () => {
		const handler = new NebiusHandler(mockOptions)
		expect(handler).toBeInstanceOf(NebiusHandler)

		expect(OpenAI).toHaveBeenCalledWith({
			baseURL: "https://api.studio.nebius.ai/v1",
			apiKey: mockOptions.nebiusApiKey,
		})
	})

	it("uses default base URL when not provided", () => {
		const handler = new NebiusHandler({
			nebiusApiKey: "test-key",
			nebiusModelId: "Qwen/Qwen2.5-32B-Instruct-fast",
		})
		expect(handler).toBeInstanceOf(NebiusHandler)

		expect(OpenAI).toHaveBeenCalledWith({
			baseURL: "https://api.studio.nebius.ai/v1",
			apiKey: "test-key",
		})
	})

	describe("fetchModel", () => {
		it("returns correct model info when options are provided", async () => {
			const handler = new NebiusHandler(mockOptions)
			const result = await handler.fetchModel()

			expect(result).toMatchObject({
				id: mockOptions.nebiusModelId,
				info: {
					maxTokens: 8192,
					contextWindow: 32768,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: 0.13,
					outputPrice: 0.4,
					description: "Qwen 2.5 32B Instruct Fast",
				},
			})
		})

		it("returns default model info when options are not provided", async () => {
			const handler = new NebiusHandler({})
			const result = await handler.fetchModel()
			expect(result.id).toBe("Qwen/Qwen2.5-32B-Instruct-fast")
		})
	})

	describe("createMessage", () => {
		it("generates correct stream chunks", async () => {
			const handler = new NebiusHandler(mockOptions)

			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { content: "test response" } }],
					}
					yield {
						choices: [{ delta: {} }],
						usage: { prompt_tokens: 10, completion_tokens: 20 },
					}
				},
			}

			// Mock OpenAI chat.completions.create
			const mockCreate = jest.fn().mockResolvedValue(mockStream)

			;(OpenAI as jest.MockedClass<typeof OpenAI>).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const systemPrompt = "test system prompt"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user" as const, content: "test message" }]

			const generator = handler.createMessage(systemPrompt, messages)
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			// Verify stream chunks
			expect(chunks).toHaveLength(2) // One text chunk and one usage chunk
			expect(chunks[0]).toEqual({ type: "text", text: "test response" })
			expect(chunks[1]).toEqual({ type: "usage", inputTokens: 10, outputTokens: 20 })

			// Verify OpenAI client was called with correct parameters
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "Qwen/Qwen2.5-32B-Instruct-fast",
					messages: [
						{ role: "system", content: "test system prompt" },
						{ role: "user", content: "test message" },
					],
					temperature: 0,
					stream: true,
					stream_options: { include_usage: true },
				}),
			)
		})

		it("handles R1 format for DeepSeek-R1 models", async () => {
			const handler = new NebiusHandler({
				...mockOptions,
				nebiusModelId: "deepseek-ai/DeepSeek-R1",
			})

			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						choices: [{ delta: { content: "test response" } }],
					}
				},
			}

			const mockCreate = jest.fn().mockResolvedValue(mockStream)
			;(OpenAI as jest.MockedClass<typeof OpenAI>).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const systemPrompt = "test system prompt"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user" as const, content: "test message" }]

			await handler.createMessage(systemPrompt, messages).next()

			// Verify R1 format is used - the first message should combine system and user content
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "deepseek-ai/DeepSeek-R1",
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "user",
							content: expect.stringContaining("test system prompt"),
						}),
					]),
				}),
			)
		})
	})

	describe("completePrompt", () => {
		it("returns correct response", async () => {
			const handler = new NebiusHandler(mockOptions)
			const mockResponse = { choices: [{ message: { content: "test completion" } }] }

			const mockCreate = jest.fn().mockResolvedValue(mockResponse)
			;(OpenAI as jest.MockedClass<typeof OpenAI>).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const result = await handler.completePrompt("test prompt")

			expect(result).toBe("test completion")

			expect(mockCreate).toHaveBeenCalledWith({
				model: mockOptions.nebiusModelId,
				max_tokens: 8192,
				temperature: 0,
				messages: [{ role: "user", content: "test prompt" }],
			})
		})

		it("handles errors", async () => {
			const handler = new NebiusHandler(mockOptions)
			const mockError = new Error("API Error")

			const mockCreate = jest.fn().mockRejectedValue(mockError)
			;(OpenAI as jest.MockedClass<typeof OpenAI>).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			await expect(handler.completePrompt("test prompt")).rejects.toThrow("nebius completion error: API Error")
		})
	})
})
