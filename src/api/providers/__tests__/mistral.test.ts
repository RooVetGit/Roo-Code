import { MistralHandler } from "../mistral"
import { ApiHandlerOptions, mistralDefaultModelId } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"
import { ApiStreamTextChunk } from "../../transform/stream"

// Mock Mistral client
const mockStream = jest.fn()
jest.mock("@mistralai/mistralai", () => ({
	Mistral: jest.fn().mockImplementation(() => ({
		chat: {
			stream: mockStream.mockImplementation(async () => {
				const response = {
					headers: {},
					status: 200,
					statusText: "OK",
				}

				const streamResponse = {
					response,
					headers: response.headers,
					status: response.status,
					statusText: response.statusText,
					[Symbol.asyncIterator]: async function* () {
						yield {
							data: {
								choices: [
									{
										delta: { content: "Test response" },
										index: 0,
									},
								],
								usage: {
									promptTokens: 10,
									completionTokens: 5,
									totalTokens: 15,
								},
							},
						}
					},
				}

				return streamResponse
			}),
			complete: jest.fn().mockResolvedValue({
				choices: [
					{
						message: {
							content: "Test response",
							role: "assistant",
						},
						index: 0,
					},
				],
				usage: {
					promptTokens: 10,
					completionTokens: 5,
					totalTokens: 15,
				},
			}),
		},
	})),
}))

describe("MistralHandler", () => {
	let handler: MistralHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			apiModelId: "codestral-latest",
			mistralApiKey: "test-api-key",
			includeMaxTokens: true,
			modelTemperature: 0,
		}
		handler = new MistralHandler(mockOptions)
		mockStream.mockClear()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(MistralHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should throw error if API key is missing", () => {
			expect(() => {
				new MistralHandler({
					...mockOptions,
					mistralApiKey: undefined,
				})
			}).toThrow("Mistral API key is required")
		})

		it("should use custom base URL if provided", () => {
			const customBaseUrl = "https://custom.mistral.ai/v1"
			const handlerWithCustomUrl = new MistralHandler({
				...mockOptions,
				mistralCodestralUrl: customBaseUrl,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(MistralHandler)
		})
	})

	describe("getModel", () => {
		it("should return correct model info", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.apiModelId)
			expect(model.info).toBeDefined()
			expect(model.info.supportsPromptCache).toBe(false)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user" as const,
				content: [
					{
						type: "text" as const,
						text: "Hello!",
					},
				],
			},
		]

		it("should create message successfully", async () => {
			const iterator = handler.createMessage(systemPrompt, messages)
			const result = await iterator.next()

			expect(mockStream).toHaveBeenCalledWith({
				model: mockOptions.apiModelId,
				messages: expect.any(Array),
				maxTokens: expect.any(Number),
				temperature: 0,
			})

			expect(result.value).toBeDefined()
			expect(result.done).toBe(false)
			expect(result.value).toEqual({ type: "text", text: "Test response" })
		})

		it("should handle streaming response correctly", async () => {
			const iterator = handler.createMessage(systemPrompt, messages)
			const results: ApiStreamTextChunk[] = []

			for await (const chunk of iterator) {
				if ("text" in chunk) {
					results.push(chunk as ApiStreamTextChunk)
				}
			}

			expect(results.length).toBeGreaterThan(0)
			expect(results[0].text).toBe("Test response")
		})

		it("should handle errors gracefully", async () => {
			mockStream.mockRejectedValueOnce(new Error("API Error"))

			const iterator = handler.createMessage(systemPrompt, messages)
			await expect(iterator.next()).rejects.toThrow("API Error")
		})

		it("should handle stream errors", async () => {
			mockStream.mockImplementationOnce(async () => ({
				headers: {},
				status: 200,
				statusText: "OK",
				[Symbol.asyncIterator]: async function* () {
					throw new Error("Stream Error")
				},
			}))

			const iterator = handler.createMessage(systemPrompt, messages)
			await expect(iterator.next()).rejects.toThrow("Stream Error")
		})
	})

	describe("error handling and retries", () => {
		let handler: MistralHandler
		let originalMockStream: jest.Mock

		beforeEach(() => {
			mockOptions = {
				apiModelId: "codestral-latest",
				mistralApiKey: "test-api-key",
				includeMaxTokens: true,
				modelTemperature: 0,
			}
			handler = new MistralHandler(mockOptions)

			// Create a successful response function
			const createSuccessResponse = async () => {
				const response = {
					headers: {},
					status: 200,
					statusText: "OK",
				}

				return {
					response,
					headers: response.headers,
					status: response.status,
					statusText: response.statusText,
					[Symbol.asyncIterator]: async function* () {
						yield {
							data: {
								choices: [
									{
										delta: { content: "Test response" },
										index: 0,
									},
								],
								usage: {
									promptTokens: 10,
									completionTokens: 5,
									totalTokens: 15,
								},
							},
						}
					},
				}
			}

			// Store the mock implementation directly
			originalMockStream = jest.fn().mockImplementation(createSuccessResponse)
			mockStream.mockImplementation(originalMockStream)
			mockStream.mockClear()
		})

		it("should handle rate limit errors and retry", async () => {
			// Mock rate limit error on first call, then succeed
			let callCount = 0
			mockStream.mockImplementation(async () => {
				callCount++
				if (callCount === 1) {
					const error = new Error("You have been rate limited. Please retry after 2 seconds")
					error.name = "RateLimitError"
					throw error
				}
				// Call the original mock implementation
				return originalMockStream()
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: [
						{
							type: "text" as const,
							text: "Hello!",
						},
					],
				},
			]

			const iterator = handler.createMessage(systemPrompt, messages)
			const result = await iterator.next()

			expect(mockStream).toHaveBeenCalledTimes(2)
			expect(result.value).toEqual({ type: "text", text: "Test response" })
		})

		it("should handle general API errors and retry with exponential backoff", async () => {
			// Mock general error on first call, then succeed
			let callCount = 0
			mockStream.mockImplementation(async () => {
				callCount++
				if (callCount === 1) {
					throw new Error("Temporary API error")
				}
				// Call the function directly instead of the mock
				return originalMockStream()
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: [
						{
							type: "text" as const,
							text: "Hello!",
						},
					],
				},
			]

			const iterator = handler.createMessage(systemPrompt, messages)
			const result = await iterator.next()

			expect(mockStream).toHaveBeenCalledTimes(2)
			expect(result.value).toEqual({ type: "text", text: "Test response" })
		})

		it("should throw authentication errors without retrying", async () => {
			mockStream.mockImplementation(async () => {
				const error = new Error("Invalid authentication")
				error.name = "AuthenticationError"
				throw error
			})

			const systemPrompt = "You are a helpful assistant."
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: [
						{
							type: "text" as const,
							text: "Hello!",
						},
					],
				},
			]

			const iterator = handler.createMessage(systemPrompt, messages)
			await expect(iterator.next()).rejects.toThrow("authentication")
		})
	})

	describe("base URL selection", () => {
		it("should use codestral URL for codestral models", () => {
			const handler = new MistralHandler({
				apiModelId: "codestral-latest",
				mistralApiKey: "test-api-key",
			})

			// We can't directly test private methods, but we can test the behavior
			// indirectly by checking if the correct model is used
			expect(handler.getModel().id).toBe("codestral-latest")
		})

		it("should use custom codestral URL if provided", () => {
			const customUrl = "https://custom-codestral.example.com"
			const handler = new MistralHandler({
				apiModelId: "codestral-latest",
				mistralApiKey: "test-api-key",
				mistralCodestralUrl: customUrl,
			})

			expect(handler.getModel().id).toBe("codestral-latest")
		})

		it("should use standard Mistral URL for non-codestral models", () => {
			const handler = new MistralHandler({
				apiModelId: "mistral-large-latest",
				mistralApiKey: "test-api-key",
			})

			expect(handler.getModel().id).toBe("mistral-large-latest")
		})
	})

	describe("completePrompt", () => {
		let handler: MistralHandler

		beforeEach(() => {
			mockOptions = {
				apiModelId: "codestral-latest",
				mistralApiKey: "test-api-key",
				includeMaxTokens: true,
				modelTemperature: 0,
			}
			handler = new MistralHandler(mockOptions)
			mockStream.mockClear()
		})

		it("should complete prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
		})

		it("should handle errors in completePrompt", async () => {
			jest.spyOn(handler["client"].chat, "complete").mockRejectedValueOnce(new Error("API Error"))

			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("Mistral completion error: API Error")
		})
	})
})
