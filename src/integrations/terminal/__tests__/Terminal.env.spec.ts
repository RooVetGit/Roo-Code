import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as vscode from "vscode"
import { Terminal } from "../Terminal"

// Mock vscode module
vi.mock("vscode", () => ({
	window: {
		createTerminal: vi.fn(),
	},
	ThemeIcon: vi.fn(),
	workspace: {
		fs: {
			createDirectory: vi.fn().mockResolvedValue(undefined),
			writeFile: vi.fn().mockResolvedValue(undefined),
		},
	},
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
	env: {
		appRoot: "/mock/app/root",
	},
}))

describe("Terminal Environment Variables", () => {
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env }

		// Set up test environment variables
		process.env.PATH = "/custom/bin:/usr/local/bin:/usr/bin:/bin"
		process.env.CUSTOM_VAR = "test_value"
		process.env.NODE_ENV = "test"
		process.env.HOME = "/home/testuser"

		// Reset Terminal static properties
		Terminal.setShellIntegrationTimeout(5000)
		Terminal.setCommandDelay(0)
		Terminal.setTerminalZshClearEolMark(true)
		Terminal.setTerminalZshOhMy(false)
		Terminal.setTerminalZshP10k(false)
		Terminal.setTerminalZdotdir(false)
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv
		vi.clearAllMocks()
	})

	describe("getEnv", () => {
		it("should inherit process environment variables", () => {
			const env = Terminal.getEnv()

			// Check that custom environment variables are inherited
			expect(env.PATH).toBe("/custom/bin:/usr/local/bin:/usr/bin:/bin")
			expect(env.CUSTOM_VAR).toBe("test_value")
			expect(env.NODE_ENV).toBe("test")
			expect(env.HOME).toBe("/home/testuser")
		})

		it("should apply Roo-specific overrides", () => {
			const env = Terminal.getEnv()

			// Check Roo-specific overrides
			expect(env.PAGER).toBe(process.platform === "win32" ? "" : "cat")
			expect(env.VTE_VERSION).toBe("0")
		})

		it("should preserve user PATH while applying overrides", () => {
			// Set a complex PATH with many directories
			process.env.PATH =
				"/home/user/.local/bin:/home/user/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

			const env = Terminal.getEnv()

			// PATH should be preserved
			expect(env.PATH).toBe(
				"/home/user/.local/bin:/home/user/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
			)
			// But Roo overrides should still be applied
			expect(env.VTE_VERSION).toBe("0")
		})

		it("should handle Oh My Zsh integration when enabled", () => {
			Terminal.setTerminalZshOhMy(true)
			const env = Terminal.getEnv()

			expect(env.ITERM_SHELL_INTEGRATION_INSTALLED).toBe("Yes")
		})

		it("should handle Powerlevel10k integration when enabled", () => {
			Terminal.setTerminalZshP10k(true)
			const env = Terminal.getEnv()

			expect(env.POWERLEVEL9K_TERM_SHELL_INTEGRATION).toBe("true")
		})

		it("should set PROMPT_COMMAND when command delay is configured", () => {
			Terminal.setCommandDelay(100)
			const env = Terminal.getEnv()

			expect(env.PROMPT_COMMAND).toBe("sleep 0.1")
		})

		it("should clear ZSH EOL mark when configured", () => {
			Terminal.setTerminalZshClearEolMark(true)
			const env = Terminal.getEnv()

			expect(env.PROMPT_EOL_MARK).toBe("")
		})

		it("should not override PROMPT_EOL_MARK when disabled", () => {
			process.env.PROMPT_EOL_MARK = "%"
			Terminal.setTerminalZshClearEolMark(false)
			const env = Terminal.getEnv()

			expect(env.PROMPT_EOL_MARK).toBe("%")
		})

		it("should handle undefined environment variables gracefully", () => {
			// Remove some environment variables
			delete process.env.PATH
			delete process.env.HOME

			const env = Terminal.getEnv()

			// Should not throw and should still have Roo overrides
			expect(env.VTE_VERSION).toBe("0")
			expect(env.PAGER).toBeDefined()
			// PATH and HOME will be undefined but that's okay
			expect(env.PATH).toBeUndefined()
			expect(env.HOME).toBeUndefined()
		})

		it("should not mutate the original process.env", () => {
			const originalPath = process.env.PATH
			const originalVTE = process.env.VTE_VERSION

			Terminal.getEnv()

			// Original process.env should remain unchanged
			expect(process.env.PATH).toBe(originalPath)
			expect(process.env.VTE_VERSION).toBe(originalVTE)
		})
	})

	describe("Terminal creation with environment", () => {
		it("should pass environment to createTerminal", () => {
			const mockCreateTerminal = vi.mocked(vscode.window.createTerminal)

			new Terminal(1, undefined, "/test/dir")

			expect(mockCreateTerminal).toHaveBeenCalledWith(
				expect.objectContaining({
					env: expect.objectContaining({
						PATH: "/custom/bin:/usr/local/bin:/usr/bin:/bin",
						CUSTOM_VAR: "test_value",
						VTE_VERSION: "0",
					}),
				}),
			)
		})
	})
})
