// Integration tests for command execution timeout functionality
// npx vitest run src/core/tools/__tests__/executeCommandTimeout.integration.spec.ts

import * as vscode from "vscode"
import * as fs from "fs/promises"
import { executeCommand, ExecuteCommandOptions } from "../executeCommandTool"
import { Task } from "../../task/Task"
import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"

// Mock dependencies
vitest.mock("vscode", () => ({
	workspace: {
		getConfiguration: vitest.fn(),
	},
}))

vitest.mock("fs/promises")
vitest.mock("../../../integrations/terminal/TerminalRegistry")
vitest.mock("../../task/Task")

describe("Command Execution Timeout Integration", () => {
	let mockTask: any
	let mockTerminal: any
	let mockProcess: any

	beforeEach(() => {
		vitest.clearAllMocks()

		// Mock fs.access to resolve successfully for working directory
		;(fs.access as any).mockResolvedValue(undefined)

		// Mock task
		mockTask = {
			cwd: "/test/directory",
			terminalProcess: undefined,
			providerRef: {
				deref: vitest.fn().mockResolvedValue({
					postMessageToWebview: vitest.fn(),
				}),
			},
			say: vitest.fn().mockResolvedValue(undefined),
		}

		// Mock terminal process
		mockProcess = {
			abort: vitest.fn(),
			then: vitest.fn(),
			catch: vitest.fn(),
		}

		// Mock terminal
		mockTerminal = {
			runCommand: vitest.fn().mockReturnValue(mockProcess),
			getCurrentWorkingDirectory: vitest.fn().mockReturnValue("/test/directory"),
		}

		// Mock TerminalRegistry
		;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockTerminal)

		// Mock VSCode configuration
		const mockGetConfiguration = vitest.fn().mockReturnValue({
			get: vitest.fn().mockReturnValue(0), // Default 0 (no timeout)
		})
		;(vscode.workspace.getConfiguration as any).mockReturnValue(mockGetConfiguration())
	})

	it("should pass timeout configuration to executeCommand", async () => {
		const customTimeoutMs = 15000 // 15 seconds in milliseconds
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "echo test",
			commandExecutionTimeout: customTimeoutMs,
		}

		// Mock a quick-completing process
		const quickProcess = Promise.resolve()
		mockTerminal.runCommand.mockReturnValue(quickProcess)

		await executeCommand(mockTask as Task, options)

		// Verify that the terminal was called with the command
		expect(mockTerminal.runCommand).toHaveBeenCalledWith("echo test", expect.any(Object))
	})

	it("should handle timeout scenario", async () => {
		const shortTimeoutMs = 100 // Very short timeout in milliseconds
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "sleep 10",
			commandExecutionTimeout: shortTimeoutMs,
		}

		// Create a process that never resolves but has an abort method
		const longRunningProcess = new Promise(() => {
			// Never resolves to simulate a hanging command
		})

		// Add abort method to the promise
		;(longRunningProcess as any).abort = vitest.fn()

		mockTerminal.runCommand.mockReturnValue(longRunningProcess)

		// Execute with timeout
		const result = await executeCommand(mockTask as Task, options)

		// Should return timeout error
		expect(result[0]).toBe(false) // Not rejected by user
		expect(result[1]).toContain("terminated after exceeding")
		expect(result[1]).toContain("0.1s") // Should show seconds in error message
	}, 10000) // Increase test timeout to 10 seconds

	it("should abort process on timeout", async () => {
		const shortTimeoutMs = 50 // Short timeout in milliseconds
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "sleep 10",
			commandExecutionTimeout: shortTimeoutMs,
		}

		// Create a process that can be aborted
		const abortSpy = vitest.fn()

		// Mock the process to never resolve but be abortable
		const neverResolvingPromise = new Promise(() => {})
		;(neverResolvingPromise as any).abort = abortSpy

		mockTerminal.runCommand.mockReturnValue(neverResolvingPromise)

		await executeCommand(mockTask as Task, options)

		// Verify abort was called
		expect(abortSpy).toHaveBeenCalled()
	}, 5000) // Increase test timeout to 5 seconds

	it("should clean up timeout on successful completion", async () => {
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "echo test",
			commandExecutionTimeout: 5000,
		}

		// Mock a process that completes quickly
		const quickProcess = Promise.resolve()
		mockTerminal.runCommand.mockReturnValue(quickProcess)

		const result = await executeCommand(mockTask as Task, options)

		// Should complete successfully without timeout
		expect(result[0]).toBe(false) // Not rejected
		expect(result[1]).not.toContain("terminated after exceeding")
	})

	it("should use default timeout when not specified (0 = no timeout)", async () => {
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "echo test",
			// commandExecutionTimeout not specified, should use default (0)
		}

		const quickProcess = Promise.resolve()
		mockTerminal.runCommand.mockReturnValue(quickProcess)

		await executeCommand(mockTask as Task, options)

		// Should complete without issues using default (no timeout)
		expect(mockTerminal.runCommand).toHaveBeenCalled()
	})

	it("should not timeout when commandExecutionTimeout is 0", async () => {
		const options: ExecuteCommandOptions = {
			executionId: "test-execution",
			command: "sleep 10",
			commandExecutionTimeout: 0, // No timeout
		}

		// Create a process that resolves after a delay to simulate a long-running command
		const longRunningProcess = new Promise((resolve) => {
			setTimeout(resolve, 200) // 200ms delay
		})

		mockTerminal.runCommand.mockReturnValue(longRunningProcess)

		const result = await executeCommand(mockTask as Task, options)

		// Should complete successfully without timeout
		expect(result[0]).toBe(false) // Not rejected
		expect(result[1]).not.toContain("terminated after exceeding")
	})

	describe("Command Timeout Allowlist", () => {
		beforeEach(() => {
			// Reset mocks for allowlist tests
			vitest.clearAllMocks()
			;(fs.access as any).mockResolvedValue(undefined)
			;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockTerminal)
		})

		it("should skip timeout for commands in allowlist", async () => {
			// Mock VSCode configuration with timeout and allowlist
			const mockGetConfiguration = vitest.fn().mockReturnValue({
				get: vitest.fn().mockImplementation((key: string) => {
					if (key === "commandExecutionTimeout") return 1 // 1 second timeout
					if (key === "commandTimeoutAllowlist") return ["npm", "git"]
					return undefined
				}),
			})
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockGetConfiguration())

			const options: ExecuteCommandOptions = {
				executionId: "test-execution",
				command: "npm install",
				// Should be overridden to 0 due to allowlist
			}

			// Create a process that would timeout if not allowlisted
			const longRunningProcess = new Promise((resolve) => {
				setTimeout(resolve, 2000) // 2 seconds, longer than 1 second timeout
			})
			mockTerminal.runCommand.mockReturnValue(longRunningProcess)

			const result = await executeCommand(mockTask as Task, options)

			// Should complete successfully without timeout because "npm" is in allowlist
			expect(result[0]).toBe(false) // Not rejected
			expect(result[1]).not.toContain("terminated after exceeding")
		}, 3000)

		it("should apply timeout for commands not in allowlist", async () => {
			// Mock VSCode configuration with timeout and allowlist
			const mockGetConfiguration = vitest.fn().mockReturnValue({
				get: vitest.fn().mockImplementation((key: string) => {
					if (key === "commandExecutionTimeout") return 1 // 1 second timeout
					if (key === "commandTimeoutAllowlist") return ["npm", "git"]
					return undefined
				}),
			})
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockGetConfiguration())

			const options: ExecuteCommandOptions = {
				executionId: "test-execution",
				command: "sleep 10", // Not in allowlist
			}

			// Create a process that never resolves
			const neverResolvingProcess = new Promise(() => {})
			;(neverResolvingProcess as any).abort = vitest.fn()
			mockTerminal.runCommand.mockReturnValue(neverResolvingProcess)

			const result = await executeCommand(mockTask as Task, options)

			// Should timeout because "sleep" is not in allowlist
			expect(result[0]).toBe(false) // Not rejected by user
			expect(result[1]).toContain("terminated after exceeding")
		}, 3000)

		it("should handle empty allowlist", async () => {
			// Mock VSCode configuration with timeout and empty allowlist
			const mockGetConfiguration = vitest.fn().mockReturnValue({
				get: vitest.fn().mockImplementation((key: string) => {
					if (key === "commandExecutionTimeout") return 1 // 1 second timeout
					if (key === "commandTimeoutAllowlist") return []
					return undefined
				}),
			})
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockGetConfiguration())

			const options: ExecuteCommandOptions = {
				executionId: "test-execution",
				command: "npm install",
			}

			// Create a process that never resolves
			const neverResolvingProcess = new Promise(() => {})
			;(neverResolvingProcess as any).abort = vitest.fn()
			mockTerminal.runCommand.mockReturnValue(neverResolvingProcess)

			const result = await executeCommand(mockTask as Task, options)

			// Should timeout because allowlist is empty
			expect(result[0]).toBe(false) // Not rejected by user
			expect(result[1]).toContain("terminated after exceeding")
		}, 3000)

		it("should match command prefixes correctly", async () => {
			// Mock VSCode configuration with timeout and allowlist
			const mockGetConfiguration = vitest.fn().mockReturnValue({
				get: vitest.fn().mockImplementation((key: string) => {
					if (key === "commandExecutionTimeout") return 1 // 1 second timeout
					if (key === "commandTimeoutAllowlist") return ["git log", "npm run"]
					return undefined
				}),
			})
			;(vscode.workspace.getConfiguration as any).mockReturnValue(mockGetConfiguration())

			// Test exact prefix match
			const options1: ExecuteCommandOptions = {
				executionId: "test-execution-1",
				command: "git log --oneline",
			}

			// Test partial prefix match (should not match)
			const options2: ExecuteCommandOptions = {
				executionId: "test-execution-2",
				command: "git status", // "git" alone is not in allowlist, only "git log"
			}

			const longRunningProcess = new Promise((resolve) => {
				setTimeout(resolve, 2000) // 2 seconds
			})
			const neverResolvingProcess = new Promise(() => {})
			;(neverResolvingProcess as any).abort = vitest.fn()

			// First command should not timeout (matches "git log" prefix)
			mockTerminal.runCommand.mockReturnValueOnce(longRunningProcess)
			const result1 = await executeCommand(mockTask as Task, options1)
			expect(result1[1]).not.toContain("terminated after exceeding")

			// Second command should timeout (doesn't match any prefix exactly)
			mockTerminal.runCommand.mockReturnValueOnce(neverResolvingProcess)
			const result2 = await executeCommand(mockTask as Task, options2)
			expect(result2[1]).toContain("terminated after exceeding")
		}, 5000)
	})
})
