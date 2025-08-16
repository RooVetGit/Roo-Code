import type { Mock } from "vitest"

// Mocks must come first, before imports
vi.mock("vscode", () => {
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
			onDidChangeConfiguration: vi.fn((_callback) => ({
				dispose: vi.fn(),
			})),
		},
		CancellationTokenSource: vi.fn(() => ({
			token: {
				isCancellationRequested: false,
				onCancellationRequested: vi.fn(),
			},
			cancel: vi.fn(),
			dispose: vi.fn(),
		})),
		CancellationError: class CancellationError extends Error {
			constructor() {
				super("Operation cancelled")
				this.name = "CancellationError"
			}
		},
		LanguageModelChatMessage: {
			Assistant: vi.fn((content) => ({
				role: "assistant",
				content: Array.isArray(content) ? content : [new MockLanguageModelTextPart(content)],
			})),
			User: vi.fn((content) => ({
				role: "user",
				content: Array.isArray(content) ? content : [new MockLanguageModelTextPart(content)],
			})),
		},
		LanguageModelTextPart: MockLanguageModelTextPart,
		LanguageModelToolCallPart: MockLanguageModelToolCallPart,
		lm: {
			selectChatModels: vi.fn(),
		},
	}
})

import * as vscode from "vscode"
import { VsCodeLmHandler } from "../vscode-lm"
import type { ApiHandlerOptions } from "../../../shared/api"
import type { Anthropic } from "@anthropic-ai/sdk"

const mockLanguageModelChat = {
	id: "test-model",
	name: "Test Model",
	vendor: "test-vendor",
	family: "test-family",
	version: "1.0",
	maxInputTokens: 4096,
	sendRequest: vi.fn(),
	countTokens: vi.fn(),
}

describe("VsCodeLmHandler", () => {
	let handler: VsCodeLmHandler
	const defaultOptions: ApiHandlerOptions = {
		vsCodeLmModelSelector: {
			vendor: "test-vendor",
			family: "test-family",
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		handler = new VsCodeLmHandler(defaultOptions)
	})

	afterEach(() => {
		handler.dispose()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeDefined()
			expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled()
		})

		it("should handle configuration changes", () => {
			const callback = (vscode.workspace.onDidChangeConfiguration as Mock).mock.calls[0][0]
			callback({ affectsConfiguration: () => true })
			// Should reset client when config changes
			expect(handler["client"]).toBeNull()
		})
	})

	describe("createClient", () => {
		it("should create client with selector", async () => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])

			const client = await handler["createClient"]({
				vendor: "test-vendor",
				family: "test-family",
			})

			expect(client).toBeDefined()
			expect(client.id).toBe("test-model")
			expect(vscode.lm.selectChatModels).toHaveBeenCalledWith({
				vendor: "test-vendor",
				family: "test-family",
			})
		})

		it("should return default client when no models available", async () => {
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([])

			const client = await handler["createClient"]({})

			expect(client).toBeDefined()
			expect(client.id).toBe("default-lm")
			expect(client.vendor).toBe("vscode")
		})
	})

	describe("createMessage", () => {
		beforeEach(() => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])
			mockLanguageModelChat.countTokens.mockResolvedValue(10)

			// Override the default client with our test client
			handler["client"] = mockLanguageModelChat
		})

		it("should stream text responses", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: "Hello",
				},
			]

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
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(2) // Text chunk + usage chunk
			expect(chunks[0]).toEqual({
				type: "text",
				text: responseText,
			})
			expect(chunks[1]).toMatchObject({
				type: "usage",
				inputTokens: expect.any(Number),
				outputTokens: expect.any(Number),
			})
		})

		it("should handle tool calls", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: "Calculate 2+2",
				},
			]

			const toolCallData = {
				name: "calculator",
				arguments: { operation: "add", numbers: [2, 2] },
				callId: "call-1",
			}

			mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
				stream: (async function* () {
					yield new vscode.LanguageModelToolCallPart(
						toolCallData.callId,
						toolCallData.name,
						toolCallData.arguments,
					)
					return
				})(),
				text: (async function* () {
					yield JSON.stringify({ type: "tool_call", ...toolCallData })
					return
				})(),
			})

			const stream = handler.createMessage(systemPrompt, messages)
			const chunks = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(2) // Tool call chunk + usage chunk
			expect(chunks[0]).toEqual({
				type: "text",
				text: JSON.stringify({ type: "tool_call", ...toolCallData }),
			})
		})

		it("should handle errors", async () => {
			const systemPrompt = "You are a helpful assistant"
			const messages: Anthropic.Messages.MessageParam[] = [
				{
					role: "user" as const,
					content: "Hello",
				},
			]

			mockLanguageModelChat.sendRequest.mockRejectedValueOnce(new Error("API Error"))

			await expect(handler.createMessage(systemPrompt, messages).next()).rejects.toThrow("API Error")
		})
	})

	describe("getModel", () => {
		it("should return model info when client exists", async () => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])

			// Initialize client
			await handler["getClient"]()

			const model = handler.getModel()
			expect(model.id).toBe("test-model")
			expect(model.info).toBeDefined()
			expect(model.info.contextWindow).toBe(4096)
		})

		it("should return fallback model info when no client exists", () => {
			// Clear the client first
			handler["client"] = null
			const model = handler.getModel()
			expect(model.id).toBe("test-vendor/test-family")
			expect(model.info).toBeDefined()
		})
	})

	describe("completePrompt", () => {
		it("should complete single prompt", async () => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])

			const responseText = "Completed text"
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

			// Override the default client with our test client to ensure it uses
			// the mock implementation rather than the default fallback
			handler["client"] = mockLanguageModelChat

			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe(responseText)
			expect(mockLanguageModelChat.sendRequest).toHaveBeenCalled()
		})

		it("should handle errors during completion", async () => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])

			mockLanguageModelChat.sendRequest.mockRejectedValueOnce(new Error("Completion failed"))

			// Make sure we're using the mock client
			handler["client"] = mockLanguageModelChat

			const promise = handler.completePrompt("Test prompt")
			await expect(promise).rejects.toThrow("VSCode LM completion error: Completion failed")
		})
	})

	describe("session tracking", () => {
		it("should start a new session", () => {
			const sessionId = handler.startSession()
			expect(sessionId).toBeDefined()
			expect(handler.getSessionMessageCount()).toBe(0)
		})

		it("should use provided session ID", () => {
			const customSessionId = "custom-session-123"
			const sessionId = handler.startSession(customSessionId)
			expect(sessionId).toBe(customSessionId)
			expect(handler["currentSessionId"]).toBe(customSessionId)
		})

		it("should track message count in session", async () => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])
			handler["client"] = mockLanguageModelChat
			mockLanguageModelChat.countTokens.mockResolvedValue(10)

			const sessionId = handler.startSession()
			expect(handler.getSessionMessageCount()).toBe(0)

			// Mock the sendRequest to return a simple stream
			mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
				stream: (async function* () {
					yield new vscode.LanguageModelTextPart("Response 1")
					return
				})(),
				text: (async function* () {
					yield "Response 1"
					return
				})(),
			})

			// First message
			const stream1 = handler.createMessage("System prompt", [{ role: "user" as const, content: "Message 1" }], {
				taskId: sessionId,
			})
			for await (const _chunk of stream1) {
				// Consume stream
			}
			expect(handler.getSessionMessageCount()).toBe(1)

			// Mock the sendRequest for second message
			mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
				stream: (async function* () {
					yield new vscode.LanguageModelTextPart("Response 2")
					return
				})(),
				text: (async function* () {
					yield "Response 2"
					return
				})(),
			})

			// Second message
			const stream2 = handler.createMessage("System prompt", [{ role: "user" as const, content: "Message 2" }], {
				taskId: sessionId,
			})
			for await (const _chunk of stream2) {
				// Consume stream
			}
			expect(handler.getSessionMessageCount()).toBe(2)
		})

		it("should end session and clear message count", () => {
			const sessionId = handler.startSession()

			// Simulate some messages
			handler["sessionMessageCount"].set(sessionId, 5)
			handler["currentSessionId"] = sessionId

			handler.endSession()

			expect(handler["currentSessionId"]).toBeNull()
			expect(handler["sessionMessageCount"].has(sessionId)).toBe(false)
			expect(handler.getSessionMessageCount()).toBe(0)
		})

		it("should track different sessions independently", async () => {
			const mockModel = { ...mockLanguageModelChat }
			;(vscode.lm.selectChatModels as Mock).mockResolvedValueOnce([mockModel])
			handler["client"] = mockLanguageModelChat
			mockLanguageModelChat.countTokens.mockResolvedValue(10)

			// Start first session
			const session1 = "session-1"
			handler.startSession(session1)

			// Mock the sendRequest
			mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
				stream: (async function* () {
					yield new vscode.LanguageModelTextPart("Response")
					return
				})(),
				text: (async function* () {
					yield "Response"
					return
				})(),
			})

			// Send message in first session
			const stream1 = handler.createMessage("System prompt", [{ role: "user" as const, content: "Message" }], {
				taskId: session1,
			})
			for await (const _chunk of stream1) {
				// Consume stream
			}
			expect(handler.getSessionMessageCount()).toBe(1)

			// Switch to second session
			const session2 = "session-2"
			handler.startSession(session2)
			expect(handler.getSessionMessageCount()).toBe(0) // New session starts at 0

			// Mock the sendRequest for second session
			mockLanguageModelChat.sendRequest.mockResolvedValueOnce({
				stream: (async function* () {
					yield new vscode.LanguageModelTextPart("Response")
					return
				})(),
				text: (async function* () {
					yield "Response"
					return
				})(),
			})

			// Send message in second session
			const stream2 = handler.createMessage("System prompt", [{ role: "user" as const, content: "Message" }], {
				taskId: session2,
			})
			for await (const _chunk of stream2) {
				// Consume stream
			}
			expect(handler.getSessionMessageCount()).toBe(1)

			// Verify first session still has its count
			handler["currentSessionId"] = session1
			expect(handler.getSessionMessageCount()).toBe(1)
		})

		it("should clean up sessions on dispose", () => {
			const sessionId = handler.startSession()
			handler["sessionMessageCount"].set(sessionId, 3)

			handler.dispose()

			expect(handler["currentSessionId"]).toBeNull()
			expect(handler["sessionMessageCount"].size).toBe(0)
		})
	})
})
