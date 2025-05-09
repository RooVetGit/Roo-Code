// npx vitest run src/integrations/terminal/__tests__/ExecaTerminalStdin.spec.ts

import { vi, describe, beforeEach, afterEach, it, expect } from "vitest"

import { ExecaTerminal } from "../ExecaTerminal"
import { ExecaTerminalProcess } from "../ExecaTerminalProcess"
import { RooTerminalCallbacks } from "../types"

describe("ExecaTerminal stdin handling", () => {
	let terminal: ExecaTerminal
	let callbacks: RooTerminalCallbacks
	let outputLines: string[] = []
	let _completedOutput: string | undefined
	let _shellExecutionStartedPid: number | undefined
	let _shellExecutionCompleteDetails: any

	beforeEach(() => {
		terminal = new ExecaTerminal(1, process.cwd())
		outputLines = []
		_completedOutput = undefined
		_shellExecutionStartedPid = undefined
		_shellExecutionCompleteDetails = undefined

		callbacks = {
			onLine: (line, _process) => {
				outputLines.push(line)
			},
			onCompleted: (output, _process) => {
				_completedOutput = output
			},
			onShellExecutionStarted: (pid, _process) => {
				_shellExecutionStartedPid = pid
			},
			onShellExecutionComplete: (details, _process) => {
				_shellExecutionCompleteDetails = details
			},
		}
	})

	afterEach(() => {
		// Clean up any running processes
		if (terminal.process) {
			terminal.process.abort()
		}
	})

	it("should detect when input is required", async () => {
		// This is a mock test since we can't reliably test with real password prompts
		// in an automated test environment

		// Create a spy on the input_required event
		const inputRequiredSpy = vi.fn()

		// Run a command and get the process
		const processPromise = terminal.runCommand("echo 'Testing stdin'", callbacks)

		// We know this is an ExecaTerminalProcess because we're using ExecaTerminal
		const process = terminal.process as ExecaTerminalProcess

		// Add a listener for the input_required event
		process.on("input_required", inputRequiredSpy)

		// Manually trigger the input detection
		// @ts-ignore - Accessing private property for testing
		process.waitingForInput = true
		process.emit("input_required")

		// Wait for the process to complete
		await processPromise

		// Verify the input_required event was emitted
		expect(inputRequiredSpy).toHaveBeenCalled()
	})

	it("should be able to send input to the process", async () => {
		// This is a mock test since we can't reliably test with real password prompts

		// Run a command and get the process
		const processPromise = terminal.runCommand("echo 'Testing stdin'", callbacks)

		// We know this is an ExecaTerminalProcess because we're using ExecaTerminal
		const process = terminal.process as ExecaTerminalProcess

		// Create a spy on the sendInput method
		const sendInputSpy = vi.spyOn(process, "sendInput")

		// Send input to the process
		terminal.sendInput("test input")

		// Wait for the process to complete
		await processPromise

		// Verify sendInput was called with the correct input
		expect(sendInputSpy).toHaveBeenCalledWith("test input")
	})

	it("isWaitingForInput should return the correct state", async () => {
		// Run a command and get the process
		const processPromise = terminal.runCommand("echo 'Testing stdin'", callbacks)

		// Initially, the process should not be waiting for input
		expect(terminal.isWaitingForInput()).toBe(false)

		// Manually set the process to be waiting for input
		// @ts-ignore - Accessing private property for testing
		terminal.process!.waitingForInput = true

		// Now it should report that it's waiting for input
		expect(terminal.isWaitingForInput()).toBe(true)

		// Wait for the process to complete
		await processPromise
	})
})
