// npx vitest services/logging/__tests__/ConversationLogger.spec.ts

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { ConversationLogger } from "../ConversationLogger"

// Mock VSCode workspace configuration
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(),
	},
}))

// Mock fs/promises
vi.mock("fs/promises", () => ({
	mkdir: vi.fn(),
	appendFile: vi.fn(),
}))

describe("ConversationLogger", () => {
	let tempDir: string
	let logger: ConversationLogger

	beforeEach(() => {
		// Create a temporary directory path for testing
		tempDir = path.join(os.tmpdir(), "test-workspace", Math.random().toString(36).substring(7))

		// Reset mocks
		vi.clearAllMocks()
		// Mock configuration to be enabled by default
		vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
			get: vi.fn().mockReturnValue(true),
		} as any)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with required workspaceRoot", () => {
			logger = new ConversationLogger(tempDir)

			expect(logger).toBeInstanceOf(ConversationLogger)
			expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith("rooCode.logging")
		})

		it("should create log directory path correctly", () => {
			logger = new ConversationLogger(tempDir)

			expect(fs.mkdir).toHaveBeenCalledWith(path.join(tempDir, ".roo-logs"), { recursive: true })
		})

		it("should generate unique session IDs", () => {
			const logger1 = new ConversationLogger(tempDir)
			const logger2 = new ConversationLogger(tempDir)

			// Access private sessionId through type assertion for testing
			const sessionId1 = (logger1 as any).sessionId
			const sessionId2 = (logger2 as any).sessionId

			expect(sessionId1).toMatch(/^sess_\d+_[a-z0-9]{9}$/)
			expect(sessionId2).toMatch(/^sess_\d+_[a-z0-9]{9}$/)
			expect(sessionId1).not.toEqual(sessionId2)
		})

		it("should handle directory creation errors gracefully", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const mkdirError = new Error("Directory creation failed")
			vi.mocked(fs.mkdir).mockRejectedValueOnce(mkdirError)

			logger = new ConversationLogger(tempDir)

			// Wait for async directory creation to complete
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to create log directory:", mkdirError)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("logging methods", () => {
		beforeEach(() => {
			logger = new ConversationLogger(tempDir)
		})

		describe("logUserMessage", () => {
			it("should log user message with correct format", async () => {
				const message = "Test user message"
				const mode = "debug"
				const context = { userId: "123" }

				await logger.logUserMessage(message, mode, context)

				expect(fs.appendFile).toHaveBeenCalledTimes(1)
				const [filePath, content] = vi.mocked(fs.appendFile).mock.calls[0]

				expect(filePath).toMatch(/.roo-logs[/\\]sess_\d+_[a-z0-9]{9}\.jsonl$/)

				const logEntry = JSON.parse(content as string)
				expect(logEntry).toMatchObject({
					type: "user_message",
					mode: mode,
					content: message,
					context: context,
					session_id: expect.stringMatching(/^sess_\d+_[a-z0-9]{9}$/),
				})
				expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
			})

			it("should use default mode when not provided", async () => {
				await logger.logUserMessage("Test message")

				const logEntry = JSON.parse(vi.mocked(fs.appendFile).mock.calls[0][1] as string)
				expect(logEntry.mode).toBe("code")
			})

			it("should use empty object for context when not provided", async () => {
				await logger.logUserMessage("Test message")

				const logEntry = JSON.parse(vi.mocked(fs.appendFile).mock.calls[0][1] as string)
				expect(logEntry.context).toEqual({})
			})
		})

		describe("logAIResponse", () => {
			it("should log AI response with correct format", async () => {
				const response = "Test AI response"
				const mode = "architect"
				const toolCalls = [{ tool: "read_file", params: { path: "test.js" } }]

				await logger.logAIResponse(response, mode, toolCalls)

				expect(fs.appendFile).toHaveBeenCalledTimes(1)
				const logEntry = JSON.parse(vi.mocked(fs.appendFile).mock.calls[0][1] as string)

				expect(logEntry).toMatchObject({
					type: "ai_response",
					mode: mode,
					content: response,
					tool_calls: toolCalls,
					session_id: expect.stringMatching(/^sess_\d+_[a-z0-9]{9}$/),
				})
			})

			it("should use default mode and empty tool calls when not provided", async () => {
				await logger.logAIResponse("Test response")

				const logEntry = JSON.parse(vi.mocked(fs.appendFile).mock.calls[0][1] as string)
				expect(logEntry.mode).toBe("code")
				expect(logEntry.tool_calls).toEqual([])
			})
		})

		describe("logToolCall", () => {
			it("should log tool call with correct format", async () => {
				const toolName = "execute_command"
				const parameters = { command: "npm test" }
				const result = { success: true, output: "All tests passed" }

				await logger.logToolCall(toolName, parameters, result)

				expect(fs.appendFile).toHaveBeenCalledTimes(1)
				const logEntry = JSON.parse(vi.mocked(fs.appendFile).mock.calls[0][1] as string)

				expect(logEntry).toMatchObject({
					type: "tool_call",
					tool_name: toolName,
					parameters: parameters,
					result: result,
					session_id: expect.stringMatching(/^sess_\d+_[a-z0-9]{9}$/),
				})
			})

			it("should handle undefined result", async () => {
				await logger.logToolCall("read_file", { path: "test.js" })

				const logEntry = JSON.parse(vi.mocked(fs.appendFile).mock.calls[0][1] as string)
				expect(logEntry.result).toBeUndefined()
			})
		})
	})

	describe("configuration handling", () => {
		it("should not log when disabled in configuration", async () => {
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
				get: vi.fn().mockReturnValue(false),
			} as any)

			logger = new ConversationLogger(tempDir)
			await logger.logUserMessage("Test message")

			expect(fs.appendFile).not.toHaveBeenCalled()
		})

		it("should log when enabled in configuration", async () => {
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
				get: vi.fn().mockReturnValue(true),
			} as any)

			logger = new ConversationLogger(tempDir)
			await logger.logUserMessage("Test message")

			expect(fs.appendFile).toHaveBeenCalledTimes(1)
		})

		it("should default to false when configuration is not available", async () => {
			vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
				get: vi.fn().mockReturnValue(undefined),
			} as any)

			logger = new ConversationLogger(tempDir)
			await logger.logUserMessage("Test message")

			expect(fs.appendFile).not.toHaveBeenCalled()
		})
	})

	describe("file operations", () => {
		beforeEach(() => {
			logger = new ConversationLogger(tempDir)
		})

		it("should handle file write errors gracefully", async () => {
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const writeError = new Error("File write failed")
			vi.mocked(fs.appendFile).mockRejectedValueOnce(writeError)

			await logger.logUserMessage("Test message")

			expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to write to log file:", writeError)

			consoleErrorSpy.mockRestore()
		})

		it("should create JSONL format with newlines", async () => {
			await logger.logUserMessage("First message")
			await logger.logUserMessage("Second message")

			expect(fs.appendFile).toHaveBeenCalledTimes(2)

			const firstCall = vi.mocked(fs.appendFile).mock.calls[0][1] as string
			const secondCall = vi.mocked(fs.appendFile).mock.calls[1][1] as string

			expect(firstCall.endsWith("\n")).toBe(true)
			expect(secondCall.endsWith("\n")).toBe(true)

			// Verify both are valid JSON
			expect(() => JSON.parse(firstCall.trim())).not.toThrow()
			expect(() => JSON.parse(secondCall.trim())).not.toThrow()
		})

		it("should use UTF-8 encoding for file writes", async () => {
			await logger.logUserMessage("Test message with unicode: 🚀")

			expect(fs.appendFile).toHaveBeenCalledWith(expect.any(String), expect.any(String), "utf8")
		})
	})

	describe("session management", () => {
		it("should maintain consistent session ID across multiple logs", async () => {
			logger = new ConversationLogger(tempDir)

			await logger.logUserMessage("Message 1")
			await logger.logAIResponse("Response 1")
			await logger.logToolCall("tool1", {})

			expect(fs.appendFile).toHaveBeenCalledTimes(3)

			const entries = vi.mocked(fs.appendFile).mock.calls.map((call) => JSON.parse(call[1] as string))

			const sessionIds = entries.map((entry) => entry.session_id)
			expect(sessionIds[0]).toBe(sessionIds[1])
			expect(sessionIds[1]).toBe(sessionIds[2])
		})

		it("should generate different session IDs for different logger instances", () => {
			const logger1 = new ConversationLogger(tempDir)
			const logger2 = new ConversationLogger(tempDir)

			const sessionId1 = (logger1 as any).sessionId
			const sessionId2 = (logger2 as any).sessionId

			expect(sessionId1).not.toBe(sessionId2)
		})
	})

	describe("path handling", () => {
		it("should handle Windows paths correctly", () => {
			const windowsPath = "C:\\Users\\test\\workspace"
			logger = new ConversationLogger(windowsPath)

			expect(fs.mkdir).toHaveBeenCalledWith(path.join(windowsPath, ".roo-logs"), { recursive: true })
		})

		it("should handle Unix paths correctly", () => {
			const unixPath = "/home/user/workspace"
			logger = new ConversationLogger(unixPath)

			expect(fs.mkdir).toHaveBeenCalledWith(path.join(unixPath, ".roo-logs"), { recursive: true })
		})

		it("should handle relative paths correctly", () => {
			const relativePath = "./workspace"
			logger = new ConversationLogger(relativePath)

			expect(fs.mkdir).toHaveBeenCalledWith(path.join(relativePath, ".roo-logs"), { recursive: true })
		})
	})
})
