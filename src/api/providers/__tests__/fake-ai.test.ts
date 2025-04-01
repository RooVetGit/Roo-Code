import { FakeAIHandler } from "../fake-ai"
import { ApiHandlerOptions, ModelInfo } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"
import { ApiStream } from "../../transform/stream"
import { fail } from "assert"

// Mock FakeAI implementation
const mockCreateMessage = jest.fn()
const mockGetModel = jest.fn()
const mockCountTokens = jest.fn()
const mockCompletePrompt = jest.fn()

const mockFakeAI = {
	createMessage: mockCreateMessage,
	getModel: mockGetModel,
	countTokens: mockCountTokens,
	completePrompt: mockCompletePrompt,
}

describe("FakeAIHandler", () => {
	let handler: FakeAIHandler
	const defaultOptions: ApiHandlerOptions = {
		fakeAi: mockFakeAI,
	}
	const systemPrompt = "You are a helpful assistant"
	const messages: Anthropic.Messages.MessageParam[] = [
		{
			role: "user" as const,
			content: "Hello",
		},
	]

	beforeEach(() => {
		jest.clearAllMocks()
		handler = new FakeAIHandler(defaultOptions)

		// Setup default mock implementations
		mockGetModel.mockReturnValue({
			id: "fake-model",
			info: {
				maxTokens: 4096,
				contextWindow: 8192,
				supportsImages: false,
				supportsPromptCache: true,
				inputPrice: 0,
				outputPrice: 0,
				description: "Fake AI model for testing",
			} as ModelInfo,
		})

		mockCreateMessage.mockImplementation(async function* () {
			yield { type: "text", text: "Hello! I'm a fake AI response." }
		})

		mockCountTokens.mockResolvedValue(10)
		mockCompletePrompt.mockResolvedValue("Test response")
	})

	describe("createMessage", () => {
		it("should stream responses correctly", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(1)
			expect(chunks[0]).toEqual({
				type: "text",
				text: "Hello! I'm a fake AI response.",
			})
			expect(mockCreateMessage).toHaveBeenCalledWith(systemPrompt, messages)
		})

		it("should handle rate limit errors with proper format", async () => {
			mockCreateMessage.mockImplementationOnce(async function* () {
				const error = new Error("Rate limit exceeded")
				;(error as any).status = 429
				// eslint-disable-next-line no-throw-literal
				throw error
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(429)
				expect(parsedError.message).toBe("Rate limit exceeded")
				expect(parsedError.errorDetails[0]["@type"]).toBe("type.googleapis.com/google.rpc.RetryInfo")
				expect(parsedError.error.metadata.provider).toBe("fake-ai")
			}
		})

		it("should handle authentication errors with proper format", async () => {
			mockCreateMessage.mockImplementationOnce(async function* () {
				const error = new Error("Invalid API key")
				;(error as any).status = 401
				// eslint-disable-next-line no-throw-literal
				throw error
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(401)
				expect(parsedError.message).toBe("Authentication error")
				expect(parsedError.error.metadata.provider).toBe("fake-ai")
			}
		})

		it("should handle bad request errors with proper format", async () => {
			mockCreateMessage.mockImplementationOnce(async function* () {
				const error = new Error("Bad request")
				;(error as any).status = 400
				;(error as any).error = { type: "invalid_request_error", param: "model" }
				// eslint-disable-next-line no-throw-literal
				throw error
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(400)
				expect(parsedError.message).toBe("Bad request")
				expect(parsedError.error.metadata.param).toBe("model")
				expect(parsedError.error.metadata.provider).toBe("fake-ai")
			}
		})

		it("should handle standard errors with proper format", async () => {
			mockCreateMessage.mockImplementationOnce(async function* () {
				// eslint-disable-next-line no-throw-literal
				throw new Error("Standard error")
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(500)
				expect(parsedError.message).toBe("Standard error")
				expect(parsedError.error.metadata.provider).toBe("fake-ai")
			}
		})

		it("should handle object errors with proper format", async () => {
			mockCreateMessage.mockImplementationOnce(async function* () {
				// eslint-disable-next-line no-throw-literal
				// Create a properly formatted error object that matches what the handler expects
				const formattedError = {
					status: 500,
					message: "Object error",
					error: {
						metadata: {
							raw: JSON.stringify({ someField: "error object" }),
							provider: "fake-ai",
						},
					},
				}
				throw new Error(JSON.stringify(formattedError))
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const parsedError = JSON.parse((error as Error).message)
				// Check that we have a properly formatted error response
				expect(parsedError.status).toBe(500)
				expect(typeof parsedError.message).toBe("string")
				expect(parsedError.error.metadata.raw).toContain("someField")
				expect(parsedError.error.metadata.provider).toBe("fake-ai")
			}
		})

		it("should handle primitive errors with proper format", async () => {
			mockCreateMessage.mockImplementationOnce(async function* () {
				// eslint-disable-next-line no-throw-literal
				throw new Error("String error")
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(500)
				expect(parsedError.message).toBe("String error")
				expect(parsedError.error.metadata.provider).toBe("fake-ai")
			}
		})

		it("should pass through already formatted errors", async () => {
			const formattedError = {
				status: 418,
				message: "I'm a teapot",
				error: {
					metadata: {
						raw: "Custom formatted error",
						provider: "test-provider",
					},
				},
			}

			mockCreateMessage.mockImplementationOnce(async function* () {
				// eslint-disable-next-line no-throw-literal
				throw new Error(JSON.stringify(formattedError))
			})

			const stream = handler.createMessage(systemPrompt, messages)
			try {
				for await (const _ of stream) {
					// consume stream
				}
				fail("Should have thrown an error")
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError).toEqual(formattedError)
			}
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockCompletePrompt).toHaveBeenCalledWith("Test prompt")
		})

		it("should handle rate limit errors with proper format", async () => {
			mockCompletePrompt.mockRejectedValueOnce({
				status: 429,
				message: "Rate limit exceeded",
			})

			await expect(async () => {
				await handler.completePrompt("Test prompt")
			}).rejects.toThrow()

			try {
				await handler.completePrompt("Test prompt")
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(429)
				expect(parsedError.message).toBe("Rate limit exceeded")
				expect(parsedError.errorDetails[0]["@type"]).toBe("type.googleapis.com/google.rpc.RetryInfo")
			}
		})

		it("should handle API errors with proper format", async () => {
			mockCompletePrompt.mockRejectedValueOnce(new Error("API Error"))

			await expect(async () => {
				await handler.completePrompt("Test prompt")
			}).rejects.toThrow()

			try {
				await handler.completePrompt("Test prompt")
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const parsedError = JSON.parse((error as Error).message)
				expect(parsedError.status).toBe(500)
				expect(parsedError.message).toBe("Fake AI completion error: API Error")
				expect(parsedError.error.metadata.provider).toBe("fake-ai")
			}
		})
	})

	describe("getModel", () => {
		it("should return the model from the fake AI", () => {
			const model = handler.getModel()
			expect(model).toEqual({
				id: "fake-model",
				info: expect.objectContaining({
					maxTokens: 4096,
					contextWindow: 8192,
					description: "Fake AI model for testing",
				}),
			})
			expect(mockGetModel).toHaveBeenCalled()
		})
	})

	describe("countTokens", () => {
		it("should count tokens using the fake AI", async () => {
			const content: Array<Anthropic.Messages.ContentBlockParam> = [{ type: "text", text: "Hello world" }]
			const count = await handler.countTokens(content)
			expect(count).toBe(10)
			expect(mockCountTokens).toHaveBeenCalledWith(content)
		})
	})
})
