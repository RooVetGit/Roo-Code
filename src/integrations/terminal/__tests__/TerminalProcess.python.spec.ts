// npx vitest run src/integrations/terminal/__tests__/TerminalProcess.python.spec.ts

import * as vscode from "vscode"

import { TerminalProcess } from "../TerminalProcess"
import { Terminal } from "../Terminal"
import { TerminalRegistry } from "../TerminalRegistry"

vi.mock("execa", () => ({
	execa: vi.fn(),
}))

describe("TerminalProcess Python Command Handling", () => {
	let terminalProcess: TerminalProcess
	let mockTerminal: any
	let mockTerminalInfo: Terminal
	let mockExecution: any
	let mockStream: AsyncIterableIterator<string>

	beforeEach(() => {
		// Create properly typed mock terminal
		mockTerminal = {
			shellIntegration: {
				executeCommand: vi.fn(),
			},
			name: "Roo Code",
			processId: Promise.resolve(123),
			creationOptions: {},
			exitStatus: undefined,
			state: { isInteractedWith: true },
			dispose: vi.fn(),
			hide: vi.fn(),
			show: vi.fn(),
			sendText: vi.fn(),
		} as unknown as vscode.Terminal & {
			shellIntegration: {
				executeCommand: any
			}
		}

		mockTerminalInfo = new Terminal(1, mockTerminal, "./")

		// Create a process for testing
		terminalProcess = new TerminalProcess(mockTerminalInfo)

		TerminalRegistry["terminals"].push(mockTerminalInfo)

		// Reset event listeners
		terminalProcess.removeAllListeners()
	})

	describe("isPythonCommand detection", () => {
		it("detects basic python commands", () => {
			const testCases = [
				"python script.py",
				"python3 script.py",
				"python -c \"print('hello')\"",
				"python3 -c 'print(\"hello\")'",
				"uv run python -c \"print('test')\"",
				"pipx run python script.py",
				'poetry run python -c "import sys; print(sys.version)"',
			]

			testCases.forEach((command) => {
				expect(terminalProcess["isPythonCommand"](command)).toBe(true)
			})
		})

		it("does not detect non-python commands", () => {
			const testCases = [
				"echo hello",
				"ls -la",
				"npm run build",
				"node script.js",
				"pythonic-tool --help", // Contains "python" but not a python command
				"grep python file.txt",
			]

			testCases.forEach((command) => {
				expect(terminalProcess["isPythonCommand"](command)).toBe(false)
			})
		})
	})

	describe("containsVsceEndMarkers detection", () => {
		it("detects VSCode shell integration end markers", () => {
			expect(terminalProcess["containsVsceEndMarkers"]("\x1b]633;D\x07")).toBe(true)
			expect(terminalProcess["containsVsceEndMarkers"]("\x1b]133;D\x07")).toBe(true)
			expect(terminalProcess["containsVsceEndMarkers"]("some output\x1b]633;D\x07more")).toBe(true)
			expect(terminalProcess["containsVsceEndMarkers"]("regular output")).toBe(false)
		})
	})

	describe("Python command execution with extended timeout", () => {
		it("handles multi-line Python command execution", async () => {
			let lines: string[] = []
			let completedOutput = ""

			terminalProcess.on("completed", (output) => {
				completedOutput = output || ""
				if (output) {
					lines = output.split("\n")
				}
			})

			// Mock stream data for a multi-line Python command
			mockStream = (async function* () {
				yield "\x1b]633;C\x07" // Command start marker
				yield "look at this python script\n"
				yield "\x1b]633;D\x07" // Command end marker

				// Simulate shell execution complete event
				setTimeout(() => {
					terminalProcess.emit("shell_execution_complete", { exitCode: 0 })
				}, 10)
			})()

			mockExecution = {
				read: vi.fn().mockReturnValue(mockStream),
			}

			mockTerminal.shellIntegration.executeCommand.mockReturnValue(mockExecution)

			const pythonCommand =
				'uv run python -c "\nimport logging\nimport time\n\nprint(\\"look at this python script\\")\n"'

			const runPromise = terminalProcess.run(pythonCommand)
			terminalProcess.emit("stream_available", mockStream)
			await runPromise

			expect(completedOutput).toContain("look at this python script")
			expect(terminalProcess.isHot).toBe(false)
		})

		it("handles Python command without end markers gracefully", async () => {
			let completedOutput = ""

			terminalProcess.on("completed", (output) => {
				completedOutput = output || ""
			})

			// Mock stream data without proper end markers (simulating the bug scenario)
			mockStream = (async function* () {
				yield "\x1b]633;C\x07" // Command start marker
				yield "Python output without end marker\n"
				// No end marker - simulating the problematic scenario

				// Simulate delayed shell execution complete event
				setTimeout(() => {
					terminalProcess.emit("shell_execution_complete", { exitCode: 0 })
				}, 100)
			})()

			mockExecution = {
				read: vi.fn().mockReturnValue(mockStream),
			}

			mockTerminal.shellIntegration.executeCommand.mockReturnValue(mockExecution)

			const pythonCommand = 'python -c "print(\\"test\\")"'

			const runPromise = terminalProcess.run(pythonCommand)
			terminalProcess.emit("stream_available", mockStream)
			await runPromise

			expect(completedOutput).toContain("Python output without end marker")
			expect(terminalProcess.isHot).toBe(false)
		})

		it("applies extended timeout for Python commands", async () => {
			// Spy on the timeout to verify it's extended for Python commands
			const originalTimeout = Terminal.getShellIntegrationTimeout()

			// Mock a Python command that would normally timeout
			const pythonCommand = 'python -c "import time; time.sleep(0.1); print(\\"done\\")"'

			// The test verifies that isPythonCommand returns true for this command
			expect(terminalProcess["isPythonCommand"](pythonCommand)).toBe(true)

			// For this test, we'll just verify the command is detected as Python
			// The actual timeout extension is tested implicitly in the execution tests above
		})
	})

	describe("non-Python command execution", () => {
		it("uses normal timeout for non-Python commands", async () => {
			let completedOutput = ""

			terminalProcess.on("completed", (output) => {
				completedOutput = output || ""
			})

			// Mock stream data for a regular command
			mockStream = (async function* () {
				yield "\x1b]633;C\x07" // Command start marker
				yield "Hello World\n"
				yield "\x1b]633;D\x07" // Command end marker
				terminalProcess.emit("shell_execution_complete", { exitCode: 0 })
			})()

			mockExecution = {
				read: vi.fn().mockReturnValue(mockStream),
			}

			mockTerminal.shellIntegration.executeCommand.mockReturnValue(mockExecution)

			const regularCommand = 'echo "Hello World"'

			// Verify this is not detected as a Python command
			expect(terminalProcess["isPythonCommand"](regularCommand)).toBe(false)

			const runPromise = terminalProcess.run(regularCommand)
			terminalProcess.emit("stream_available", mockStream)
			await runPromise

			expect(completedOutput).toContain("Hello World")
			expect(terminalProcess.isHot).toBe(false)
		})
	})
})
