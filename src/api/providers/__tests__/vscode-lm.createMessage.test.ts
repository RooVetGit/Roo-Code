import * as vscode from "vscode"
import { VsCodeLmHandler } from "../vscode-lm"
import { ApiHandlerOptions } from "../../../shared/api"
import { Anthropic } from "@anthropic-ai/sdk"
import { fail } from "assert"
import { ApiStreamChunk } from "../../transform/stream"

// Mock vscode namespace
jest.mock("vscode", () => {
	class MockLanguageModelTextPart {
		type = "text"
		constructor(public value: string) {}
	}

	class MockLanguageModelToolCallPart {
		type = "tool_call"
		constructor(
			public callId: string,
			public name: string,
			public input: any,
		) {}
	}

	return {
		workspace: {
			onDidChangeConfiguration: jest.fn((callback) => ({
				dispose: jest.fn(),
			})),
		},
		CancellationTokenSource: jest.fn(() => ({
			token: {
				isCancellationRequested: false,
				onCancellationRequested: jest.fn(),
			},
			cancel: jest.fn(),
			dispose: jest.fn(),
		})),
		CancellationError: class CancellationError extends Error {
			constructor() {
				super("Operation cancelled")
				this.name = "CancellationError"
			}
		},
		LanguageModelChatMessage: {
			Assistant: jest.fn((content) => ({
				role: "assistant",
				content: Array.isArray(content) ? content : [new MockLanguageModelTextPart(content)],
			})),
			User: jest.fn((content) => ({
				role: "user",
				content: Array.isArray(content) ? content : [new MockLanguageModelTextPart(content)],
			})),
		},
		LanguageModelTextPart: MockLanguageModelTextPart,
		LanguageModelToolCallPart: MockLanguageModelToolCallPart,
		lm: {
			selectChatModels: jest.fn(),
		},
	}
})

const mockLanguageModelChat = {
	id: "test-model",
	name: "Test Model",
	vendor: "test-vendor",
	family: "test-family",
	version: "1.0",
	maxInputTokens: 4096,
	sendRequest: jest.fn(),
	countTokens: jest.fn(),
}

describe("VsCodeLmHandler.createMessage", () => {
	let handler: VsCodeLmHandler
	const defaultOptions: ApiHandlerOptions = {
		vsCodeLmModelSelector: {
			vendor: "test-vendor",
			family: "test-family",
		},
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
		handler = new VsCodeLmHandler(defaultOptions)

		// Setup mock client
		const mockModel = { ...mockLanguageModelChat }
		;(vscode.lm.selectChatModels as jest.Mock).mockResolvedValueOnce([mockModel])
		mockLanguageModelChat.countTokens.mockResolvedValue(10)
	})

	afterEach(() => {
		handler.dispose()
	})

	it("should stream text responses correctly", async () => {
		const responseText = "Hello! How can I help you?"
		mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
			stream: (async function* () {
				yield new vscode.LanguageModelTextPart(responseText)
				return
			})(),
			text: (async function* () {
				yield responseText
				return
			})(),
		})

		const stream = handler.createMessage(systemPrompt, messages)
		const chunks: ApiStreamChunk[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		expect(chunks).toHaveLength(2) // Text chunk + usage chunk
		expect(chunks[0]).toEqual({
			type: "text",
			text: responseText,
		})
		expect(chunks[1]).toEqual({
			type: "usage",
			inputTokens: 10,
			outputTokens: 10,
			totalCost: expect.any(Number),
		})
	})

	it("should handle tool calls correctly", async () => {
		const toolCallData = {
			name: "calculator",
			callId: "tool-123",
			input: { operation: "add", numbers: [2, 2] },
		}

		mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
			stream: (async function* () {
				yield new vscode.LanguageModelToolCallPart(toolCallData.callId, toolCallData.name, toolCallData.input)
				return
			})(),
			text: (async function* () {
				yield JSON.stringify(toolCallData)
				return
			})(),
		})

		const stream = handler.createMessage(systemPrompt, messages)
		const chunks: ApiStreamChunk[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		expect(chunks).toHaveLength(2) // Tool call chunk + usage chunk
		expect(chunks[0]).toEqual({
			type: "text",
			text: JSON.stringify({
				type: "tool_call",
				name: toolCallData.name,
				arguments: toolCallData.input,
				callId: toolCallData.callId,
			}),
		})
	})

	it("should handle cancellation errors", async () => {
		mockLanguageModelChat.sendRequest.mockRejectedValueOnce(new vscode.CancellationError())

		const stream = handler.createMessage(systemPrompt, messages)
		await expect(async () => {
			for await (const _ of stream) {
				// consume stream
			}
		}).rejects.toThrow("Request cancelled by user")
	})

	it("should handle rate limit errors with proper format", async () => {
		// Test with status code 429
		mockLanguageModelChat.sendRequest.mockImplementationOnce(() => {
			// eslint-disable-next-line no-throw-literal
			throw new Error(JSON.stringify({ status: 429, message: "Rate limit exceeded" }))
		})

		try {
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(429)
			expect(parsedError.message).toBe("Rate limit exceeded")
			expect(parsedError.errorDetails[0]["@type"]).toBe("type.googleapis.com/google.rpc.RetryInfo")
		}
	})

	it("should handle rate limit errors with message text", async () => {
		// Test with message containing 'rate limit'
		mockLanguageModelChat.sendRequest.mockImplementationOnce(() => {
			// eslint-disable-next-line no-throw-literal
			throw new Error(JSON.stringify({ message: "You have exceeded your rate limit" }))
		})

		try {
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(429)
			expect(parsedError.message).toBe("Rate limit exceeded")
		}
	})

	it("should handle rate limit errors with error code", async () => {
		// Test with error code
		mockLanguageModelChat.sendRequest.mockImplementationOnce(() => {
			// eslint-disable-next-line no-throw-literal
			const error = new Error(JSON.stringify({ error: { code: "rate_limit_exceeded" } }))
			// Add status property to the error object
			;(error as any).status = 429
			throw error
		})

		try {
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(429)
			expect(parsedError.message).toBe("Rate limit exceeded")
		}
	})

	it("should handle standard errors", async () => {
		mockLanguageModelChat.sendRequest.mockImplementationOnce(() => {
			// eslint-disable-next-line no-throw-literal
			throw new Error("Standard error")
		})

		try {
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(500)
			expect(parsedError.message).toBe("Standard error")
		}
	})

	it("should handle object errors", async () => {
		mockLanguageModelChat.sendRequest.mockImplementationOnce(() => {
			// eslint-disable-next-line no-throw-literal
			throw new Error(JSON.stringify({ someField: "error object" }))
		})

		try {
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(500)
			expect(typeof parsedError.message).toBe("string")
			expect(parsedError.message).toContain("someField")
		}
	})

	it("should handle primitive errors", async () => {
		mockLanguageModelChat.sendRequest.mockImplementationOnce(() => {
			// eslint-disable-next-line no-throw-literal
			throw new Error("String error")
		})

		try {
			const stream = handler.createMessage(systemPrompt, messages)
			for await (const _ of stream) {
				// consume stream
			}
			fail("Should have thrown an error")
		} catch (error) {
			const parsedError = JSON.parse((error as Error).message)
			expect(parsedError.status).toBe(500)
			expect(parsedError.message).toBe("String error")
		}
	})

	it("should handle unknown chunk types", async () => {
		const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {})

		// Create a custom chunk type that's not handled
		const unknownChunk = { type: "unknown" }

		mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
			stream: (async function* () {
				yield unknownChunk
				yield new vscode.LanguageModelTextPart("Valid text")
				return
			})(),
			text: (async function* () {
				yield "Text"
				return
			})(),
		})

		const stream = handler.createMessage(systemPrompt, messages)
		const chunks: ApiStreamChunk[] = []
		for await (const chunk of stream) {
			chunks.push(chunk)
		}

		// Should only have the valid text chunk and usage
		expect(chunks).toHaveLength(2)
		expect(chunks[0]).toEqual({
			type: "text",
			text: "Valid text",
		})

		// Should have logged a warning about the unknown chunk
		expect(consoleSpy).toHaveBeenCalledWith(
			"Roo Code <Language Model API>: Unknown chunk type received:",
			expect.anything(),
		)

		consoleSpy.mockRestore()
	})
})
