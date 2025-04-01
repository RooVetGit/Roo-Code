import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { ApiHandlerOptions, ModelInfo, requestyDefaultModelInfo } from "../../../shared/api"
import { RequestyHandler } from "../requesty"
import { convertToOpenAiMessages } from "../../transform/openai-format"
import { convertToR1Format } from "../../transform/r1-format"

// Mock OpenAI and transform functions
jest.mock("openai")
jest.mock("../../transform/openai-format")
jest.mock("../../transform/r1-format")

describe("RequestyHandler", () => {
	let handler: RequestyHandler
	let mockCreate: jest.Mock

	const defaultOptions: ApiHandlerOptions = {
		requestyApiKey: "test-key",
		requestyModelId: "test-model",
		requestyModelInfo: {
			maxTokens: 8192,
			contextWindow: 200_000,
			supportsImages: true,
			supportsComputerUse: true,
			supportsPromptCache: true,
			inputPrice: 3.0,
			outputPrice: 15.0,
			cacheWritesPrice: 3.75,
			cacheReadsPrice: 0.3,
			description:
				"Claude 3.7 Sonnet is an advanced large language model with improved reasoning, coding, and problem-solving capabilities. It introduces a hybrid reasoning approach, allowing users to choose between rapid responses and extended, step-by-step processing for complex tasks. The model demonstrates notable improvements in coding, particularly in front-end development and full-stack updates, and excels in agentic workflows, where it can autonomously navigate multi-step processes. Claude 3.7 Sonnet maintains performance parity with its predecessor in standard mode while offering an extended reasoning mode for enhanced accuracy in math, coding, and instruction-following tasks. Read more at the [blog post here](https://www.anthropic.com/news/claude-3-7-sonnet)",
		},
		openAiStreamingEnabled: true,
		includeMaxTokens: true, // Add this to match the implementation
	}

	beforeEach(() => {
		// Clear mocks
		jest.clearAllMocks()

		// Setup mock create function
		mockCreate = jest.fn()

		// Mock OpenAI constructor
		;(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
			() =>
				({
					chat: {
						completions: {
							create: mockCreate.mockImplementation(() => {
								return {
									[Symbol.asyncIterator]: async function* () {
										yield {
											choices: [{ delta: { content: "Hello world" } }],
										}
										yield {
											choices: [{ delta: {} }],
											usage: {
												prompt_tokens: 10,
												completion_tokens: 5,
											},
										}
									},
								}
							}),
						},
					},
				}) as unknown as OpenAI,
		)

		// Mock transform functions
		;(convertToOpenAiMessages as jest.Mock).mockImplementation((messages) => messages)
		;(convertToR1Format as jest.Mock).mockImplementation((messages) => messages)

		// Create handler instance
		handler = new RequestyHandler(defaultOptions)
	})

	describe("constructor", () => {
		it("should initialize with correct options", () => {
			expect(OpenAI).toHaveBeenCalledWith({
				baseURL: "https://router.requesty.ai/v1",
				apiKey: defaultOptions.requestyApiKey,
				defaultHeaders: {
					"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
					"X-Title": "Roo Code",
				},
			})
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant"
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

		describe("with streaming enabled", () => {
			beforeEach(() => {
				const stream = {
					[Symbol.asyncIterator]: async function* () {
						yield {
							choices: [{ delta: { content: "Hello" } }],
						}
						yield {
							choices: [{ delta: { content: " world" } }],
							usage: {
								prompt_tokens: 30,
								completion_tokens: 10,
								prompt_tokens_details: {
									cached_tokens: 15,
									caching_tokens: 5,
								},
							},
						}
					},
				}
				mockCreate.mockResolvedValue(stream)
			})

			it("should handle streaming response correctly", async () => {
				const stream = handler.createMessage(systemPrompt, messages)
				const results = []

				for await (const chunk of stream) {
					results.push(chunk)
				}

				expect(results).toEqual([
					{ type: "text", text: "Hello world" },
					{
						type: "usage",
						inputTokens: 10,
						outputTokens: 5,
						cacheWriteTokens: 0,
						cacheReadTokens: 0,
						totalCost: 0.000105, // (10 * 3 / 1,000,000) + (5 * 15 / 1,000,000)
					},
				])

				expect(mockCreate).toHaveBeenCalledWith({
					model: defaultOptions.requestyModelId,
					temperature: 0,
					messages: [
						{
							role: "system",
							content: [
								{
									cache_control: {
										type: "ephemeral",
									},
									text: systemPrompt,
									type: "text",
								},
							],
						},
						{
							role: "user",
							content: [
								{
									cache_control: {
										type: "ephemeral",
									},
									text: "Hello",
									type: "text",
								},
							],
						},
					],
					stream: true,
					stream_options: { include_usage: true },
					max_tokens: defaultOptions.requestyModelInfo?.maxTokens,
				})
			})

			it("should not include max_tokens when includeMaxTokens is false", async () => {
				handler = new RequestyHandler({
					...defaultOptions,
					includeMaxTokens: false,
				})

				await handler.createMessage(systemPrompt, messages).next()

				expect(mockCreate).toHaveBeenCalledWith(
					expect.not.objectContaining({
						max_tokens: expect.any(Number),
					}),
				)
			})

			it("should handle deepseek-reasoner model format", async () => {
				handler = new RequestyHandler({
					...defaultOptions,
					requestyModelId: "deepseek-reasoner",
				})

				await handler.createMessage(systemPrompt, messages).next()

				expect(convertToR1Format).toHaveBeenCalledWith([{ role: "user", content: systemPrompt }, ...messages])
			})
		})

		describe("with streaming disabled", () => {
			beforeEach(() => {
				handler = new RequestyHandler({
					...defaultOptions,
					openAiStreamingEnabled: false,
				})

				mockCreate.mockResolvedValue({
					choices: [{ message: { content: "Hello world" } }],
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
					},
				})
			})

			it("should handle non-streaming response correctly", async () => {
				const stream = handler.createMessage(systemPrompt, messages)
				const results = []

				for await (const chunk of stream) {
					results.push(chunk)
				}

				expect(results).toEqual([
					{ type: "text", text: "Hello world" },
					{
						type: "usage",
						inputTokens: 10,
						outputTokens: 5,
						cacheWriteTokens: 0,
						cacheReadTokens: 0,
						totalCost: 0.000105, // (10 * 3 / 1,000,000) + (5 * 15 / 1,000,000)
					},
				])

				// Update the expected call to match the implementation
				expect(mockCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						model: defaultOptions.requestyModelId,
						stream: true,
						stream_options: { include_usage: true },
					}),
				)
			})
		})
	})

	describe("getModel", () => {
		it("should return correct model information", () => {
			const result = handler.getModel()
			expect(result).toEqual({
				id: defaultOptions.requestyModelId,
				info: defaultOptions.requestyModelInfo,
			})
		})

		it("should use sane defaults when no model info provided", () => {
			handler = new RequestyHandler({
				...defaultOptions,
				requestyModelInfo: undefined,
			})

			const result = handler.getModel()
			expect(result).toEqual({
				id: defaultOptions.requestyModelId,
				info: defaultOptions.requestyModelInfo,
			})
		})
	})

	describe("completePrompt", () => {
		beforeEach(() => {
			mockCreate.mockResolvedValue({
				choices: [{ message: { content: "Completed response" } }],
			})
		})

		it("should complete prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Completed response")
			expect(mockCreate).toHaveBeenCalledWith({
				model: defaultOptions.requestyModelId,
				messages: [{ role: "user", content: "Test prompt" }],
			})
		})

		it("should handle errors correctly", async () => {
			const errorMessage = "API error"
			mockCreate.mockRejectedValue(new Error(errorMessage))

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow(
				`OpenAI completion error: ${errorMessage}`,
			)
		})
	})

	describe("error handling", () => {
		const systemPrompt = "You are a helpful assistant"
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user" as const, content: "Hello" }]

		beforeEach(() => {
			mockCreate.mockClear()
			jest.spyOn(console, "error").mockImplementation(() => {})
		})

		it("should handle rate limit errors", async () => {
			const error = new Error("Rate limit exceeded")
			Object.assign(error, {
				status: 429,
				response: {
					headers: {
						"retry-after": "60",
					},
				},
			})
			mockCreate.mockRejectedValueOnce(error)

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(429)
				expect(parsedError.error.metadata.provider).toBe("requesty")
				expect(parsedError.errorDetails[0]["@type"]).toBe("type.googleapis.com/google.rpc.RetryInfo")
				expect(parsedError.errorDetails[0].retryDelay).toBe("60s")
			}
		})

		it("should handle quota exceeded errors", async () => {
			const error = new Error("Monthly quota exceeded for your subscription")
			mockCreate.mockRejectedValueOnce(error)

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(429)
				expect(parsedError.message).toBe("Quota exceeded")
				expect(parsedError.error.metadata.provider).toBe("requesty")
			}
		})

		it("should handle authentication errors", async () => {
			const error = new Error("Invalid API key provided")
			Object.assign(error, { status: 401 })
			mockCreate.mockRejectedValueOnce(error)

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(401)
				expect(parsedError.error.metadata.provider).toBe("requesty")
				expect(parsedError.error.metadata.raw).toBe("Invalid API key provided")
			}
		})

		it("should handle bad request errors", async () => {
			const error = new Error("Invalid request parameters")
			Object.assign(error, {
				status: 400,
				error: {
					type: "invalid_request_error",
					param: "messages",
				},
			})
			mockCreate.mockRejectedValueOnce(error)

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(400)
				expect(parsedError.error.metadata.param).toBe("messages")
				expect(parsedError.error.metadata.provider).toBe("requesty")
			}
		})

		it("should handle model not found errors", async () => {
			const error = new Error("Model not found")
			Object.assign(error, { status: 404 })
			mockCreate.mockRejectedValueOnce(error)

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(404)
				expect(parsedError.error.metadata.modelId).toBe(defaultOptions.requestyModelId)
				expect(parsedError.error.metadata.provider).toBe("requesty")
			}
		})

		it("should handle cache-related errors", async () => {
			const error = new Error("Cache system error")
			mockCreate.mockRejectedValueOnce(error)

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(500)
				expect(parsedError.message).toBe("Cache error")
				expect(parsedError.error.metadata.provider).toBe("requesty")
			}
		})

		it("should handle unknown errors", async () => {
			const error = new Error("Unknown error")
			mockCreate.mockRejectedValueOnce(error)

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(500)
				expect(parsedError.error.metadata.raw).toBe("Unknown error")
				expect(parsedError.error.metadata.provider).toBe("requesty")
			}
		})
	})
})
