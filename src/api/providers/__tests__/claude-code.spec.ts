// npx vitest run src/api/providers/__tests__/claude-code.spec.ts

// Mocks must come first, before imports
vi.mock("../../../integrations/claude-code/run", () => ({
	runClaudeCode: vi.fn(),
}))

// Mock Claude Code process events
const createMockClaudeProcess = () => {
	const eventHandlers: Record<string, any> = {}
	let hasEnded = false
	let isKilled = false

	const mockProcess = {
		stdout: {
			on: vi.fn((event: string, handler: any) => {
				eventHandlers[`stdout_${event}`] = handler
			}),
		},
		stderr: {
			on: vi.fn((event: string, handler: any) => {
				eventHandlers[`stderr_${event}`] = handler
			}),
		},
		on: vi.fn((event: string, handler: any) => {
			eventHandlers[event] = handler
		}),
		pid: 12345,
		killed: false,
		kill: vi.fn((signal?: string) => {
			isKilled = true
			mockProcess.killed = true
			hasEnded = true
			return true
		}),
		_eventHandlers: eventHandlers,
		_simulateStdout: (data: string) => {
			if (eventHandlers.stdout_data && !hasEnded) {
				// Use setTimeout to ensure async behavior
				setTimeout(() => eventHandlers.stdout_data(Buffer.from(data)), 0)
			}
		},
		_simulateStderr: (data: string) => {
			if (eventHandlers.stderr_data && !hasEnded) {
				setTimeout(() => eventHandlers.stderr_data(Buffer.from(data)), 0)
			}
		},
		_simulateClose: (code: number) => {
			hasEnded = true
			if (eventHandlers.close) {
				// Delay close to allow data processing
				setTimeout(() => eventHandlers.close(code), 10)
			}
		},
		_simulateError: (error: Error) => {
			hasEnded = true
			if (eventHandlers.error) {
				setTimeout(() => eventHandlers.error(error), 0)
			}
		},
	}

	return mockProcess
}

import type { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeCodeHandler } from "../claude-code"
import { ApiHandlerOptions } from "../../../shared/api"
import { runClaudeCode } from "../../../integrations/claude-code/run"

const mockRunClaudeCode = vi.mocked(runClaudeCode)

describe("ClaudeCodeHandler", () => {
	let handler: ClaudeCodeHandler
	let mockOptions: ApiHandlerOptions
	let mockProcess: ReturnType<typeof createMockClaudeProcess>

	beforeEach(() => {
		mockOptions = {
			claudeCodePath: "/custom/path/to/claude",
			apiModelId: "claude-sonnet-4-20250514",
		}
		mockProcess = createMockClaudeProcess()
		mockRunClaudeCode.mockReturnValue(mockProcess as any)
		handler = new ClaudeCodeHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(ClaudeCodeHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should handle undefined claudeCodePath", () => {
			const handlerWithoutPath = new ClaudeCodeHandler({
				...mockOptions,
				claudeCodePath: undefined,
			})
			expect(handlerWithoutPath).toBeInstanceOf(ClaudeCodeHandler)
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "Hello" }]

		it("should call runClaudeCode with correct parameters", async () => {
			const messageGenerator = handler.createMessage(systemPrompt, messages)
			const iterator = messageGenerator[Symbol.asyncIterator]()

			// Trigger close immediately to end the iteration
			setImmediate(() => {
				mockProcess._simulateClose(0)
			})

			await iterator.next()

			expect(mockRunClaudeCode).toHaveBeenCalledWith({
				systemPrompt,
				messages,
				path: mockOptions.claudeCodePath,
				modelId: mockOptions.apiModelId,
			})
		})

		it("should handle successful Claude Code output", async () => {
			const messageGenerator = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []

			// Start collecting chunks in the background
			const chunkPromise = (async () => {
				for await (const chunk of messageGenerator) {
					chunks.push(chunk)
				}
			})()

			// Wait a tick to ensure the generator has started
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Simulate Claude Code JSON output
			mockProcess._simulateStdout('{"type":"system","subtype":"init","session_id":"test"}\n')
			await new Promise((resolve) => setTimeout(resolve, 10))

			mockProcess._simulateStdout(
				JSON.stringify({
					type: "assistant",
					message: {
						id: "test-message",
						role: "assistant",
						content: [{ type: "text", text: "Hello from Claude Code!" }],
						stop_reason: null,
						usage: {
							input_tokens: 10,
							output_tokens: 5,
							cache_read_input_tokens: 2,
							cache_creation_input_tokens: 1,
						},
					},
				}) + "\n",
			)
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Don't close with exitCode 0 immediately as it would end the while loop
			// Just verify text chunk processing
			mockProcess._simulateClose(0)

			// Wait for the chunk collection to complete
			await chunkPromise

			const textChunks = chunks.filter((chunk) => chunk.type === "text")

			expect(textChunks).toHaveLength(1)
			expect(textChunks[0].text).toBe("Hello from Claude Code!")
		})

		it("should handle Claude Code exit with error code", async () => {
			const messageGenerator = handler.createMessage(systemPrompt, messages)

			setImmediate(() => {
				mockProcess._simulateStderr("Claude Code error: Invalid model")
				mockProcess._simulateClose(1)
			})

			await expect(async () => {
				for await (const chunk of messageGenerator) {
					// Should throw before yielding any chunks
				}
			}).rejects.toThrow("Claude Code process exited with code 1")
		})

		it("should handle invalid JSON output gracefully", async () => {
			const messageGenerator = handler.createMessage(systemPrompt, messages)
			const chunks: any[] = []

			setImmediate(() => {
				mockProcess._simulateStdout("Invalid JSON\n")
				mockProcess._simulateStdout("Another invalid line\n")
				mockProcess._simulateClose(0)
			})

			for await (const chunk of messageGenerator) {
				chunks.push(chunk)
			}

			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Invalid JSON")
			expect(textChunks[1].text).toBe("Another invalid line")
		})

		it("should handle invalid model name errors with specific message", async () => {
			const messageGenerator = handler.createMessage(systemPrompt, messages)

			setImmediate(() => {
				mockProcess._simulateStdout(
					JSON.stringify({
						type: "assistant",
						message: {
							id: "test-message",
							role: "assistant",
							content: [{ type: "text", text: "Invalid model name: not-supported-model" }],
							stop_reason: "error",
							usage: { input_tokens: 10, output_tokens: 5 },
						},
					}) + "\n",
				)
			})

			await expect(async () => {
				for await (const chunk of messageGenerator) {
					// Should throw when processing the error message
				}
			}).rejects.toThrow(
				"Invalid model name: not-supported-model\n\nAPI keys and subscription plans allow different models. Make sure the selected model is included in your plan.",
			)
		})

		it("should handle AbortSignal and kill process when aborted", async () => {
			const abortController = new AbortController()
			const messageGenerator = handler.createMessage(systemPrompt, messages, {
				taskId: "test-task",
				signal: abortController.signal,
			})
			const iterator = messageGenerator[Symbol.asyncIterator]()

			// Start the generator
			const nextPromise = iterator.next()

			// Wait a bit then abort
			setTimeout(() => {
				abortController.abort()
			}, 5)

			// Simulate some output before abort
			setImmediate(() => {
				mockProcess._simulateStdout('{"type":"system","subtype":"init","session_id":"test"}\n')
			})

			await expect(nextPromise).rejects.toThrow("Request was aborted")
			expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM")
		})

		it("should kill process in finally block even on error", async () => {
			const messageGenerator = handler.createMessage(systemPrompt, messages)

			setImmediate(() => {
				mockProcess._simulateError(new Error("Process error"))
				// Also simulate close to end the while loop
				mockProcess._simulateClose(1)
			})

			await expect(async () => {
				for await (const chunk of messageGenerator) {
					// Should throw due to process error or exit code
				}
			}).rejects.toThrow("Claude Code process exited with code 1")

			expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM")
		}, 10000)
	})

	describe("getModel", () => {
		it("should return default model if no model ID is provided", () => {
			const handlerWithoutModel = new ClaudeCodeHandler({
				claudeCodePath: "/path/to/claude",
				apiModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBe("claude-sonnet-4-20250514") // default model
			expect(model.info).toBeDefined()
		})

		it("should return specified model if valid model ID is provided", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.apiModelId)
			expect(model.info).toBeDefined()
		})

		it("should return default model for invalid model ID", () => {
			const handlerWithInvalidModel = new ClaudeCodeHandler({
				claudeCodePath: "/path/to/claude",
				apiModelId: "invalid-model-id",
			})
			const model = handlerWithInvalidModel.getModel()
			expect(model.id).toBe("claude-sonnet-4-20250514") // falls back to default
			expect(model.info).toBeDefined()
		})
	})

	describe("attemptParseChunk", () => {
		it("should parse valid JSON chunks", () => {
			const validJson = '{"type":"assistant","message":{"content":[{"type":"text","text":"test"}]}}'
			// Access private method for testing
			const result = (handler as any).attemptParseChunk(validJson)
			expect(result).toEqual({
				type: "assistant",
				message: {
					content: [{ type: "text", text: "test" }],
				},
			})
		})

		it("should return null for invalid JSON", () => {
			const invalidJson = "invalid json"
			const result = (handler as any).attemptParseChunk(invalidJson)
			expect(result).toBeNull()
		})

		it("should log warning for JSON-like strings that fail to parse", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const malformedJson = '{"type":"test", invalid}'
			const result = (handler as any).attemptParseChunk(malformedJson)
			expect(result).toBeNull()
			expect(consoleSpy).toHaveBeenCalledWith(
				"Failed to parse potential JSON chunk from Claude Code:",
				expect.any(Error),
			)
			consoleSpy.mockRestore()
		})

		it("should not log warning for plain text that doesn't look like JSON", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const plainText = "This is just plain text"
			const result = (handler as any).attemptParseChunk(plainText)
			expect(result).toBeNull()
			expect(consoleSpy).not.toHaveBeenCalled()
			consoleSpy.mockRestore()
		})
	})
})
