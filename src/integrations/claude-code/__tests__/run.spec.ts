import { describe, it, expect, vi, beforeEach } from "vitest"
import { runClaudeCode } from "../run"
import { access } from "fs/promises"
import { execa } from "execa"

// Mock dependencies
vi.mock("fs/promises")
vi.mock("execa")
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
	},
}))

const mockAccess = vi.mocked(access)
const mockExeca = vi.mocked(execa)

describe("runClaudeCode", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should successfully execute Claude CLI when binary exists and is executable", async () => {
		// Arrange
		mockAccess.mockResolvedValue(undefined)
		const mockProcess = { stdout: "test output", stderr: "" }
		mockExeca.mockResolvedValue(mockProcess as any)

		const params = {
			systemPrompt: "Test system prompt",
			messages: [{ role: "user" as const, content: "Test message" }],
			path: "/usr/local/bin/claude",
			modelId: "claude-3-sonnet-20240229",
		}

		// Act
		const result = await runClaudeCode(params)

		// Assert
		expect(mockAccess).toHaveBeenCalledWith("/usr/local/bin/claude", expect.any(Number))
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

	it("should use default 'claude' path when no path is provided", async () => {
		// Arrange
		mockAccess.mockResolvedValue(undefined)
		const mockProcess = { stdout: "test output", stderr: "" }
		mockExeca.mockResolvedValue(mockProcess as any)

		const params = {
			systemPrompt: "Test system prompt",
			messages: [{ role: "user" as const, content: "Test message" }],
		}

		// Act
		await runClaudeCode(params)

		// Assert
		expect(mockAccess).toHaveBeenCalledWith("claude", expect.any(Number))
		expect(mockExeca).toHaveBeenCalledWith("claude", expect.any(Array), expect.any(Object))
	})

	it("should throw error when Claude CLI binary does not exist", async () => {
		// Arrange
		mockAccess.mockRejectedValue(new Error("ENOENT: no such file or directory"))

		const params = {
			systemPrompt: "Test system prompt",
			messages: [{ role: "user" as const, content: "Test message" }],
			path: "/nonexistent/claude",
		}

		// Act & Assert
		await expect(runClaudeCode(params)).rejects.toThrow(
			"Claude Code CLI not found or not executable at: /nonexistent/claude",
		)
		expect(mockExeca).not.toHaveBeenCalled()
	})

	it("should throw error when Claude CLI binary is not executable", async () => {
		// Arrange
		mockAccess.mockRejectedValue(new Error("EACCES: permission denied"))

		const params = {
			systemPrompt: "Test system prompt",
			messages: [{ role: "user" as const, content: "Test message" }],
			path: "/usr/bin/claude",
		}

		// Act & Assert
		await expect(runClaudeCode(params)).rejects.toThrow(
			"Claude Code CLI not found or not executable at: /usr/bin/claude",
		)
		expect(mockExeca).not.toHaveBeenCalled()
	})

	it("should throw error when execa fails to execute", async () => {
		// Arrange
		mockAccess.mockResolvedValue(undefined)
		mockExeca.mockRejectedValue(new Error("spawn ENOENT"))

		const params = {
			systemPrompt: "Test system prompt",
			messages: [{ role: "user" as const, content: "Test message" }],
			path: "/usr/bin/claude",
		}

		// Act & Assert
		await expect(runClaudeCode(params)).rejects.toThrow("Failed to execute Claude Code CLI at '/usr/bin/claude'")
	})

	it("should not include model argument when modelId is not provided", async () => {
		// Arrange
		mockAccess.mockResolvedValue(undefined)
		const mockProcess = { stdout: "test output", stderr: "" }
		mockExeca.mockResolvedValue(mockProcess as any)

		const params = {
			systemPrompt: "Test system prompt",
			messages: [{ role: "user" as const, content: "Test message" }],
		}

		// Act
		await runClaudeCode(params)

		// Assert
		const execaCall = mockExeca.mock.calls[0]
		const args = execaCall[1]
		expect(args).not.toContain("--model")
	})
})
