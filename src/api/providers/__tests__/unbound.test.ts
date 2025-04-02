import { UnboundHandler } from "../unbound"
import { ApiHandlerOptions } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"

// Mock OpenAI client
const mockCreate = jest.fn()
const mockWithResponse = jest.fn()

jest.mock("openai", () => {
	return {
		__esModule: true,
		default: jest.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: (...args: any[]) => {
						const stream = {
							[Symbol.asyncIterator]: async function* () {
								// First chunk with content
								yield {
									choices: [
										{
											delta: { content: "Test response" },
											index: 0,
										},
									],
								}
								// Second chunk with usage data
								yield {
									choices: [{ delta: {}, index: 0 }],
									usage: {
										prompt_tokens: 10,
										completion_tokens: 5,
										total_tokens: 15,
									},
								}
								// Third chunk with cache usage data
								yield {
									choices: [{ delta: {}, index: 0 }],
									usage: {
										prompt_tokens: 8,
										completion_tokens: 4,
										total_tokens: 12,
										cache_creation_input_tokens: 3,
										cache_read_input_tokens: 2,
									},
								}
							},
						}

						const result = mockCreate(...args)
						if (args[0].stream) {
							mockWithResponse.mockReturnValue(
								Promise.resolve({
									data: stream,
									response: { headers: new Map() },
								}),
							)
							result.withResponse = mockWithResponse
						}
						return result
					},
				},
			},
		})),
	}
})

describe("UnboundHandler", () => {
	let handler: UnboundHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			apiModelId: "anthropic/claude-3-5-sonnet-20241022",
			unboundApiKey: "test-api-key",
			unboundModelId: "anthropic/claude-3-5-sonnet-20241022",
			unboundModelInfo: {
				description: "Anthropic's Claude 3 Sonnet model",
				maxTokens: 8192,
				contextWindow: 200000,
				supportsPromptCache: true,
				inputPrice: 0.01,
				outputPrice: 0.02,
			},
		}
		handler = new UnboundHandler(mockOptions)
		mockCreate.mockClear()
		mockWithResponse.mockClear()

		// Default mock implementation for non-streaming responses
		mockCreate.mockResolvedValue({
			id: "test-completion",
			choices: [
				{
					message: { role: "assistant", content: "Test response" },
					finish_reason: "stop",
					index: 0,
				},
			],
		})
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(UnboundHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello!",
			},
		]

		it("should handle streaming responses with text and usage data", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks: Array<{ type: string } & Record<string, any>> = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks.length).toBe(3)

			// Verify text chunk
			expect(chunks[0]).toEqual({
				type: "text",
				text: "Test response",
			})

			// Verify regular usage data
			expect(chunks[1]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
			})

			// Verify usage data with cache information
			expect(chunks[2]).toEqual({
				type: "usage",
				inputTokens: 8,
				outputTokens: 4,
				cacheWriteTokens: 3,
				cacheReadTokens: 2,
			})

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "claude-3-5-sonnet-20241022",
					messages: expect.any(Array),
					stream: true,
				}),
				expect.objectContaining({
					headers: {
						"X-Unbound-Metadata": expect.stringContaining("roo-code"),
					},
				}),
			)
		})

		it("should handle API errors", async () => {
			mockCreate.mockImplementationOnce(() => {
				// eslint-disable-next-line no-throw-literal
				throw new Error(JSON.stringify({ error: { message: "API Error" } }))
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks = []

			try {
				for await (const chunk of stream) {
					chunks.push(chunk)
				}
				fail("Expected error to be thrown")
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				// The error message will be a JSON string containing the structured error
				const parsedError = JSON.parse(error.message)
				expect(parsedError.status).toBe(500)
				expect(parsedError.message).toBe("API Error")
			}
		})
	})

	describe("createMessage error handling", () => {
		const systemPrompt = "You are a helpful assistant"
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user" as const, content: "Hello" }]

		beforeEach(() => {
			mockCreate.mockClear()
			mockWithResponse.mockClear()
			jest.spyOn(console, "error").mockImplementation(() => {})
		})

		it("should handle rate limit errors", async () => {
			// Test with status code 429
			mockCreate.mockImplementationOnce(() => {
				// eslint-disable-next-line no-throw-literal
				throw new Error(JSON.stringify({ status: 429, message: "Rate limit exceeded" }))
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(429)
				expect(parsedError.error.metadata.provider).toBe("unbound")
				expect(parsedError.errorDetails[0]["@type"]).toBe("type.googleapis.com/google.rpc.RetryInfo")
			}
		})

		it("should handle authentication errors", async () => {
			// Test with status code 401
			mockCreate.mockImplementationOnce(() => {
				// eslint-disable-next-line no-throw-literal
				throw new Error(JSON.stringify({ status: 401, message: "Invalid API key provided" }))
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(401)
				expect(parsedError.error.metadata.provider).toBe("unbound")
				expect(parsedError.message).toBe("Authentication error")
			}
		})

		it("should handle bad request errors", async () => {
			// Test with status code 400
			mockCreate.mockImplementationOnce(() => {
				// eslint-disable-next-line no-throw-literal
				const error = new Error("Invalid request parameters")
				// Add properties to the error object
				;(error as any).status = 400
				;(error as any).error = {
					type: "invalid_request_error",
					param: "messages",
				}
				throw error
			})

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
				expect(parsedError.error.metadata.provider).toBe("unbound")
			}
		})

		it("should handle model not found errors", async () => {
			// Test with status code 404
			mockCreate.mockImplementationOnce(() => {
				// eslint-disable-next-line no-throw-literal
				throw new Error(JSON.stringify({ status: 404, message: "Model not found" }))
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(404)
				expect(parsedError.error.metadata.modelId).toBe(mockOptions.unboundModelId)
				expect(parsedError.error.metadata.provider).toBe("unbound")
			}
		})

		it("should handle cache-related errors", async () => {
			// Test with cache-related error
			mockCreate.mockImplementationOnce(() => {
				// eslint-disable-next-line no-throw-literal
				throw new Error(JSON.stringify({ message: "Cache system error" }))
			})

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
				expect(parsedError.error.metadata.provider).toBe("unbound")
			}
		})

		it("should handle unknown errors", async () => {
			// Test with unknown error
			mockCreate.mockImplementationOnce(() => {
				// eslint-disable-next-line no-throw-literal
				throw new Error("Unknown error")
			})

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
				expect(parsedError.error.metadata.provider).toBe("unbound")
			}
		})

		it("should handle non-Error objects", async () => {
			// Test with custom error object
			mockCreate.mockImplementationOnce(() => {
				// eslint-disable-next-line no-throw-literal
				throw { custom: "error" }
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Expected error to be thrown")
			} catch (error) {
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(500)
				expect(parsedError.error.metadata.provider).toBe("unbound")
				expect(parsedError.error.metadata.raw).toContain("custom")
				expect(parsedError.error.metadata.raw).toContain("error")
			}
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "claude-3-5-sonnet-20241022",
					messages: [{ role: "user", content: "Test prompt" }],
					temperature: 0,
					max_tokens: 8192,
				}),
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Unbound-Metadata": expect.stringContaining("roo-code"),
					}),
				}),
			)
		})

		it("should handle API errors", async () => {
			mockCreate.mockRejectedValueOnce(new Error(JSON.stringify({ error: { message: "API Error" } })))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("Unbound completion error: API Error")
		})

		it("should handle empty response", async () => {
			mockCreate.mockResolvedValueOnce({
				choices: [{ message: { content: "" } }],
			})
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should not set max_tokens for non-Anthropic models", async () => {
			mockCreate.mockClear()

			const nonAnthropicOptions = {
				apiModelId: "openai/gpt-4o",
				unboundApiKey: "test-key",
				unboundModelId: "openai/gpt-4o",
				unboundModelInfo: {
					description: "OpenAI's GPT-4",
					maxTokens: undefined,
					contextWindow: 128000,
					supportsPromptCache: true,
					inputPrice: 0.01,
					outputPrice: 0.03,
				},
			}
			const nonAnthropicHandler = new UnboundHandler(nonAnthropicOptions)

			await nonAnthropicHandler.completePrompt("Test prompt")
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "gpt-4o",
					messages: [{ role: "user", content: "Test prompt" }],
					temperature: 0,
				}),
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Unbound-Metadata": expect.stringContaining("roo-code"),
					}),
				}),
			)
			expect(mockCreate.mock.calls[0][0]).not.toHaveProperty("max_tokens")
		})

		it("should not set temperature for openai/o3-mini", async () => {
			mockCreate.mockClear()

			const openaiOptions = {
				apiModelId: "openai/o3-mini",
				unboundApiKey: "test-key",
				unboundModelId: "openai/o3-mini",
				unboundModelInfo: {
					maxTokens: undefined,
					contextWindow: 128000,
					supportsPromptCache: true,
					inputPrice: 0.01,
					outputPrice: 0.03,
				},
			}
			const openaiHandler = new UnboundHandler(openaiOptions)

			await openaiHandler.completePrompt("Test prompt")
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "o3-mini",
					messages: [{ role: "user", content: "Test prompt" }],
				}),
				expect.objectContaining({
					headers: expect.objectContaining({
						"X-Unbound-Metadata": expect.stringContaining("roo-code"),
					}),
				}),
			)
			expect(mockCreate.mock.calls[0][0]).not.toHaveProperty("temperature")
		})
	})

	describe("getModel", () => {
		it("should return model info", () => {
			const modelInfo = handler.getModel()
			expect(modelInfo.id).toBe(mockOptions.apiModelId)
			expect(modelInfo.info).toBeDefined()
		})

		it("should return default model when invalid model provided", () => {
			const handlerWithInvalidModel = new UnboundHandler({
				...mockOptions,
				unboundModelId: "invalid/model",
				unboundModelInfo: undefined,
			})
			const modelInfo = handlerWithInvalidModel.getModel()
			expect(modelInfo.id).toBe("anthropic/claude-3-5-sonnet-20241022") // Default model
			expect(modelInfo.info).toBeDefined()
		})
	})
})
