import { MistralHandler } from "../mistral"
import { ApiHandlerOptions, mistralDefaultModelId } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"
import { ApiStream } from "../../transform/stream"

// Mock Mistral client first
const mockCreate = jest.fn().mockImplementation(() => mockStreamResponse())

// Create a mock stream response
const mockStreamResponse = async function* () {
	yield {
		data: {
			choices: [
				{
					delta: { content: "Test response" },
					index: 0,
				},
			],
		},
	}
}

// Mock the entire module
jest.mock("@mistralai/mistralai", () => ({
	Mistral: jest.fn().mockImplementation(() => ({
		chat: {
			stream: mockCreate,
		},
	})),
}))

// Mock vscode
jest.mock("vscode", () => ({
	window: {
		createOutputChannel: jest.fn().mockReturnValue({
			appendLine: jest.fn(),
			show: jest.fn(),
			dispose: jest.fn(),
		}),
	},
	workspace: {
		getConfiguration: jest.fn().mockReturnValue({
			get: jest.fn().mockReturnValue(false),
		}),
	},
}))

describe("MistralHandler", () => {
	let handler: MistralHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		// Clear all mocks before each test
		jest.clearAllMocks()

		mockOptions = {
			apiModelId: mistralDefaultModelId,
			mistralApiKey: "test-api-key",
			includeMaxTokens: true,
			modelTemperature: 0,
			mistralModelStreamingEnabled: true,
			stopToken: undefined,
			mistralCodestralUrl: undefined,
		}
		handler = new MistralHandler(mockOptions)
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
	})

	describe("stopToken handling", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text", text: "Hello!" }],
			},
		]

		async function consumeStream(stream: ApiStream) {
			for await (const chunk of stream) {
				// Consume the stream
			}
		}

		it("should not include stop parameter when stopToken is undefined", async () => {
			const handlerWithoutStop = new MistralHandler({
				...mockOptions,
				stopToken: undefined,
			})
			const stream = handlerWithoutStop.createMessage(systemPrompt, messages)
			await consumeStream(stream)

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					stop: expect.anything(),
				}),
			)
		})

		it("should not include stop parameter when stopToken is empty string", async () => {
			const handlerWithEmptyStop = new MistralHandler({
				...mockOptions,
				stopToken: "",
			})
			const stream = handlerWithEmptyStop.createMessage(systemPrompt, messages)
			await consumeStream(stream)

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					stop: expect.anything(),
				}),
			)
		})

		it("should not include stop parameter when stopToken contains only whitespace", async () => {
			const handlerWithWhitespaceStop = new MistralHandler({
				...mockOptions,
				stopToken: "   ",
			})
			const stream = handlerWithWhitespaceStop.createMessage(systemPrompt, messages)
			await consumeStream(stream)

			expect(mockCreate).toHaveBeenCalledWith(
				expect.not.objectContaining({
					stop: expect.anything(),
				}),
			)
		})

		it("should handle non-empty stop token", async () => {
			const handlerWithCommasStop = new MistralHandler({
				...mockOptions,
				stopToken: ",,,",
			})
			const stream = handlerWithCommasStop.createMessage(systemPrompt, messages)
			await consumeStream(stream)

			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.model).toBe(mistralDefaultModelId)
			expect(callArgs.maxTokens).toBe(256000)
			expect(callArgs.temperature).toBe(0)
			expect(callArgs.stream).toBe(true)
			expect(callArgs.stop).toStrictEqual([",,,"] as string[])
		})

		it("should include stop parameter with single token", async () => {
			const handlerWithStop = new MistralHandler({
				...mockOptions,
				stopToken: "\\n\\n",
			})
			const stream = handlerWithStop.createMessage(systemPrompt, messages)
			await consumeStream(stream)

			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.model).toBe("codestral-latest")
			expect(callArgs.maxTokens).toBe(256000)
			expect(callArgs.temperature).toBe(0)
			expect(callArgs.stream).toBe(true)
			expect(callArgs.stop).toStrictEqual(["\\n\\n"] as string[])
		})

		it("should keep stop token as-is", async () => {
			const handlerWithMultiStop = new MistralHandler({
				...mockOptions,
				stopToken: "\\n\\n,,DONE, ,END,",
			})
			const stream = handlerWithMultiStop.createMessage(systemPrompt, messages)
			await consumeStream(stream)

			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.model).toBe("codestral-latest")
			expect(callArgs.maxTokens).toBe(256000)
			expect(callArgs.temperature).toBe(0)
			expect(callArgs.stream).toBe(true)
			expect(callArgs.stop).toStrictEqual(["\\n\\n,,DONE, ,END,"] as string[])
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [{ type: "text", text: "Hello!" }],
			},
		]

		async function consumeStream(stream: ApiStream) {
			for await (const chunk of stream) {
				// Consume the stream
			}
		}

		it("should create message with streaming enabled", async () => {
			const stream = handler.createMessage(systemPrompt, messages)
			await consumeStream(stream)

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "system",
							content: systemPrompt,
						}),
					]),
					stream: true,
				}),
			)
		})

		it("should handle temperature settings", async () => {
			const handlerWithTemp = new MistralHandler({
				...mockOptions,
				modelTemperature: 0.7,
			})
			const stream = handlerWithTemp.createMessage(systemPrompt, messages)
			await consumeStream(stream)

			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.temperature).toBe(0.7)
		})

		it("should transform messages correctly", async () => {
			const complexMessages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "Hello!" },
						{ type: "text", text: "How are you?" },
					],
				},
				{
					role: "assistant",
					content: [{ type: "text", text: "I'm doing well!" }],
				},
			]
			const stream = handler.createMessage(systemPrompt, complexMessages)
			await consumeStream(stream)

			const callArgs = mockCreate.mock.calls[0][0]
			expect(callArgs.messages).toEqual([
				{
					role: "system",
					content: systemPrompt,
				},
				{
					role: "user",
					content: [
						{ type: "text", text: "Hello!" },
						{ type: "text", text: "How are you?" },
					],
				},
				{
					role: "assistant",
					content: "I'm doing well!",
				},
			])
		})
	})
})
