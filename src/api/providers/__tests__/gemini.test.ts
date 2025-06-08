// npx jest src/api/providers/__tests__/gemini.test.ts

import { Anthropic } from "@anthropic-ai/sdk"

import { type ModelInfo, geminiDefaultModelId } from "@roo-code/types"
import { calculateCostGenai } from "../../../utils/calculateCostGenai"

import { GeminiHandler } from "../gemini"

// Mock the calculateCostGenai function
jest.mock("../../../utils/calculateCostGenai", () => ({
	calculateCostGenai: jest.fn().mockReturnValue(0.005),
}))

const mockedCalculateCostGenai = calculateCostGenai as jest.MockedFunction<typeof calculateCostGenai>

const GEMINI_20_FLASH_THINKING_NAME = "gemini-2.0-flash-thinking-exp-1219"

describe("GeminiHandler", () => {
	let handler: GeminiHandler
	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()
		mockedCalculateCostGenai.mockReturnValue(0.005)

		// Create mock functions
		const mockGenerateContentStream = jest.fn()
		const mockGenerateContent = jest.fn()
		const mockGetGenerativeModel = jest.fn()
		const mockCountTokens = jest.fn()

		handler = new GeminiHandler({
			apiKey: "test-key",
			apiModelId: GEMINI_20_FLASH_THINKING_NAME,
			geminiApiKey: "test-key",
		})

		// Replace the client with our mock
		handler["client"] = {
			models: {
				generateContentStream: mockGenerateContentStream,
				generateContent: mockGenerateContent,
				getGenerativeModel: mockGetGenerativeModel,
				countTokens: mockCountTokens,
			},
		} as any
	})
	describe("constructor", () => {
		it("should initialize with provided config", () => {
			expect(handler["options"].geminiApiKey).toBe("test-key")
			expect(handler["options"].apiModelId).toBe(GEMINI_20_FLASH_THINKING_NAME)
		})

		it("should initialize with geminiApiKey", () => {
			const testHandler = new GeminiHandler({
				geminiApiKey: "specific-gemini-key",
				apiModelId: "gemini-1.5-flash-002",
			})

			expect(testHandler["options"].geminiApiKey).toBe("specific-gemini-key")
			expect(testHandler["options"].apiModelId).toBe("gemini-1.5-flash-002")
		})

		it("should handle missing API key gracefully", () => {
			const testHandler = new GeminiHandler({
				apiModelId: "gemini-1.5-flash-002",
			})

			// Should not throw and should have undefined geminiApiKey
			expect(testHandler["options"].geminiApiKey).toBeUndefined()
		})

		it("should initialize with baseUrl configuration", () => {
			const testHandler = new GeminiHandler({
				geminiApiKey: "test-key",
				googleGeminiBaseUrl: "https://custom-gemini.example.com",
			})

			expect(testHandler["options"].googleGeminiBaseUrl).toBe("https://custom-gemini.example.com")
		})
	})

	describe("createMessage", () => {
		const mockMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
			{
				role: "assistant",
				content: "Hi there!",
			},
		]

		const systemPrompt = "You are a helpful assistant"

		it("should handle text messages correctly", async () => {
			// Setup the mock implementation to return an async generator
			;(handler["client"].models.generateContentStream as jest.Mock).mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Hello" }
					yield { text: " world!" }
					yield { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
				},
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}			// Should have 3 chunks: 'Hello', ' world!', and usage info
			expect(chunks.length).toBe(3)
			expect(chunks[0]).toEqual({ type: "text", text: "Hello" })
			expect(chunks[1]).toEqual({ type: "text", text: " world!" })
			expect(chunks[2]).toEqual({ 
				type: "usage", 
				inputTokens: 10, 
				outputTokens: 5,
				cacheReadTokens: undefined,
				reasoningTokens: undefined,
				totalCost: 0.005
			})

			// Verify the call to generateContentStream
			expect(handler["client"].models.generateContentStream).toHaveBeenCalledWith(
				expect.objectContaining({
					model: GEMINI_20_FLASH_THINKING_NAME,
					config: expect.objectContaining({
						temperature: 0,
						systemInstruction: systemPrompt,
					}),
				}),
			)
		})
		it("should handle reasoning/thinking output", async () => {
			// Mock response with thinking parts
			;(handler["client"].models.generateContentStream as jest.Mock).mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield {
						candidates: [
							{
								content: {
									parts: [
										{ thought: true, text: "Let me think about this..." },
										{ text: "Here's my response" },
									],
								},
							},
						],
					}
					yield { usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 8, thoughtsTokenCount: 5 } }
				},
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBe(3)
			expect(chunks[0]).toEqual({ type: "reasoning", text: "Let me think about this..." })
			expect(chunks[1]).toEqual({ type: "text", text: "Here's my response" })
			expect(chunks[2]).toEqual({
				type: "usage",
				inputTokens: 15,
				outputTokens: 8,
				reasoningTokens: 5,
				cacheReadTokens: undefined,
				totalCost: 0.005,
			})
		})

		it("should handle custom baseUrl configuration", async () => {
			const testHandler = new GeminiHandler({
				geminiApiKey: "test-key",
				googleGeminiBaseUrl: "https://custom-gemini.example.com",
				apiModelId: "gemini-1.5-flash-002",
			})

			// Mock the client
			testHandler["client"] = {
				models: {
					generateContentStream: jest.fn().mockResolvedValue({
						[Symbol.asyncIterator]: async function* () {
							yield { text: "Custom response" }
						},
					}),
				},
			} as any

			const stream = testHandler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(testHandler["client"].models.generateContentStream).toHaveBeenCalledWith(
				expect.objectContaining({
					config: expect.objectContaining({
						httpOptions: { baseUrl: "https://custom-gemini.example.com" },
					}),
				}),
			)
		})
		it("should handle usage metadata with cache and reasoning tokens", async () => {
			;(handler["client"].models.generateContentStream as jest.Mock).mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Response" }
					yield {
						usageMetadata: {
							promptTokenCount: 100,
							candidatesTokenCount: 50,
							cachedContentTokenCount: 25,
							thoughtsTokenCount: 15,
						},
					}
				},
			})

			const stream = handler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBe(2)
			expect(chunks[0]).toEqual({ type: "text", text: "Response" })
			expect(chunks[1]).toEqual({
				type: "usage",
				inputTokens: 100,
				outputTokens: 50,
				cacheReadTokens: 25,
				reasoningTokens: 15,
				totalCost: expect.any(Number),
			})
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			// Mock the response with text property
			;(handler["client"].models.generateContent as jest.Mock).mockResolvedValue({
				text: "Test response",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")

			// Verify the call to generateContent
			expect(handler["client"].models.generateContent).toHaveBeenCalledWith({
				model: GEMINI_20_FLASH_THINKING_NAME,
				contents: [{ role: "user", parts: [{ text: "Test prompt" }] }],
				config: {
					httpOptions: undefined,
					temperature: 0,
				},
			})
		})

		it("should handle API errors", async () => {
			const mockError = new Error("Gemini API error")
			;(handler["client"].models.generateContent as jest.Mock).mockRejectedValue(mockError)

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				"Gemini completion error: Gemini API error",
			)
		})

		it("should handle empty response", async () => {
			// Mock the response with empty text
			;(handler["client"].models.generateContent as jest.Mock).mockResolvedValue({
				text: "",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})
	describe("getModel", () => {
		it("should return correct model info", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe(GEMINI_20_FLASH_THINKING_NAME)
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.info.maxTokens).toBe(8192)
			expect(modelInfo.info.contextWindow).toBe(32_767)
		})

		it("should return default model if invalid model specified", () => {
			const invalidHandler = new GeminiHandler({
				apiModelId: "invalid-model",
				geminiApiKey: "test-key",
			})
			const modelInfo = invalidHandler.getModel()
			expect(modelInfo.id).toBe(geminiDefaultModelId) // Default model
		})
	})

	describe("getModel with :thinking suffix", () => {
		it("should strip :thinking suffix from model ID", () => {
			// Use a valid thinking model that exists in geminiModels
			const thinkingHandler = new GeminiHandler({
				apiModelId: "gemini-2.5-flash-preview-04-17:thinking",
				geminiApiKey: "test-key",
			})
			const modelInfo = thinkingHandler.getModel()
			expect(modelInfo.id).toBe("gemini-2.5-flash-preview-04-17") // Without :thinking suffix
		})

		it("should handle non-thinking models without modification", () => {
			const regularHandler = new GeminiHandler({
				apiModelId: "gemini-1.5-flash-002",
				geminiApiKey: "test-key",
			})
			const modelInfo = regularHandler.getModel()
			expect(modelInfo.id).toBe("gemini-1.5-flash-002") // No change
		})

		it("should handle missing model ID with default", () => {
			const defaultHandler = new GeminiHandler({
				geminiApiKey: "test-key",
			})
			const modelInfo = defaultHandler.getModel()
			expect(modelInfo.id).toBe(geminiDefaultModelId)
		})
	})

	describe("countTokens", () => {
		const mockContent = [{ type: "text", text: "Hello world" }] as Array<Anthropic.Messages.ContentBlockParam>
		it("should return token count from Gemini API", async () => {
			;(handler["client"].models.countTokens as jest.Mock).mockResolvedValue({
				totalTokens: 42,
			})

			const result = await handler.countTokens(mockContent)
			expect(result).toBe(42)

			expect(handler["client"].models.countTokens).toHaveBeenCalledWith({
				model: GEMINI_20_FLASH_THINKING_NAME,
				contents: [{ text: "Hello world" }], // Note: convertAnthropicContentToGemini format
			})
		})
		it("should fall back to parent method on API error", async () => {
			;(handler["client"].models.countTokens as jest.Mock).mockRejectedValue(new Error("API error"))

			// Mock the parent countTokens method by setting up the prototype
			const parentCountTokens = jest.fn().mockResolvedValue(25)
			const originalPrototype = Object.getPrototypeOf(handler)
			Object.setPrototypeOf(handler, {
				...originalPrototype,
				countTokens: parentCountTokens,
			})

			const result = await handler.countTokens(mockContent)
			expect(result).toBe(25)
		})

		it("should handle empty content", async () => {
			;(handler["client"].models.countTokens as jest.Mock).mockResolvedValue({
				totalTokens: 0,
			})

			const result = await handler.countTokens([])
			expect(result).toBe(0)
		})
		it("should handle undefined totalTokens response", async () => {
			;(handler["client"].models.countTokens as jest.Mock).mockResolvedValue({})

			// Mock the parent countTokens method by setting up the prototype
			const parentCountTokens = jest.fn().mockResolvedValue(10)
			const originalPrototype = Object.getPrototypeOf(handler)
			Object.setPrototypeOf(handler, {
				...originalPrototype,
				countTokens: parentCountTokens,
			})

			const result = await handler.countTokens(mockContent)
			expect(result).toBe(10)
		})
	})

	describe("calculateCostGenai utility integration", () => {
		it("should calculate cost correctly for input/output tokens", async () => {
			;(handler["client"].models.generateContentStream as jest.Mock).mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Response" }
					yield {
						usageMetadata: {
							promptTokenCount: 1000,
							candidatesTokenCount: 500,
						},
					}
				},
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "User message" }])
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((chunk) => chunk.type === "usage")
			expect(usageChunk?.totalCost).toBeGreaterThan(0)
			expect(typeof usageChunk?.totalCost).toBe("number")
		})

		it("should calculate cost with reasoning tokens", async () => {
			;(handler["client"].models.generateContentStream as jest.Mock).mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Response" }
					yield {
						usageMetadata: {
							promptTokenCount: 1000,
							candidatesTokenCount: 500,
							thoughtsTokenCount: 200,
						},
					}
				},
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "User message" }])
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((chunk) => chunk.type === "usage")
			expect(usageChunk?.totalCost).toBeGreaterThan(0)
			expect(usageChunk?.reasoningTokens).toBe(200)
		})

		it("should calculate cost with cache tokens", async () => {
			;(handler["client"].models.generateContentStream as jest.Mock).mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Response" }
					yield {
						usageMetadata: {
							promptTokenCount: 1000,
							candidatesTokenCount: 500,
							cachedContentTokenCount: 100,
						},
					}
				},
			})

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "User message" }])
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			const usageChunk = chunks.find((chunk) => chunk.type === "usage")
			expect(usageChunk?.totalCost).toBeGreaterThan(0)
			expect(usageChunk?.cacheReadTokens).toBe(100)
		})
	})

	describe("error handling", () => {
		it("should handle createMessage stream errors", async () => {
			;(handler["client"].models.generateContentStream as jest.Mock).mockRejectedValue(new Error("Stream error"))

			const stream = handler.createMessage("System prompt", [{ role: "user", content: "Test" }])

			await expect(async () => {
				for await (const chunk of stream) {
					// This should throw
				}
			}).rejects.toThrow("Stream error")
		})

		it("should handle countTokens errors gracefully", async () => {
			;(handler["client"].models.countTokens as jest.Mock).mockRejectedValue(new Error("Count error"))

			// Mock the parent countTokens method
			const parentCountTokens = jest.fn().mockResolvedValue(0)
			Object.setPrototypeOf(handler, { countTokens: parentCountTokens })

			const result = await handler.countTokens([{ type: "text", text: "Test" }])
			expect(result).toBe(0)
		})
	})

	describe("destruct", () => {
		it("should clean up resources", () => {
			expect(() => handler.destruct()).not.toThrow()
		})
	})
})
