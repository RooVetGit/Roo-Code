//
// Tests the ExecuteCommand tool itself vs calling the tool where the tool is mocked.
//
import * as path from "path"
import * as fs from "fs/promises"

import { ExecuteCommandOptions } from "../executeCommandTool"
import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"
import { Terminal } from "../../../integrations/terminal/Terminal"
import { ExecaTerminal } from "../../../integrations/terminal/ExecaTerminal"
import type { RooTerminalCallbacks } from "../../../integrations/terminal/types"

// Mock fs to control directory existence checks
vitest.mock("fs/promises")

// Mock TerminalRegistry to control terminal creation
vitest.mock("../../../integrations/terminal/TerminalRegistry")

// Mock Terminal and ExecaTerminal classes
vitest.mock("../../../integrations/terminal/Terminal")
vitest.mock("../../../integrations/terminal/ExecaTerminal")

// Import the actual executeCommand function (not mocked)
import { executeCommand } from "../executeCommandTool"

// Tests for the executeCommand function
describe("executeCommand", () => {
	let mockTask: any
	let mockTerminal: any
	let mockProcess: any
	let mockProvider: any

	beforeEach(() => {
		vitest.clearAllMocks()

		// Mock fs.access to simulate directory existence
		;(fs.access as any).mockResolvedValue(undefined)

		// Create mock provider
		mockProvider = {
			postMessageToWebview: vitest.fn(),
			getState: vitest.fn().mockResolvedValue({
				terminalOutputLineLimit: 500,
				terminalShellIntegrationDisabled: false,
			}),
		}

		// Create mock task
		mockTask = {
			cwd: "/test/project",
			taskId: "test-task-123",
			providerRef: {
				deref: vitest.fn().mockResolvedValue(mockProvider),
			},
			say: vitest.fn().mockResolvedValue(undefined),
			terminalProcess: undefined,
			emit: vitest.fn(),
		}

		// Create mock process that resolves immediately
		mockProcess = Promise.resolve()
		mockProcess.continue = vitest.fn()

		// Create mock terminal with getCurrentWorkingDirectory method
		mockTerminal = {
			provider: "vscode",
			id: 1,
			initialCwd: "/test/project",
			getCurrentWorkingDirectory: vitest.fn().mockReturnValue("/test/project"),
			runCommand: vitest.fn().mockReturnValue(mockProcess),
			terminal: {
				show: vitest.fn(),
			},
		}

		// Mock TerminalRegistry.getOrCreateTerminal
		;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockTerminal)
	})

	describe("Working Directory Behavior", () => {
		it("should use terminal.getCurrentWorkingDirectory() in the output message for completed commands", async () => {
			// Setup: Mock terminal to return a different current working directory
			const initialCwd = "/test/project"
			const currentCwd = "/test/project/subdirectory"

			mockTask.cwd = initialCwd
			mockTerminal.initialCwd = initialCwd
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue(currentCwd)

			// Mock the terminal process to complete successfully
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				// Simulate command completion
				setTimeout(() => {
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(mockTerminal.getCurrentWorkingDirectory).toHaveBeenCalled()
			expect(result).toContain(`within working directory '${currentCwd}'`)
			expect(result).not.toContain(`within working directory '${initialCwd}'`)
		})

		it("should use terminal.getCurrentWorkingDirectory() for VSCode Terminal with shell integration", async () => {
			// Setup: Mock VSCode Terminal instance
			const vscodeTerminal = new Terminal(1, undefined, "/test/project")
			const mockVSCodeTerminal = vscodeTerminal as any

			// Mock shell integration providing different cwd
			mockVSCodeTerminal.terminal = {
				show: vitest.fn(),
				shellIntegration: {
					cwd: { fsPath: "/test/project/changed-dir" },
				},
			}
			mockVSCodeTerminal.getCurrentWorkingDirectory = vitest.fn().mockReturnValue("/test/project/changed-dir")
			mockVSCodeTerminal.runCommand = vitest
				.fn()
				.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
					setTimeout(() => {
						callbacks.onCompleted("Command output", mockProcess)
						callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
					}, 0)
					return mockProcess
				})
			;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockVSCodeTerminal)

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toContain("within working directory '/test/project/changed-dir'")
		})

		it("should use terminal.getCurrentWorkingDirectory() for ExecaTerminal (always returns initialCwd)", async () => {
			// Setup: Mock ExecaTerminal instance
			const execaTerminal = new ExecaTerminal(1, "/test/project")
			const mockExecaTerminal = execaTerminal as any

			// ExecaTerminal always returns initialCwd
			mockExecaTerminal.getCurrentWorkingDirectory = vitest.fn().mockReturnValue("/test/project")
			mockExecaTerminal.runCommand = vitest
				.fn()
				.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
					setTimeout(() => {
						callbacks.onCompleted("Command output", mockProcess)
						callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
					}, 0)
					return mockProcess
				})
			;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockExecaTerminal)

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: true, // Forces ExecaTerminal
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(mockExecaTerminal.getCurrentWorkingDirectory).toHaveBeenCalled()
			expect(result).toContain("within working directory '/test/project'")
		})
	})

	describe("Custom Working Directory", () => {
		it("should handle absolute custom cwd and use terminal.getCurrentWorkingDirectory() in output", async () => {
			const customCwd = "/custom/absolute/path"

			mockTerminal.getCurrentWorkingDirectory.mockReturnValue(customCwd)
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				customCwd,
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(customCwd, mockTask.taskId, "vscode")
			expect(result).toContain(`within working directory '${customCwd}'`)
		})

		it("should handle relative custom cwd and use terminal.getCurrentWorkingDirectory() in output", async () => {
			const relativeCwd = "subdirectory"
			const resolvedCwd = path.resolve(mockTask.cwd, relativeCwd)

			mockTerminal.getCurrentWorkingDirectory.mockReturnValue(resolvedCwd)
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				customCwd: relativeCwd,
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(resolvedCwd, mockTask.taskId, "vscode")
			expect(result).toContain(`within working directory '${resolvedCwd.toPosix()}'`)
		})

		it("should return error when custom working directory does not exist", async () => {
			const nonExistentCwd = "/non/existent/path"

			// Mock fs.access to throw error for non-existent directory
			;(fs.access as any).mockRejectedValue(new Error("Directory does not exist"))

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				customCwd: nonExistentCwd,
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toBe(`Working directory '${nonExistentCwd}' does not exist.`)
			expect(TerminalRegistry.getOrCreateTerminal).not.toHaveBeenCalled()
		})
	})

	describe("Terminal Provider Selection", () => {
		it("should use vscode provider when shell integration is enabled", async () => {
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			await executeCommand(mockTask, options)

			// Verify
			expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(mockTask.cwd, mockTask.taskId, "vscode")
		})

		it("should use execa provider when shell integration is disabled", async () => {
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: true,
				terminalOutputLineLimit: 500,
			}

			// Execute
			await executeCommand(mockTask, options)

			// Verify
			expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(mockTask.cwd, mockTask.taskId, "execa")
		})
	})

	describe("Command Execution States", () => {
		it("should handle completed command with exit code 0", async () => {
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue("/test/project")
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command completed successfully", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo success",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toContain("Exit code: 0")
			expect(result).toContain("within working directory '/test/project'")
		})

		it("should handle completed command with non-zero exit code", async () => {
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue("/test/project")
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command failed", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 1 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "exit 1",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toContain("Command execution was not successful")
			expect(result).toContain("Exit code: 1")
			expect(result).toContain("within working directory '/test/project'")
		})

		it("should handle command terminated by signal", async () => {
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue("/test/project")
			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onCompleted("Command interrupted", mockProcess)
					callbacks.onShellExecutionComplete(
						{
							exitCode: undefined,
							signalName: "SIGINT",
							coreDumpPossible: false,
						},
						mockProcess,
					)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "long-running-command",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toContain("Process terminated by signal SIGINT")
			expect(result).toContain("within working directory '/test/project'")
		})
	})

	describe("Terminal Working Directory Updates", () => {
		it("should update working directory when terminal returns different cwd", async () => {
			// Setup: Terminal initially at project root, but getCurrentWorkingDirectory returns different path
			const initialCwd = "/test/project"
			const updatedCwd = "/test/project/src"

			mockTask.cwd = initialCwd
			mockTerminal.initialCwd = initialCwd

			// Mock Terminal instance behavior
			const mockTerminalInstance = {
				...mockTerminal,
				terminal: { show: vitest.fn() },
				getCurrentWorkingDirectory: vitest.fn().mockReturnValue(updatedCwd),
				runCommand: vitest.fn().mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
					setTimeout(() => {
						callbacks.onCompleted("Directory changed", mockProcess)
						callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
					}, 0)
					return mockProcess
				}),
			}

			;(TerminalRegistry.getOrCreateTerminal as any).mockResolvedValue(mockTerminalInstance)

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "cd src && pwd",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify the result uses the updated working directory
			expect(rejected).toBe(false)
			expect(result).toContain(`within working directory '${updatedCwd}'`)
			expect(result).not.toContain(`within working directory '${initialCwd}'`)

			// Verify the terminal's getCurrentWorkingDirectory was called
			expect(mockTerminalInstance.getCurrentWorkingDirectory).toHaveBeenCalled()
		})
	})

	describe("taskCommandExecuted Event", () => {
		it("should emit taskCommandExecuted event when command completes successfully", async () => {
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue("/test/project")

			// We need to mock Terminal.compressTerminalOutput since that's what sets the result
			const mockCompressTerminalOutput = vitest.spyOn(Terminal, "compressTerminalOutput")
			mockCompressTerminalOutput.mockReturnValue("Command output")

			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				// Simulate async callback execution
				setTimeout(() => {
					callbacks.onShellExecutionStarted(1234, mockProcess)
					callbacks.onCompleted("Command output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 0 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "echo test",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(mockTask.emit).toHaveBeenCalledWith("taskCommandExecuted", mockTask.taskId, {
				command: "echo test",
				exitCode: 0,
				output: "Command output",
				succeeded: true,
				failureReason: undefined,
			})

			mockCompressTerminalOutput.mockRestore()
		})

		it("should emit taskCommandExecuted event when command fails with non-zero exit code", async () => {
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue("/test/project")

			const mockCompressTerminalOutput = vitest.spyOn(Terminal, "compressTerminalOutput")
			mockCompressTerminalOutput.mockReturnValue("Error output")

			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onShellExecutionStarted(1234, mockProcess)
					callbacks.onCompleted("Error output", mockProcess)
					callbacks.onShellExecutionComplete({ exitCode: 1 }, mockProcess)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "exit 1",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(mockTask.emit).toHaveBeenCalledWith("taskCommandExecuted", mockTask.taskId, {
				command: "exit 1",
				exitCode: 1,
				output: "Error output",
				succeeded: false,
				failureReason: expect.stringContaining("Command execution was not successful"),
			})

			mockCompressTerminalOutput.mockRestore()
		})

		it("should emit taskCommandExecuted event when command is terminated by signal", async () => {
			mockTerminal.getCurrentWorkingDirectory.mockReturnValue("/test/project")

			const mockCompressTerminalOutput = vitest.spyOn(Terminal, "compressTerminalOutput")
			mockCompressTerminalOutput.mockReturnValue("Interrupted output")

			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				setTimeout(() => {
					callbacks.onShellExecutionStarted(1234, mockProcess)
					callbacks.onCompleted("Interrupted output", mockProcess)
					callbacks.onShellExecutionComplete(
						{
							exitCode: undefined,
							signalName: "SIGTERM",
							coreDumpPossible: false,
						},
						mockProcess,
					)
				}, 0)
				return mockProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "long-running-command",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(mockTask.emit).toHaveBeenCalledWith("taskCommandExecuted", mockTask.taskId, {
				command: "long-running-command",
				exitCode: undefined,
				output: "Interrupted output",
				succeeded: false,
				failureReason: expect.stringContaining("Process terminated by signal SIGTERM"),
			})

			mockCompressTerminalOutput.mockRestore()
		})

		it("should emit taskCommandExecuted event when command times out", async () => {
			// Mock the terminal process to not complete before timeout
			let timeoutId: NodeJS.Timeout
			const neverEndingProcess = new Promise<void>((resolve) => {
				timeoutId = setTimeout(resolve, 10000) // Would resolve after 10 seconds
			})
			Object.assign(neverEndingProcess, {
				continue: vitest.fn(),
				abort: vitest.fn(() => {
					clearTimeout(timeoutId)
				}),
			})

			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				callbacks.onLine("Partial output", neverEndingProcess as any)
				return neverEndingProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "sleep 100",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
				commandExecutionTimeout: 100, // 100ms timeout
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(false)
			expect(result).toContain("terminated after exceeding")
			expect(mockTask.emit).toHaveBeenCalledWith("taskCommandExecuted", mockTask.taskId, {
				command: "sleep 100",
				exitCode: undefined,
				output: "Partial output",
				succeeded: false,
				failureReason: "Command timed out after 0.1s",
			})
		})

		it("should emit taskCommandExecuted event when user provides feedback while command is running", async () => {
			// Mock the ask function to simulate user feedback
			mockTask.ask = vitest.fn().mockResolvedValue({
				response: "messageResponse",
				text: "Please stop the command",
				images: [],
			})

			// Mock a long-running command
			let commandResolve: () => void
			const longRunningProcess = new Promise<void>((resolve) => {
				commandResolve = resolve
			})
			Object.assign(longRunningProcess, {
				continue: vitest.fn(() => {
					// Simulate command continuing after feedback
					setTimeout(() => commandResolve(), 10)
				}),
			})

			mockTerminal.runCommand.mockImplementation((command: string, callbacks: RooTerminalCallbacks) => {
				// Simulate output that triggers user interaction
				callbacks.onLine("Command is running...\n", longRunningProcess as any)
				return longRunningProcess
			})

			const options: ExecuteCommandOptions = {
				executionId: "test-123",
				command: "npm install",
				terminalShellIntegrationDisabled: false,
				terminalOutputLineLimit: 500,
			}

			// Execute
			const [rejected, result] = await executeCommand(mockTask, options)

			// Verify
			expect(rejected).toBe(true) // User feedback causes rejection
			expect(mockTask.emit).toHaveBeenCalledWith("taskCommandExecuted", mockTask.taskId, {
				command: "npm install",
				exitCode: undefined,
				output: "Command is running...\n",
				succeeded: false,
				failureReason: "Command is still running (user provided feedback)",
			})
		})
	})
})
