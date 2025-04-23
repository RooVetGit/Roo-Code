// npx jest src/api/providers/__tests__/gemini.test.ts

import { Anthropic } from "@anthropic-ai/sdk"

import { GeminiHandler } from "../gemini"
import { geminiDefaultModelId } from "../../../shared/api"

const GEMINI_THINKING_MODEL = "gemini-2.5-flash-preview-04-17:thinking"

describe("GeminiHandler", () => {
	let handler: GeminiHandler
	let thinkingHandler: GeminiHandler
	let proHandler: GeminiHandler

	beforeEach(() => {
		// Create mock functions
		const mockGenerateContentStream = jest.fn()
		const mockGenerateContent = jest.fn()
		const mockGetGenerativeModel = jest.fn()

		// Regular handler without thinking capabilities
		handler = new GeminiHandler({
			apiKey: "test-key",
			apiModelId: "gemini-2.5-flash-preview-04-17", // Non-thinking model
			geminiApiKey: "test-key",
		})

		// Handler with thinking capabilities
		thinkingHandler = new GeminiHandler({
			apiKey: "test-key",
			apiModelId: GEMINI_THINKING_MODEL,
			geminiApiKey: "test-key",
		})

		// Pro handler with different capabilities and pricing
		proHandler = new GeminiHandler({
			apiKey: "test-key",
			apiModelId: "gemini-2.5-pro-preview-03-25",
			geminiApiKey: "test-key",
		})

		// Replace the clients with our mocks
		const mockClient = {
			models: {
				generateContentStream: mockGenerateContentStream,
				generateContent: mockGenerateContent,
				getGenerativeModel: mockGetGenerativeModel,
			},
		} as any

		handler["client"] = mockClient
		thinkingHandler["client"] = { ...mockClient }
		proHandler["client"] = { ...mockClient }
	})

	describe("constructor", () => {
		it("should initialize with provided config", () => {
			expect(handler["options"].geminiApiKey).toBe("test-key")
			// Regular handler should have non-thinking model
			expect(handler["options"].apiModelId).toBe("gemini-2.5-flash-preview-04-17")
			// Thinking handler should have thinking model
			expect(thinkingHandler["options"].apiModelId).toBe(GEMINI_THINKING_MODEL)
			// Pro handler should have pro model
			expect(proHandler["options"].apiModelId).toBe("gemini-2.5-pro-preview-03-25")
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

		it("should handle text messages without thinking capabilities correctly", async () => {
			// Setup the mock implementation to return an async generator
			const mockGenerateContentStream = handler["client"].models.generateContentStream as jest.Mock
			mockGenerateContentStream.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Hello" }
					yield { text: " world!" }
					yield { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
				},
			})

			const stream = handler.createMessage(systemPrompt, mockMessages) // Using standard handler without thinking capabilities
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have 3 chunks: 'Hello', ' world!', and usage info
			expect(chunks.length).toBe(3)
			expect(chunks[0]).toEqual({
				type: "text",
				text: "Hello",
			})
			expect(chunks[1]).toEqual({
				type: "text",
				text: " world!",
			})
			expect(chunks[2]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				thoughtsTokenCount: undefined, // thoughtsTokenCount should be undefined when not thinking
				thinkingBudget: undefined, // Added expected field
			})

			// Verify the call to generateContentStream
			expect(thinkingHandler["client"].models.generateContentStream).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gemini-2.5-flash-preview-04-17",
					config: expect.objectContaining({
						temperature: 0,
						systemInstruction: systemPrompt,
					}),
				}),
			)
		})

		it("should handle text messages with thinking capabilities correctly", async () => {
			// Setup the mock implementation with thinking tokens for the thinking handler
			const mockGenerateContentStream = thinkingHandler["client"].models.generateContentStream as jest.Mock
			mockGenerateContentStream.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Thinking..." }
					yield {
						usageMetadata: {
							promptTokenCount: 10,
							candidatesTokenCount: 5,
							thoughtsTokenCount: 25,
						},
					}
				},
			})

			const stream = thinkingHandler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have 2 chunks: 'Thinking...' and usage info with thinking tokens
			expect(chunks.length).toBe(2)
			expect(chunks[0]).toEqual({
				type: "text",
				text: "Thinking...",
			})
			expect(chunks[1]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				thoughtsTokenCount: 25,
				thinkingBudget: 24_576, // From gemini-2.5-flash-preview-04-17:thinking model info
			})

			// Verify the call includes thinkingConfig
			expect(handler["client"].models.generateContentStream).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gemini-2.5-flash-preview-04-17",
					config: expect.objectContaining({
						temperature: 0,
						systemInstruction: systemPrompt,
						thinkingConfig: {
							thinkingBudget: 24_576,
						},
					}),
				}),
			)
		})

		it("should handle text messages with pro model correctly", async () => {
			// Setup the mock implementation for pro model
			const mockGenerateContentStream = proHandler["client"].models.generateContentStream as jest.Mock
			mockGenerateContentStream.mockResolvedValue({
				[Symbol.asyncIterator]: async function* () {
					yield { text: "Pro model" }
					yield { text: " response" }
					yield {
						usageMetadata: {
							promptTokenCount: 15,
							candidatesTokenCount: 8,
						},
					}
				},
			})

			const stream = proHandler.createMessage(systemPrompt, mockMessages)
			const chunks = []

			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Should have 3 chunks: 'Pro model', ' response', and usage info
			expect(chunks.length).toBe(3)
			expect(chunks[0]).toEqual({
				type: "text",
				text: "Pro model",
			})
			expect(chunks[1]).toEqual({
				type: "text",
				text: " response",
			})
			expect(chunks[2]).toEqual({
				type: "usage",
				inputTokens: 15,
				outputTokens: 8,
				thoughtsTokenCount: undefined,
				thinkingBudget: undefined,
			})

			// Verify the call to generateContentStream
			expect(proHandler["client"].models.generateContentStream).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gemini-2.5-pro-preview-03-25",
					config: expect.objectContaining({
						temperature: 0,
						systemInstruction: systemPrompt,
					}),
				}),
			)
		})

		it("should handle API errors", async () => {
			const mockError = new Error("Gemini API error")
			;(handler["client"].models.generateContentStream as jest.Mock).mockRejectedValue(mockError)

			const stream = handler.createMessage(systemPrompt, mockMessages)

			await expect(async () => {
				for await (const chunk of stream) {
					// Should throw before yielding any chunks
				}
			}).rejects.toThrow()
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully with non-thinking model", async () => {
			// Mock the response with text property
			;(handler["client"].models.generateContent as jest.Mock).mockResolvedValue({
				text: "Test response",
			})

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")

			// Verify the call to generateContent
			expect(handler["client"].models.generateContent).toHaveBeenCalledWith({
				model: "gemini-2.5-flash-preview-04-17", // Use the non-thinking model ID
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
		it("should return correct model info for non-thinking model", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe("gemini-2.5-flash-preview-04-17")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.thinkingConfig).toBeUndefined()
			expect(modelInfo.info.maxTokens).toBe(65_535)
			expect(modelInfo.info.contextWindow).toBe(1_048_576)
		})

		it("should return correct model info for thinking model", () => {
			const modelInfo = thinkingHandler.getModel()
			expect(modelInfo.id).toBe("gemini-2.5-flash-preview-04-17")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.thinkingConfig).toBeDefined()
			expect(modelInfo.thinkingConfig?.thinkingBudget).toBe(24_576)
			expect(modelInfo.info.maxTokens).toBe(65_535)
			expect(modelInfo.info.contextWindow).toBe(1_048_576)
		})

		it("should return correct model info for pro model", () => {
			const modelInfo = proHandler.getModel()
			expect(modelInfo.id).toBe("gemini-2.5-pro-preview-03-25")
			expect(modelInfo.info).toBeDefined()
			expect(modelInfo.thinkingConfig).toBeUndefined()
			expect(modelInfo.info.maxTokens).toBe(65_535)
			expect(modelInfo.info.contextWindow).toBe(1_048_576)
			expect(modelInfo.info.inputPrice).toBe(2.5)
			expect(modelInfo.info.outputPrice).toBe(15)
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
})
