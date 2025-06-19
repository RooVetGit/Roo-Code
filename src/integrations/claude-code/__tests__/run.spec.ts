import { describe, it, expect, vi, beforeEach } from "vitest"
import { runClaudeCode } from "../run"
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
})
