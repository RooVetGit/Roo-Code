// npx vitest run src/api/providers/__tests__/sapaicore-utils.spec.ts

import {
	formatMessagesForConverseAPI,
	applyCacheControlToMessages,
	prepareSystemMessages,
	prepareGeminiRequestPayload,
	processGeminiStreamChunk,
} from "../sapaicore"
import { sapAiCoreModels } from "@roo-code/types"
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"

describe("SAP AI Core Utility Functions", () => {
	describe("prepareSystemMessages", () => {
		it("should return undefined for empty system prompt", () => {
			const result = prepareSystemMessages("", false)
			expect(result).toBeUndefined()
		})

		it("should return text only for system prompt without caching", () => {
			const result = prepareSystemMessages("You are a helpful assistant", false)
			expect(result).toEqual([{ text: "You are a helpful assistant" }])
		})

		it("should return text with cache point when caching enabled", () => {
			const result = prepareSystemMessages("You are a helpful assistant", true)
			expect(result).toEqual([{ text: "You are a helpful assistant" }, { cachePoint: { type: "default" } }])
		})
	})

	describe("applyCacheControlToMessages", () => {
		const mockMessages = [
			{ role: "user", content: [{ text: "First message" }] },
			{ role: "assistant", content: [{ text: "Response" }] },
			{ role: "user", content: [{ text: "Second message" }] },
			{ role: "assistant", content: [{ text: "Another response" }] },
			{ role: "user", content: [{ text: "Third message" }] },
		]

		it("should add cache points to specified message indices", () => {
			const result = applyCacheControlToMessages(mockMessages, 4, 2)

			// Check that cache points were added to indices 2 and 4
			expect(result[2].content).toContainEqual({
				cachePoint: { type: "default" },
			})
			expect(result[4].content).toContainEqual({
				cachePoint: { type: "default" },
			})

			// Check that other messages are unchanged
			expect(result[0].content).not.toContainEqual({
				cachePoint: { type: "default" },
			})
			expect(result[1].content).not.toContainEqual({
				cachePoint: { type: "default" },
			})
			expect(result[3].content).not.toContainEqual({
				cachePoint: { type: "default" },
			})
		})

		it("should handle messages without content arrays", () => {
			const messagesWithoutArrays = [
				{ role: "user", content: "Simple text" },
				{ role: "assistant", content: "Response" },
			]

			const result = applyCacheControlToMessages(messagesWithoutArrays, 1, 0)

			// Should return messages unchanged if content is not an array
			expect(result[0]).toEqual(messagesWithoutArrays[0])
			expect(result[1]).toEqual(messagesWithoutArrays[1])
		})
	})

	describe("formatMessagesForConverseAPI", () => {
		it("should format simple text messages", () => {
			const messages = [
				{ role: "user" as const, content: "Hello" },
				{ role: "assistant" as const, content: "Hi there!" },
			]

			const result = formatMessagesForConverseAPI(messages)

			expect(result).toEqual([
				{ role: "user", content: [{ text: "Hello" }] },
				{ role: "assistant", content: [{ text: "Hi there!" }] },
			])
		})

		it("should format messages with text and image content", () => {
			const messages = [
				{
					role: "user" as const,
					content: [
						{ type: "text", text: "What's in this image?" },
						{
							type: "image",
							source: {
								type: "base64",
								media_type: "image/jpeg",
								data: "base64imagedata",
							},
						},
					],
				},
			] as MessageParam[]

			const result = formatMessagesForConverseAPI(messages)

			expect(result[0].role).toBe("user")
			expect(result[0].content).toHaveLength(2)
			expect(result[0].content[0]).toEqual({ text: "What's in this image?" })
			expect(result[0].content[1]).toHaveProperty("image")
		})

		it("should handle unsupported content types gracefully", () => {
			const messages = [
				{
					role: "user" as const,
					content: [{ type: "text", text: "Hello" }, { type: "unsupported", data: "some data" } as any],
				},
			]

			// Mock console.warn to verify it's called
			const consoleSpy = vitest.spyOn(console, "warn").mockImplementation(() => {})

			const result = formatMessagesForConverseAPI(messages)

			expect(result[0].content).toHaveLength(1)
			expect(result[0].content[0]).toEqual({ text: "Hello" })
			expect(consoleSpy).toHaveBeenCalledWith("Unsupported content type: unsupported")

			consoleSpy.mockRestore()
		})
	})

	describe("prepareGeminiRequestPayload", () => {
		const mockModel = {
			id: "gemini-2.5-flash" as const,
			info: sapAiCoreModels["gemini-2.5-flash"],
		}

		it("should prepare basic Gemini payload", () => {
			const messages = [{ role: "user" as const, content: "Hello" }]

			const result = prepareGeminiRequestPayload("You are a helpful assistant", messages, mockModel)

			expect(result).toHaveProperty("contents")
			expect(result).toHaveProperty("systemInstruction")
			expect(result).toHaveProperty("generationConfig")
			expect(result.systemInstruction.parts[0].text).toBe("You are a helpful assistant")
			expect(result.generationConfig.maxOutputTokens).toBe(mockModel.info.maxTokens)
		})

		it("should add thinking config when thinking budget provided", () => {
			const messages = [{ role: "user" as const, content: "Hello" }]

			const result = prepareGeminiRequestPayload(
				"You are a helpful assistant",
				messages,
				mockModel,
				1000, // thinking budget
			)

			expect(result).toHaveProperty("thinkingConfig")
			expect(result.thinkingConfig.thinkingBudget).toBe(1000)
			expect(result.thinkingConfig.includeThoughts).toBe(true)
		})

		it("should not add thinking config when no budget provided", () => {
			const messages = [{ role: "user" as const, content: "Hello" }]

			const result = prepareGeminiRequestPayload("You are a helpful assistant", messages, mockModel)

			expect(result).not.toHaveProperty("thinkingConfig")
		})

		it("should not add thinking config when model doesn't support thinking", () => {
			const nonThinkingModel = {
				id: "gpt-4o" as const,
				info: sapAiCoreModels["gpt-4o"],
			}

			const messages = [{ role: "user" as const, content: "Hello" }]

			const result = prepareGeminiRequestPayload(
				"You are a helpful assistant",
				messages,
				nonThinkingModel,
				1000, // thinking budget
			)

			expect(result).not.toHaveProperty("thinkingConfig")
		})
	})

	describe("processGeminiStreamChunk", () => {
		it("should process regular text content", () => {
			const mockData = {
				text: "Hello world",
				usageMetadata: {
					promptTokenCount: 10,
					candidatesTokenCount: 5,
				},
			}

			const result = processGeminiStreamChunk(mockData)

			expect(result.text).toBe("Hello world")
			expect(result.usageMetadata?.promptTokenCount).toBe(10)
			expect(result.usageMetadata?.candidatesTokenCount).toBe(5)
		})

		it("should process thinking content", () => {
			const mockData = {
				candidates: [
					{
						content: {
							parts: [
								{ thought: true, text: "Let me think about this..." },
								{ thought: true, text: "The answer is clear." },
							],
						},
					},
				],
			}

			const result = processGeminiStreamChunk(mockData)

			expect(result.reasoning).toBe("Let me think about this...\nThe answer is clear.")
		})

		it("should process mixed content (text and thinking)", () => {
			const mockData = {
				candidates: [
					{
						content: {
							parts: [{ thought: true, text: "Thinking..." }, { text: "The answer is 42" }],
						},
					},
				],
			}

			const result = processGeminiStreamChunk(mockData)

			expect(result.reasoning).toBe("Thinking...")
			expect(result.text).toBe("The answer is 42")
		})

		it("should handle empty or malformed data", () => {
			const result1 = processGeminiStreamChunk({})
			expect(result1).toEqual({})

			const result2 = processGeminiStreamChunk(null)
			expect(result2).toEqual({})

			const result3 = processGeminiStreamChunk(undefined)
			expect(result3).toEqual({})
		})

		it("should process complete usage metadata", () => {
			const mockData = {
				usageMetadata: {
					promptTokenCount: 100,
					candidatesTokenCount: 50,
					thoughtsTokenCount: 25,
					cachedContentTokenCount: 10,
				},
			}

			const result = processGeminiStreamChunk(mockData)

			expect(result.usageMetadata?.promptTokenCount).toBe(100)
			expect(result.usageMetadata?.candidatesTokenCount).toBe(50)
			expect(result.usageMetadata?.thoughtsTokenCount).toBe(25)
			expect(result.usageMetadata?.cachedContentTokenCount).toBe(10)
		})
	})
})
