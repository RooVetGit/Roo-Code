import { ChutesHandler } from "../chutes" // Import ChutesHandler
// TODO: Update imports for Chutes once defined in shared/api.ts
import { ChutesModelId, chutesDefaultModelId, chutesModels } from "../../../shared/api"
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

// Test suite for ChutesHandler
describe("ChutesHandler", () => {
	let handler: ChutesHandler // Use ChutesHandler type
	let mockCreate: jest.Mock

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Get the mock create function
		mockCreate = (OpenAI as unknown as jest.Mock)().chat.completions.create

		// Create handler with mock
		handler = new ChutesHandler({}) // Instantiate ChutesHandler
	})

	test("should use the correct Chutes base URL", () => {
		// Instantiate handler inside the test to ensure clean state for this check
		new ChutesHandler({})
		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://llm.chutes.ai/v1", // Verify Chutes base URL
			}),
		)
	})

	test("should use the provided API key", () => {
		// Clear mocks before this specific test
		jest.clearAllMocks()

		// Create a handler with our API key
		const chutesApiKey = "test-chutes-api-key" // Use chutesApiKey
		new ChutesHandler({ chutesApiKey }) // Instantiate ChutesHandler

		// Verify the OpenAI constructor was called with our API key
		expect(OpenAI).toHaveBeenCalledWith(
			expect.objectContaining({
				apiKey: chutesApiKey,
			}),
		)
	})

	test("should return default model when no model is specified", () => {
		const model = handler.getModel()
		expect(model.id).toBe(chutesDefaultModelId) // Use chutesDefaultModelId
		expect(model.info).toEqual(chutesModels[chutesDefaultModelId]) // Use chutesModels
	})

	test("should return specified model when valid model is provided", () => {
		// Using an actual model ID from the Chutes API response
		const testModelId: ChutesModelId = "deepseek-ai/DeepSeek-R1"
		const handlerWithModel = new ChutesHandler({ apiModelId: testModelId }) // Instantiate ChutesHandler
		const model = handlerWithModel.getModel()

		expect(model.id).toBe(testModelId)
		expect(model.info).toEqual(chutesModels[testModelId]) // Use chutesModels
	})

	test("completePrompt method should return text from Chutes API", async () => {
		const expectedResponse = "This is a test response from Chutes"

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
		const errorMessage = "Chutes API error"
		mockCreate.mockRejectedValueOnce(new Error(errorMessage))

		await expect(handler.completePrompt("test prompt")).rejects.toThrow(
			`Chutes AI completion error: ${errorMessage}`,
		) // Updated error message prefix
	})

	test("createMessage should yield text content from stream", async () => {
		const testContent = "This is test content from Chutes stream"

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
			cacheReadTokens: 0, // Assuming 0 for Chutes
			cacheWriteTokens: 0, // Assuming 0 for Chutes
		})
	})

	test("createMessage should pass correct parameters to Chutes client", async () => {
		// Setup a handler with specific model
		const modelId: ChutesModelId = "deepseek-ai/DeepSeek-R1" // Use an actual Chutes model ID and type
		const modelInfo = chutesModels[modelId] // Use chutesModels
		const handlerWithModel = new ChutesHandler({ apiModelId: modelId }) // Instantiate ChutesHandler

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
		const systemPrompt = "Test system prompt for Chutes"
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Test message for Chutes" }]

		// Start generating a message
		const messageGenerator = handlerWithModel.createMessage(systemPrompt, messages)
		await messageGenerator.next() // Start the generator

		// Check that all parameters were passed correctly
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: modelId,
				max_tokens: modelInfo.maxTokens, // Assuming standard max_tokens
				temperature: 0.5, // Using CHUTES_DEFAULT_TEMPERATURE
				messages: expect.arrayContaining([{ role: "system", content: systemPrompt }]),
				stream: true,
				stream_options: { include_usage: true }, // Assuming standard support
			}),
		)
	})
})
