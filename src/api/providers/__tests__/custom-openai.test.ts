import { CustomOpenAiHandler } from "../custom-openai"
import { openAiModelInfoSaneDefaults } from "../../../shared/api"

describe("CustomOpenAiHandler", () => {
	it("should construct with required options", () => {
		const handler = new CustomOpenAiHandler({
			customBaseUrl: "https://api.example.com",
			customApiKey: "test-key",
			customAuthHeaderName: "X-API-Key",
			customAuthHeaderPrefix: "",
		})

		expect(handler).toBeDefined()
	})

	it("should throw error if customBaseUrl is not provided", () => {
		expect(() => {
			new CustomOpenAiHandler({
				customApiKey: "test-key",
			})
		}).toThrow("Custom OpenAI provider requires 'customBaseUrl' to be set.")
	})

	it("should use model in path when useModelInPath is true", async () => {
		const handler = new CustomOpenAiHandler({
			customBaseUrl: "https://api.example.com",
			customApiKey: "test-key",
			useModelInPath: true,
			customPathPrefix: "/api/v1/chat/",
			openAiModelId: "gpt-3.5-turbo",
			openAiCustomModelInfo: openAiModelInfoSaneDefaults,
		})

		// Mock the client.post method
		const mockPost = jest.fn().mockResolvedValue({
			data: {
				choices: [{ message: { content: "Test response" } }],
				usage: { prompt_tokens: 10, completion_tokens: 20 },
			},
		})

		// @ts-ignore - Replace the client with our mock
		handler.client = { post: mockPost }

		// Call createMessage to trigger the endpoint construction
		const stream = handler.createMessage("Test system prompt", [{ role: "user", content: "Test message" }])

		// Consume the stream to ensure the post method is called
		for await (const _ of stream) {
			// Just consume the stream
		}

		// Verify the endpoint used in the post call
		expect(mockPost).toHaveBeenCalledWith("/api/v1/chat/gpt-3.5-turbo", expect.any(Object), expect.any(Object))
	})

	it("should use standard endpoint when useModelInPath is false", async () => {
		const handler = new CustomOpenAiHandler({
			customBaseUrl: "https://api.example.com",
			customApiKey: "test-key",
			useModelInPath: false,
			openAiModelId: "gpt-3.5-turbo",
			openAiCustomModelInfo: openAiModelInfoSaneDefaults,
		})

		// Mock the client.post method
		const mockPost = jest.fn().mockResolvedValue({
			data: {
				choices: [{ message: { content: "Test response" } }],
				usage: { prompt_tokens: 10, completion_tokens: 20 },
			},
		})

		// @ts-ignore - Replace the client with our mock
		handler.client = { post: mockPost }

		// Call createMessage to trigger the endpoint construction
		const stream = handler.createMessage("Test system prompt", [{ role: "user", content: "Test message" }])

		// Consume the stream to ensure the post method is called
		for await (const _ of stream) {
			// Just consume the stream
		}

		// Verify the endpoint used in the post call
		expect(mockPost).toHaveBeenCalledWith("/chat/completions", expect.any(Object), expect.any(Object))
	})
})
