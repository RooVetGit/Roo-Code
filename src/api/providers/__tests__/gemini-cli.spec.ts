// Mocks must come first, before imports
const mockGenerateContentStream = vi.fn()
const mockGenerateContent = vi.fn()
const mockCountTokens = vi.fn()

vi.mock("@google/gemini-cli-core", () => {
	return {
		GeminiCLI: vi.fn().mockImplementation(() => ({
			models: {
				generateContentStream: mockGenerateContentStream,
				generateContent: mockGenerateContent,
				countTokens: mockCountTokens,
			},
		})),
	}
})

import type { Anthropic } from "@anthropic-ai/sdk"

import { geminiCliDefaultModelId } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

import { GeminiCliHandler } from "../gemini-cli"

describe("GeminiCliHandler", () => {
	let handler: GeminiCliHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			geminiCliOAuthPath: "~/.config/gemini-cli/oauth.json",
			geminiCliProjectId: "test-project",
			apiModelId: "gemini-2.0-flash-001",
		}
		// Reset mocks
		vi.clearAllMocks()

		// Setup default mock responses
		mockGenerateContentStream.mockImplementation(async () => {
			return {
				[Symbol.asyncIterator]: async function* () {
					yield {
						candidates: [
							{
								content: {
									parts: [{ text: "Test response" }],
								},
							},
						],
						usageMetadata: {
							promptTokenCount: 10,
							candidatesTokenCount: 5,
							cachedContentTokenCount: 2,
						},
					}
				},
			}
		})

		mockGenerateContent.mockResolvedValue({
			text: "Test prompt response",
			candidates: [
				{
					content: {
						parts: [{ text: "Test prompt response" }],
					},
				},
			],
		})

		mockCountTokens.mockResolvedValue({
			totalTokens: 15,
		})
	})

	describe("constructor", () => {
		it("should initialize with provided options", async () => {
			handler = new GeminiCliHandler(mockOptions)
			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 150))
			expect(handler).toBeInstanceOf(GeminiCliHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should use default OAuth path if not provided", async () => {
			const handlerWithoutPath = new GeminiCliHandler({
				...mockOptions,
				geminiCliOAuthPath: undefined,
			})
			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 150))
			expect(handlerWithoutPath).toBeInstanceOf(GeminiCliHandler)
		})

		it("should use default model ID if not provided", async () => {
			const handlerWithoutModel = new GeminiCliHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 150))
			expect(handlerWithoutModel.getModel().id).toBe(geminiCliDefaultModelId)
		})

		it("should handle project ID configuration", async () => {
			const handlerWithProject = new GeminiCliHandler({
				...mockOptions,
				geminiCliProjectId: "custom-project",
			})
			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 150))
			expect(handlerWithProject).toBeInstanceOf(GeminiCliHandler)
		})
	})

	describe("getModel", () => {
		beforeEach(async () => {
			handler = new GeminiCliHandler(mockOptions)
			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 150))
		})

		it("should return model info for valid model ID", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.apiModelId)
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(1_048_576)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("should handle thinking models by removing :thinking suffix", () => {
			const handlerWithThinking = new GeminiCliHandler({
				...mockOptions,
				apiModelId: "gemini-2.5-flash-preview-04-17:thinking",
			})
			const model = handlerWithThinking.getModel()
			expect(model.id).toBe("gemini-2.5-flash-preview-04-17") // :thinking suffix removed
			expect(model.info.maxThinkingTokens).toBe(24_576)
			expect(model.info.supportsReasoningBudget).toBe(true)
			expect(model.info.requiredReasoningBudget).toBe(true)
		})

		it("should return default model if invalid model ID is provided", () => {
			const handlerWithInvalidModel = new GeminiCliHandler({
				...mockOptions,
				apiModelId: "invalid-model",
			})
			const model = handlerWithInvalidModel.getModel()
			expect(model.id).toBe(geminiCliDefaultModelId)
			expect(model.info).toBeDefined()
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

		beforeEach(async () => {
			handler = new GeminiCliHandler(mockOptions)
			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 150))
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
			expect(usageChunks[0].cacheReadTokens).toBe(2)
		})

		it("should handle reasoning/thinking parts", async () => {
			mockGenerateContentStream.mockImplementationOnce(async () => {
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							candidates: [
								{
									content: {
										parts: [
											{ thought: true, text: "Let me think..." },
											{ text: "Here's the answer" },
										],
									},
								},
							],
							usageMetadata: {
								promptTokenCount: 10,
								candidatesTokenCount: 5,
								thoughtsTokenCount: 3,
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

			const reasoningChunks = chunks.filter((chunk) => chunk.type === "reasoning")
			expect(reasoningChunks).toHaveLength(1)
			expect(reasoningChunks[0].text).toBe("Let me think...")

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Here's the answer")

			const usageChunks = chunks.filter((chunk) => chunk.type === "usage")
			expect(usageChunks[0].reasoningTokens).toBe(3)
		})

		it("should handle grounding metadata with citations", async () => {
			mockGenerateContentStream.mockImplementationOnce(async () => {
				return {
					[Symbol.asyncIterator]: async function* () {
						yield {
							candidates: [
								{
									content: {
										parts: [{ text: "Test response" }],
									},
									groundingMetadata: {
										groundingChunks: [
											{ web: { uri: "https://example.com/1" } },
											{ web: { uri: "https://example.com/2" } },
										],
									},
								},
							],
							usageMetadata: {
								promptTokenCount: 10,
								candidatesTokenCount: 5,
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
			// Should have response text and citation text
			expect(textChunks.length).toBeGreaterThan(1)
			const citationChunk = textChunks.find((chunk) => chunk.text.includes("[1]"))
			expect(citationChunk).toBeDefined()
			expect(citationChunk?.text).toContain("https://example.com/1")
			expect(citationChunk?.text).toContain("https://example.com/2")
		})
	})

	describe("completePrompt", () => {
		beforeEach(async () => {
			handler = new GeminiCliHandler(mockOptions)
			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 150))
		})

		it("should complete a prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test prompt response")
			expect(mockGenerateContent).toHaveBeenCalledWith(
				expect.objectContaining({
					model: mockOptions.apiModelId,
					contents: [{ role: "user", parts: [{ text: "Test prompt" }] }],
				}),
			)
		})

		it("should handle grounding metadata in prompt completion", async () => {
			mockGenerateContent.mockResolvedValueOnce({
				text: "Test response",
				candidates: [
					{
						content: {
							parts: [{ text: "Test response" }],
						},
						groundingMetadata: {
							groundingChunks: [{ web: { uri: "https://example.com" } }],
						},
					},
				],
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toContain("Test response")
			expect(result).toContain("https://example.com")
		})

		it("should handle errors gracefully", async () => {
			mockGenerateContent.mockRejectedValueOnce(new Error("API error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow()
		})
	})

	describe("countTokens", () => {
		beforeEach(async () => {
			handler = new GeminiCliHandler(mockOptions)
			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 150))
		})

		it("should count tokens successfully", async () => {
			const content: Anthropic.Messages.ContentBlockParam[] = [
				{
					type: "text",
					text: "Test content",
				},
			]

			const result = await handler.countTokens(content)
			expect(result).toBe(15)
			expect(mockCountTokens).toHaveBeenCalledWith(
				expect.objectContaining({
					model: mockOptions.apiModelId,
				}),
			)
		})

		it("should fall back to base implementation if counting fails", async () => {
			mockCountTokens.mockRejectedValueOnce(new Error("Count error"))

			const content: Anthropic.Messages.ContentBlockParam[] = [
				{
					type: "text",
					text: "Test content",
				},
			]

			const result = await handler.countTokens(content)
			// Should fall back to tiktoken-based counting
			expect(result).toBeGreaterThan(0)
		})

		it("should fall back if totalTokens is undefined", async () => {
			mockCountTokens.mockResolvedValueOnce({
				totalTokens: undefined,
			})

			const content: Anthropic.Messages.ContentBlockParam[] = [
				{
					type: "text",
					text: "Test content",
				},
			]

			const result = await handler.countTokens(content)
			// Should fall back to tiktoken-based counting
			expect(result).toBeGreaterThan(0)
		})
	})

	describe("calculateCost", () => {
		beforeEach(async () => {
			handler = new GeminiCliHandler(mockOptions)
			// Wait for async initialization
			await new Promise((resolve) => setTimeout(resolve, 150))
		})

		it("should calculate cost correctly", () => {
			const model = handler.getModel()
			const cost = (handler as any).calculateCost({
				info: model.info,
				inputTokens: 1000,
				outputTokens: 500,
				cacheReadTokens: 100,
			})

			expect(cost).toBeDefined()
			expect(cost).toBeGreaterThan(0)
		})

		it("should handle tiered pricing", () => {
			const handlerWithTiered = new GeminiCliHandler({
				...mockOptions,
				apiModelId: "gemini-2.5-pro",
			})
			const model = handlerWithTiered.getModel()

			// Test with tokens below tier threshold
			const costLowTier = (handlerWithTiered as any).calculateCost({
				info: model.info,
				inputTokens: 100_000,
				outputTokens: 5000,
				cacheReadTokens: 1000,
			})

			// Test with tokens above tier threshold
			const costHighTier = (handlerWithTiered as any).calculateCost({
				info: model.info,
				inputTokens: 300_000,
				outputTokens: 5000,
				cacheReadTokens: 1000,
			})

			expect(costLowTier).toBeDefined()
			expect(costHighTier).toBeDefined()
			// High tier should cost more due to higher input token count and different pricing
			expect(costHighTier).toBeGreaterThan(costLowTier)
		})

		it("should return undefined if pricing info is missing", () => {
			const model = handler.getModel()
			const modifiedInfo = { ...model.info, inputPrice: undefined }

			const cost = (handler as any).calculateCost({
				info: modifiedInfo,
				inputTokens: 1000,
				outputTokens: 500,
			})

			expect(cost).toBeUndefined()
		})
	})

	describe("error handling", () => {
		it("should handle missing gemini-cli-core package gracefully", async () => {
			// Mock the dynamic import to fail
			vi.doMock("@google/gemini-cli-core", () => {
				throw new Error("Module not found")
			})

			// This will throw during initialization
			const handlerPromise = new GeminiCliHandler(mockOptions)

			// Give it time to attempt initialization
			await new Promise((resolve) => setTimeout(resolve, 150))

			// Try to use the handler - should throw error about missing package
			await expect(async () => {
				const stream = (handlerPromise as any).createMessage("test", [])
				for await (const _chunk of stream) {
					// Should not reach here
				}
			}).rejects.toThrow()
		})
	})
})
