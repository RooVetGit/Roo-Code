// npx jest src/integrations/terminal/__tests__/TerminalRegistry.test.ts

import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"
import * as vscode from "vscode"

const PAGER = process.platform === "win32" ? "" : "cat"

// Mock vscode.window.createTerminal
const mockCreateTerminal = jest.fn()

jest.mock("vscode", () => ({
	window: {
		createTerminal: (...args: any[]) => {
			mockCreateTerminal(...args)
			return {
				exitStatus: undefined,
			}
		},
		onDidCloseTerminal: jest.fn().mockReturnValue({ dispose: jest.fn() }),
	},
	ThemeIcon: jest.fn(),
}))

jest.mock("execa", () => ({
	execa: jest.fn(),
}))

describe("TerminalRegistry", () => {
	beforeEach(() => {
		mockCreateTerminal.mockClear()
	})

	describe("createTerminal", () => {
		it("creates terminal with PAGER set appropriately for platform", () => {
			TerminalRegistry.createTerminal("/test/path", "vscode")

			expect(mockCreateTerminal).toHaveBeenCalledWith({
				cwd: "/test/path",
				name: "Roo Code",
				iconPath: expect.any(Object),
				env: {
					PAGER,
					VTE_VERSION: "0",
					PROMPT_EOL_MARK: "",
				},
			})
		})

		it("adds PROMPT_COMMAND when Terminal.getCommandDelay() > 0", () => {
			// Set command delay to 50ms for this test
			const originalDelay = Terminal.getCommandDelay()
			Terminal.setCommandDelay(50)

			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "Roo Code",
					iconPath: expect.any(Object),
					env: {
						PAGER,
						PROMPT_COMMAND: "sleep 0.05",
						VTE_VERSION: "0",
						PROMPT_EOL_MARK: "",
					},
				})
			} finally {
				// Restore original delay
				Terminal.setCommandDelay(originalDelay)
			}
		})

		it("adds Oh My Zsh integration env var when enabled", () => {
			Terminal.setTerminalZshOhMy(true)
			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "Roo Code",
					iconPath: expect.any(Object),
					env: {
						PAGER,
						VTE_VERSION: "0",
						PROMPT_EOL_MARK: "",
						ITERM_SHELL_INTEGRATION_INSTALLED: "Yes",
					},
				})
			} finally {
				Terminal.setTerminalZshOhMy(false)
			}
		})

		it("adds Powerlevel10k integration env var when enabled", () => {
			Terminal.setTerminalZshP10k(true)
			try {
				TerminalRegistry.createTerminal("/test/path", "vscode")

				expect(mockCreateTerminal).toHaveBeenCalledWith({
					cwd: "/test/path",
					name: "Roo Code",
					iconPath: expect.any(Object),
					env: {
						PAGER,
						VTE_VERSION: "0",
						PROMPT_EOL_MARK: "",
						POWERLEVEL9K_TERM_SHELL_INTEGRATION: "true",
					},
				})

				describe("busy flag management", () => {
					it("should update busy flag on execution events", () => {
						TerminalRegistry.initialize()
						describe("busy flag management", () => {
							it("should update busy flag when set directly", () => {
								const terminal = TerminalRegistry.createTerminal("/test/path", "vscode")

								// Initially not busy
								expect(terminal.busy).toBe(false)

								// Set busy flag
								terminal.busy = true
								expect(terminal.busy).toBe(true)

								// Clear busy flag
								terminal.busy = false
								expect(terminal.busy).toBe(false)
							})
						})

						// Create a terminal
						const terminal = TerminalRegistry.createTerminal("/test/path", "vscode")
						expect(terminal.busy).toBe(false)

						// Simulate shell execution start
						terminal.busy = true
						expect(terminal.busy).toBe(true)

						// Simulate shell execution end
						terminal.busy = false
						expect(terminal.busy).toBe(false)
					})
				})

				describe("busy flag management", () => {
					it("should set and clear busy flag when shell execution starts and ends", () => {
						TerminalRegistry.initialize()

						// Create a terminal
						const terminal = TerminalRegistry.createTerminal("/test/path", "vscode")
						expect(terminal.busy).toBe(false)

						// Simulate shell execution start
						const execution = {
							commandLine: { value: "echo test" },
							cwd: "/test/path",
							read: jest.fn(),
						} as unknown as vscode.TerminalShellExecution

						// Call the private method that handles start events
						const onStartHandler = (TerminalRegistry as any).disposables.find(
							(d: any) => d._callback?.name === "onDidStartTerminalShellExecution",
						)?._callback

						onStartHandler({
							terminal: (terminal as any).terminal,
							execution,
						})

						expect(terminal.busy).toBe(true)

						// Simulate shell execution end
						const onEndHandler = (TerminalRegistry as any).disposables.find(
							(d: any) => d._callback?.name === "onDidEndTerminalShellExecution",
						)?._callback

						onEndHandler({
							terminal: (terminal as any).terminal,
							execution,
							exitCode: 0,
						})

						expect(terminal.busy).toBe(false)
					})
				})

				describe("busy flag management", () => {
					it("should set and clear busy flag when manually triggered", () => {
						const terminal = TerminalRegistry.createTerminal("/test/path", "vscode")

						// Initially not busy
						expect(terminal.busy).toBe(false)

						// Simulate shell execution start
						terminal.busy = true
						expect(terminal.busy).toBe(true)

						// Simulate shell execution end
						terminal.busy = false
						expect(terminal.busy).toBe(false)
					})
				})

				describe("busy flag management", () => {
					it("should set and clear busy flag on shell execution events", () => {
						TerminalRegistry.initialize()

						// Create a terminal
						const terminal = TerminalRegistry.createTerminal("/test/path", "vscode")
						expect(terminal.busy).toBe(false)

						// Simulate shell execution start
						const execution = {
							commandLine: { value: "echo test" },
							cwd: "/test/path",
							read: jest.fn(),
						} as unknown as vscode.TerminalShellExecution

						// Trigger the start event handler
						const startHandler = (vscode.window.onDidStartTerminalShellExecution as jest.Mock).mock
							.calls[0][0]
						startHandler({
							terminal: terminal.terminal,
							execution,
						})

						expect(terminal.busy).toBe(true)

						// Simulate shell execution end
						const endHandler = (vscode.window.onDidEndTerminalShellExecution as jest.Mock).mock.calls[0][0]
						endHandler({
							terminal: terminal.terminal,
							execution,
							exitCode: 0,
						})

						expect(terminal.busy).toBe(false)
					})
				})

				describe("busy flag management", () => {
					it("should set and clear busy flag on shell execution events", () => {
						TerminalRegistry.initialize()

						// Create a terminal
						const terminal = TerminalRegistry.createTerminal("/test/path", "vscode")
						expect(terminal.busy).toBe(false)

						// Simulate shell execution start
						const execution = {
							commandLine: { value: "echo test" },
							cwd: "/test/path",
							read: jest.fn(),
						} as unknown as vscode.TerminalShellExecution

						// Trigger the start event handler
						const startHandler = (vscode.window.onDidStartTerminalShellExecution as jest.Mock).mock
							.calls[0][0]
						startHandler({
							terminal: terminal.terminal,
							execution,
						})

						expect(terminal.busy).toBe(true)

						// Simulate shell execution end
						const endHandler = (vscode.window.onDidEndTerminalShellExecution as jest.Mock).mock.calls[0][0]
						endHandler({
							terminal: terminal.terminal,
							execution,
							exitCode: 0,
						})

						expect(terminal.busy).toBe(false)
					})
				})

				describe("busy flag management", () => {
					it("should set and clear busy flag on shell execution events", () => {
						// Create a terminal
						const terminal = TerminalRegistry.createTerminal("/test/path", "vscode")
						expect(terminal.busy).toBe(false)

						// Simulate shell execution start
						const execution = {} as vscode.TerminalShellExecution
						terminal.setActiveStream({} as vscode.Pseudoterminal)
						terminal.busy = true
						expect(terminal.busy).toBe(true)

						// Simulate shell execution end
						terminal.shellExecutionComplete({} as any)
						terminal.busy = false
						expect(terminal.busy).toBe(false)
					})
				})

				// Helper to mock vscode.Terminal
				function createMockVsTerminal(name: string): vscode.Terminal {
					return {
						name,
						processId: Promise.resolve(1234),
						creationOptions: {},
						exitStatus: undefined,
						state: { isInteractedWith: false },
						sendText: jest.fn(),
						show: jest.fn(),
						hide: jest.fn(),
						dispose: jest.fn(),
					} as unknown as vscode.Terminal
				}

				describe("busy flag management", () => {
					let eventListeners: {
						start?: (e: vscode.TerminalShellExecutionStartEvent) => void
						end?: (e: vscode.TerminalShellExecutionEndEvent) => void
					} = {}

					beforeEach(() => {
						// Reset event listeners
						eventListeners = {}

						// Mock event registration
						;(vscode.window.onDidStartTerminalShellExecution as jest.Mock).mockImplementation(
							(listener) => {
								eventListeners.start = listener
								return { dispose: jest.fn() }
							},
						)

						;(vscode.window.onDidEndTerminalShellExecution as jest.Mock).mockImplementation((listener) => {
							eventListeners.end = listener
							return { dispose: jest.fn() }
						})
					})

					it("should set and clear busy flag on shell execution events", () => {
						const vsTerminal = createMockVsTerminal("Roo Code")
						mockCreateTerminal.mockReturnValue(vsTerminal)

						TerminalRegistry.initialize()
						TerminalRegistry.createTerminal("/test/path", "vscode")

						const rooTerminal = TerminalRegistry["terminals"][0]
						expect(rooTerminal).toBeDefined()
						expect(rooTerminal.busy).toBe(false)

						// Simulate start event
						const execution = {
							commandLine: { value: "echo test" },
							cwd: "/test/path",
							read: jest.fn(),
						} as vscode.TerminalShellExecution

						eventListeners.start!({ terminal: vsTerminal, execution })
						expect(rooTerminal.busy).toBe(true)

						// Simulate end event
						eventListeners.end!({ terminal: vsTerminal, execution, exitCode: 0 })
						expect(rooTerminal.busy).toBe(false)
					})
				})

				describe("busy flag management", () => {
					let eventListeners: {
						start?: (e: vscode.TerminalShellExecutionStartEvent) => void
						end?: (e: vscode.TerminalShellExecutionEndEvent) => void
					} = {}

					beforeEach(() => {
						// Reset event listeners
						eventListeners = {}

						// Mock event registration
						;(vscode.window.onDidStartTerminalShellExecution as jest.Mock).mockImplementation(
							(listener) => {
								eventListeners.start = listener
								return { dispose: jest.fn() }
							},
						)

						;(vscode.window.onDidEndTerminalShellExecution as jest.Mock).mockImplementation((listener) => {
							eventListeners.end = listener
							return { dispose: jest.fn() }
						})
					})

					it("should set and clear busy flag on shell execution events", () => {
						const vsTerminal = { name: "Roo Code" }
						mockCreateTerminal.mockReturnValue(vsTerminal)

						const registry = TerminalRegistry.getInstance()
						registry.createTerminal("/test/path", "vscode")

						const rooTerminal = registry.getTerminalByVsTerminal(vsTerminal)
						expect(rooTerminal).toBeDefined()
						expect(rooTerminal!.busy).toBe(false)

						// Simulate start event
						const execution = {}
						eventListeners.start!({ terminal: vsTerminal, execution })
						expect(rooTerminal!.busy).toBe(true)

						// Simulate end event
						eventListeners.end!({ terminal: vsTerminal, execution, exitCode: 0 })
						expect(rooTerminal!.busy).toBe(false)
					})
				})
			} finally {
				Terminal.setTerminalZshP10k(false)
			}
		})
	})
	describe("busy flag management", () => {
		it("should set and clear busy flag on shell execution events", () => {
			const vsTerminal = { name: "Roo Code" }
			mockCreateTerminal.mockReturnValue(vsTerminal)

			const registry = TerminalRegistry.getInstance()
			registry.createTerminal("/test/path", "vscode")

			const rooTerminal = registry.getTerminalByVsTerminal(vsTerminal)
			expect(rooTerminal).toBeDefined()
			expect(rooTerminal.busy).toBe(false)

			// Simulate start event
			const execution = {}
			vscode.window.onDidStartTerminalShellExecution.fire({ terminal: vsTerminal, execution })
			expect(rooTerminal.busy).toBe(true)

			// Simulate end event
			vscode.window.onDidEndTerminalShellExecution.fire({ terminal: vsTerminal, execution, exitCode: 0 })
			expect(rooTerminal.busy).toBe(false)
		})
	})
})
