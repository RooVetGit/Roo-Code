import { GroqHandler } from "../groq" // Import GroqHandler
import { GroqModelId, groqDefaultModelId, groqModels } from "../../../shared/api" // Update imports for Groq
import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"

// Mock OpenAI client
jest.mock("openai", () => {
	const createMock = jest.fn()
	return jest.fn(() => ({
		chat: {
			completions: {
				create: createMock,
			},
		},
	}))
})

// Updated describe block
describe("GroqHandler", () => {
	let handler: GroqHandler // Use GroqHandler type
	let mockCreate: jest.Mock

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Get the mock create function
		mockCreate = (OpenAI as unknown as jest.Mock)().chat.completions.create

		// Create handler with mock
		handler = new GroqHandler({}) // Instantiate GroqHandler
	})

	test("should use the correct Groq base URL", () => {
		// Instantiate handler inside the test to ensure clean state for this check
		new GroqHandler({})
		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://api.groq.com/openai/v1", // Verify Groq base URL
			}),
		)
	})

	test("should use the provided API key", () => {
		// Clear mocks before this specific test
		jest.clearAllMocks()

		// Create a handler with our API key
		const groqApiKey = "test-groq-api-key" // Use groqApiKey
		new GroqHandler({ groqApiKey }) // Instantiate GroqHandler

		// Verify the OpenAI constructor was called with our API key
		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: groqApiKey,
			}),
		)
	})

	test("should return default model when no model is specified", () => {
		const model = handler.getModel()
		expect(model.id).toBe(groqDefaultModelId) // Use groqDefaultModelId
		expect(model.info).toEqual(groqModels[groqDefaultModelId]) // Use groqModels
	})

	test("should return specified model when valid model is provided", () => {
		const testModelId: GroqModelId = "llama-3.3-70b-versatile" // Use a valid Groq model ID and type
		const handlerWithModel = new GroqHandler({ apiModelId: testModelId }) // Instantiate GroqHandler
		const model = handlerWithModel.getModel()

		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(groqModels[testModelId]) // Use groqModels
	})

	// Removed reasoning_effort tests

	test("completePrompt method should return text from Groq API", async () => {
		const expectedResponse = "This is a test response from Groq"

		mockCreate.mockResolvedValueOnce({
			choices: [
				{
					message: {
						content: expectedResponse,
					},
				},
			],
		})

		const result = await handler.completePrompt("test prompt")
		expect(result).toBe(expectedResponse)
	})

	test("should handle errors in completePrompt", async () => {
		const errorMessage = "Groq API error"
		mockCreate.mockRejectedValueOnce(new Error(errorMessage))

		await expect(handler.completePrompt("test prompt")).rejects.toThrow(`Groq completion error: ${errorMessage}`) // Updated error message prefix
	})

	test("createMessage should yield text content from stream", async () => {
		const testContent = "This is test content from Groq stream"

		// Setup mock for streaming response
		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					next: jest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: {
								choices: [{ delta: { content: testContent } }],
							},
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}
		})

		// Create and consume the stream
		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		// Verify the content
		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual({
			type: "text",
			text: testContent,
		})
	})

	// Removed reasoning content test

	test("createMessage should yield usage data from stream", async () => {
		// Setup mock for streaming response that includes usage data
		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					next: jest
						.fn()
						.mockResolvedValueOnce({
							done: false,
							value: {
								choices: [{ delta: {} }], // Needs to have choices array to avoid error
								usage: {
									// Assuming standard OpenAI usage fields
									prompt_tokens: 10,
									completion_tokens: 20,
								},
							},
						})
						.mockResolvedValueOnce({ done: true }),
				}),
			}
		})

		// Create and consume the stream
		const stream = handler.createMessage("system prompt", [])
		const firstChunk = await stream.next()

		// Verify the usage data
		expect(firstChunk.done).toBe(false)
		expect(firstChunk.value).toEqual({
			// Updated expected usage structure
			type: "usage",
			inputTokens: 10,
			outputTokens: 20,
			cacheReadTokens: 0, // Assuming 0 for Groq
			cacheWriteTokens: 0, // Assuming 0 for Groq
		})
	})

	test("createMessage should pass correct parameters to Groq client", async () => {
		// Setup a handler with specific model
		const modelId: GroqModelId = "llama-3.1-8b-instant" // Use a valid Groq model ID and type
		const modelInfo = groqModels[modelId] // Use groqModels
		const handlerWithModel = new GroqHandler({ apiModelId: modelId }) // Instantiate GroqHandler

		// Setup mock for streaming response
		mockCreate.mockImplementationOnce(() => {
			return {
				[Symbol.asyncIterator]: () => ({
					async next() {
						return { done: true }
					},
				}),
			}
		})

		// System prompt and messages
		const systemPrompt = "Test system prompt for Groq"
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Test message for Groq" }]

		// Start generating a message
		const messageGenerator = handlerWithModel.createMessage(systemPrompt, messages)
		await messageGenerator.next() // Start the generator

		// Check that all parameters were passed correctly
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: modelId,
				max_tokens: modelInfo.maxTokens, // Assuming Groq uses max_tokens
				temperature: 0.5, // Using GROQ_DEFAULT_TEMPERATURE
				messages: expect.arrayContaining([{ role: "system", content: systemPrompt }]),
				stream: true,
				stream_options: { include_usage: true }, // Assuming Groq supports this
			}),
		)
	})
})
