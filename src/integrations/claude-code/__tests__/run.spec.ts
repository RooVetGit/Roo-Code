import { describe, it, expect, vi, beforeEach } from "vitest"
import { runClaudeCode, SessionManager } from "../run"
import { execa } from "execa"

// Mock dependencies
vi.mock("execa")
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
	},
}))

const mockExeca = vi.mocked(execa)

describe("runClaudeCode", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		SessionManager.clearAllSessions()
	})

	it("should successfully execute Claude CLI when binary exists and is executable", () => {
		// Arrange
		const mockProcess = { stdout: "test output", stderr: "" }
		mockExeca.mockReturnValue(mockProcess as any)

		const params = {
			systemPrompt: "Test system prompt",
			messages: [{ role: "user" as const, content: "Test message" }],
			path: "/usr/local/bin/claude",
			modelId: "claude-3-sonnet-20240229",
		}

		// Act
		const result = runClaudeCode(params)

		// Assert
		expect(mockExeca).toHaveBeenCalledWith(
			"/usr/local/bin/claude",
			expect.arrayContaining([
				"-p",
				JSON.stringify(params.messages),
				"--system-prompt",
				params.systemPrompt,
				"--verbose",
				"--output-format",
				"stream-json",
				"--max-turns",
				"1",
				"--session-id",
				expect.any(String),
				"--model",
				params.modelId,
			]),
			expect.objectContaining({
				stdin: "ignore",
				stdout: "pipe",
				stderr: "pipe",
				env: process.env,
				cwd: "/test/workspace",
			}),
		)
		expect(result).toBe(mockProcess)
	})

	it("should use default 'claude' path when no path is provided", () => {
		// Arrange
		const mockProcess = { stdout: "test output", stderr: "" }
		mockExeca.mockReturnValue(mockProcess as any)

		const params = {
			systemPrompt: "Test system prompt",
			messages: [{ role: "user" as const, content: "Test message" }],
		}

		// Act
		runClaudeCode(params)

		// Assert
		expect(mockExeca).toHaveBeenCalledWith("claude", expect.any(Array), expect.any(Object))
	})

	it("should throw error when execa fails to execute", () => {
		// Arrange
		mockExeca.mockImplementation(() => {
			throw new Error("spawn ENOENT")
		})

		const params = {
			systemPrompt: "Test system prompt",
			messages: [{ role: "user" as const, content: "Test message" }],
			path: "/usr/bin/claude",
		}

		// Act & Assert
		expect(() => runClaudeCode(params)).toThrow("Failed to execute Claude Code CLI at '/usr/bin/claude'")
	})

	it("should not include model argument when modelId is not provided", () => {
		// Arrange
		const mockProcess = { stdout: "test output", stderr: "" }
		mockExeca.mockReturnValue(mockProcess as any)

		const params = {
			systemPrompt: "Test system prompt",
			messages: [{ role: "user" as const, content: "Test message" }],
		}

		// Act
		runClaudeCode(params)

		// Assert
		const execaCall = mockExeca.mock.calls[0]
		const args = execaCall[1]
		expect(args).not.toContain("--model")
		expect(args).toContain("--session-id")
	})

	describe("Security validation", () => {
		it("should reject messages with ANSI escape sequences", () => {
			// Arrange
			const params = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Hello \x1b[31mred text\x1b[0m" }],
			}

			// Act & Assert
			expect(() => runClaudeCode(params)).toThrow(
				/Message content contains potentially dangerous shell sequences/,
			)
		})

		it("should reject messages with command substitution", () => {
			// Arrange
			const params = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Hello $(rm -rf /)" }],
			}

			// Act & Assert
			expect(() => runClaudeCode(params)).toThrow(
				/Message content contains potentially dangerous shell sequences/,
			)
		})

		it("should reject messages with backticks", () => {
			// Arrange
			const params = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Hello `whoami`" }],
			}

			// Act & Assert
			expect(() => runClaudeCode(params)).toThrow(
				/Message content contains potentially dangerous shell sequences/,
			)
		})

		it("should reject messages with command chaining", () => {
			// Arrange
			const params = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Hello && rm -rf /" }],
			}

			// Act & Assert
			expect(() => runClaudeCode(params)).toThrow(
				/Message content contains potentially dangerous shell sequences/,
			)
		})

		it("should reject messages with logical OR chaining", () => {
			// Arrange
			const params = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Hello || rm -rf /" }],
			}

			// Act & Assert
			expect(() => runClaudeCode(params)).toThrow(
				/Message content contains potentially dangerous shell sequences/,
			)
		})

		it("should reject messages with command separators", () => {
			// Arrange
			const params = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Hello; rm -rf /" }],
			}

			// Act & Assert
			expect(() => runClaudeCode(params)).toThrow(
				/Message content contains potentially dangerous shell sequences/,
			)
		})

		it("should handle complex message content with text blocks", () => {
			// Arrange
			const mockProcess = { stdout: "test output", stderr: "" }
			mockExeca.mockReturnValue(mockProcess as any)

			const params = {
				systemPrompt: "Test system prompt",
				messages: [
					{
						role: "user" as const,
						content: [
							{
								type: "text" as const,
								text: "This is safe content",
							},
						],
					},
				],
			}

			// Act
			const result = runClaudeCode(params)

			// Assert
			expect(mockExeca).toHaveBeenCalled()
			expect(result).toBe(mockProcess)
		})

		it("should reject complex message content with dangerous text blocks", () => {
			// Arrange
			const params = {
				systemPrompt: "Test system prompt",
				messages: [
					{
						role: "user" as const,
						content: [
							{
								type: "text" as const,
								text: "Safe content",
							},
							{
								type: "text" as const,
								text: "Dangerous $(rm -rf /) content",
							},
						],
					},
				],
			}

			// Act & Assert
			expect(() => runClaudeCode(params)).toThrow(
				/Message content contains potentially dangerous shell sequences/,
			)
		})
	})

	describe("SessionManager", () => {
		it("should generate consistent session IDs for the same workspace", () => {
			// Arrange
			const workspacePath = "/test/workspace"

			// Act
			const sessionId1 = SessionManager.getSessionId(workspacePath)
			const sessionId2 = SessionManager.getSessionId(workspacePath)

			// Assert
			expect(sessionId1).toBe(sessionId2)
			expect(sessionId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
		})

		it("should generate different session IDs for different workspaces", () => {
			// Arrange
			const workspace1 = "/test/workspace1"
			const workspace2 = "/test/workspace2"

			// Act
			const sessionId1 = SessionManager.getSessionId(workspace1)
			const sessionId2 = SessionManager.getSessionId(workspace2)

			// Assert
			expect(sessionId1).not.toBe(sessionId2)
		})

		it("should use 'default' key when no workspace path is provided", () => {
			// Act
			const sessionId1 = SessionManager.getSessionId()
			const sessionId2 = SessionManager.getSessionId(undefined)

			// Assert
			expect(sessionId1).toBe(sessionId2)
		})

		it("should clear session for specific workspace", () => {
			// Arrange
			const workspacePath = "/test/workspace"
			const originalSessionId = SessionManager.getSessionId(workspacePath)

			// Act
			SessionManager.clearSession(workspacePath)
			const newSessionId = SessionManager.getSessionId(workspacePath)

			// Assert
			expect(originalSessionId).not.toBe(newSessionId)
		})

		it("should clear all sessions", () => {
			// Arrange
			const workspace1 = "/test/workspace1"
			const workspace2 = "/test/workspace2"
			const originalSessionId1 = SessionManager.getSessionId(workspace1)
			const originalSessionId2 = SessionManager.getSessionId(workspace2)

			// Act
			SessionManager.clearAllSessions()
			const newSessionId1 = SessionManager.getSessionId(workspace1)
			const newSessionId2 = SessionManager.getSessionId(workspace2)

			// Assert
			expect(originalSessionId1).not.toBe(newSessionId1)
			expect(originalSessionId2).not.toBe(newSessionId2)
		})
	})

	describe("Session integration", () => {
		it("should include session ID in Claude CLI arguments", () => {
			// Arrange
			const mockProcess = { stdout: "test output", stderr: "" }
			mockExeca.mockReturnValue(mockProcess as any)

			const params = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Test message" }],
			}

			// Act
			runClaudeCode(params)

			// Assert
			const execaCall = mockExeca.mock.calls[0]
			expect(execaCall).toBeDefined()
			expect(execaCall[1]).toBeDefined()
			const args = execaCall[1] as string[]
			const sessionIdIndex = args.indexOf("--session-id")
			expect(sessionIdIndex).toBeGreaterThan(-1)
			expect(args[sessionIdIndex + 1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
		})

		it("should use the same session ID for multiple calls from the same workspace", () => {
			// Arrange
			const mockProcess = { stdout: "test output", stderr: "" }
			mockExeca.mockReturnValue(mockProcess as any)

			const params = {
				systemPrompt: "Test system prompt",
				messages: [{ role: "user" as const, content: "Test message" }],
			}

			// Act
			runClaudeCode(params)
			runClaudeCode(params)

			// Assert
			const firstCall = mockExeca.mock.calls[0]
			const secondCall = mockExeca.mock.calls[1]

			expect(firstCall).toBeDefined()
			expect(firstCall[1]).toBeDefined()
			expect(secondCall).toBeDefined()
			expect(secondCall[1]).toBeDefined()

			const firstArgs = firstCall[1] as string[]
			const secondArgs = secondCall[1] as string[]

			const firstSessionIdIndex = firstArgs.indexOf("--session-id")
			const secondSessionIdIndex = secondArgs.indexOf("--session-id")

			const firstSessionId = firstArgs[firstSessionIdIndex + 1]
			const secondSessionId = secondArgs[secondSessionIdIndex + 1]

			expect(firstSessionId).toBe(secondSessionId)
		})
	})
})
