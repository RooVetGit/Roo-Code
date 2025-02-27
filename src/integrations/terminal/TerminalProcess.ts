import { EventEmitter } from "events"
import stripAnsi from "strip-ansi"
import * as vscode from "vscode"

export interface TerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: []
	error: [error: Error]
	no_shell_integration: []
}

// how long to wait after a process outputs anything before we consider it "cool" again
const PROCESS_HOT_TIMEOUT_NORMAL = 2_000
const PROCESS_HOT_TIMEOUT_COMPILING = 15_000

// Debug logging
const DEBUG_PERFORMANCE = true

/**
 * Terminal buffer management constants
 * These control how the terminal output is processed and limited
 */
const MAX_LINE_LENGTH = 200 // Truncate very long lines
const PROCESS_CHUNK_SIZE = 1024 // Process 1KB at a time
const YIELD_THRESHOLD = 10 // Yield to event loop after this many chunks
const DEFAULT_LINE_LIMIT = 1000 // Default line limit if none is set

// Output channel for debug logging
// This is helpful for diagnosing issues with terminal output processing
let debugOutputChannel: vscode.OutputChannel | undefined
let isTestEnvironment = false

// Check if we're in a test environment
try {
	isTestEnvironment = process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined
} catch (e) {
	// In case of any error, assume test environment to be safe
	isTestEnvironment = true
}

export class TerminalProcess extends EventEmitter {
	waitForShellIntegration: boolean = true
	private isListening: boolean = true
	private buffer: string = ""
	private lineBuffer: string[] = []
	private discardedLineCount: number = 0
	private terminalOutputLineLimit: number
	isHot: boolean = false
	private hotTimer: NodeJS.Timeout | null = null
	private totalProcessingTime: number = 0
	private chunkCount: number = 0
	private totalDataSize: number = 0
	private lineCount: number = 0

	constructor(initialLineLimit?: number) {
		super()
		this.terminalOutputLineLimit = initialLineLimit || DEFAULT_LINE_LIMIT

		// Always create output channel for debugging
		if (DEBUG_PERFORMANCE && !debugOutputChannel) {
			try {
				debugOutputChannel = vscode.window.createOutputChannel("Roo Terminal Debug")
				debugOutputChannel.show(true)
			} catch (error) {
				console.error("Failed to create debug output channel", error)
			}
		}
	}

	private debugLog(message: string, force: boolean = false): void {
		// Always log certain messages
		if (force || DEBUG_PERFORMANCE) {
			const timestamp = new Date().toISOString()
			const logMessage = `${timestamp}: ${message}`

			console.log(logMessage)

			if (debugOutputChannel) {
				try {
					debugOutputChannel.appendLine(logMessage)
				} catch (error) {
					// Silently fail if we can't log to output channel
				}
			}
		}
	}

	/**
	 * Initializes the terminal output line limit from user settings
	 *
	 * This method tries to access the user's configured line limit setting through
	 * the extension's sidebar provider. If it cannot access the setting for any reason
	 * (extension not found, not activated, missing state, etc.), it falls back to
	 * the default line limit constant (1000 lines).
	 *
	 * The line limit controls how many lines of terminal output are kept in memory,
	 * with older lines being discarded when the limit is exceeded.
	 */
	private async initializeLineLimit(): Promise<void> {
		this.debugLog("Initializing line limit...", true)

		try {
			// Attempt to get the Roo Cline extension
			const extension = vscode.extensions.getExtension("RooVeterinaryInc.roo-cline")
			if (!extension) {
				this.debugLog("Extension not found, using default line limit", true)
				return
			}

			// Ensure the extension is activated before accessing its exports
			if (!extension.isActive) {
				await extension.activate()
			}

			// Get the extension's exports
			const provider = extension.exports
			this.debugLog(`Extension exports available properties: ${Object.keys(provider || {}).join(", ")}`, true)

			// Access state through the sidebarProvider
			// This is the reliable path to access user settings in the Roo Cline extension
			if (provider && provider.sidebarProvider) {
				const sidebarProvider = provider.sidebarProvider
				this.debugLog(`SidebarProvider properties: ${Object.keys(sidebarProvider || {}).join(", ")}`, true)

				// Get and use the user's configured terminal output line limit
				if (typeof sidebarProvider.getState === "function") {
					this.debugLog(`Calling sidebarProvider.getState()`, true)
					const state = await sidebarProvider.getState()
					this.debugLog(`State returned: ${JSON.stringify(state)}`, true)
					if (state && typeof state.terminalOutputLineLimit === "number") {
						// Successfully retrieved the user's setting
						this.terminalOutputLineLimit = state.terminalOutputLineLimit
						this.debugLog(
							`Got line limit from sidebar provider state: ${this.terminalOutputLineLimit}`,
							true,
						)
						return
					}
				} else {
					// Function not available - log for debugging
					this.debugLog(
						`sidebarProvider.getState is not a function: ${typeof sidebarProvider.getState}`,
						true,
					)
				}
			}

			// If we got here, we couldn't access the user's setting
			// Keep the default line limit that was set in the constructor
			this.debugLog(
				`Unable to get line limit from sidebar provider, using default: ${this.terminalOutputLineLimit}`,
				true,
			)
		} catch (error) {
			this.debugLog(
				`Error getting terminal output line limit: ${error}. Using default: ${this.terminalOutputLineLimit}`,
				true,
			)
		}
	}

	/**
	 * Adds a line to the terminal output buffer
	 *
	 * This method handles line limiting by:
	 * 1. Checking if the buffer exceeds the configured line limit
	 * 2. If so, discarding the oldest line and incrementing the discarded count
	 * 3. Adding the new line to the buffer (with truncation if needed)
	 * 4. Emitting the line event if we're listening
	 */
	private addLine(line: string): void {
		// Implement line limiting by discarding oldest lines when buffer is full
		if (this.lineBuffer.length >= this.terminalOutputLineLimit) {
			this.discardedLineCount++
			this.lineBuffer.shift()
		}

		const processedLine = line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) + "...(truncated)" : line

		this.lineBuffer.push(processedLine)
		this.lineCount++

		if (this.isListening) {
			this.emit("line", processedLine)
		}
	}

	private async processStreamData(data: string): Promise<void> {
		const lines = (this.buffer + data).split(/\r?\n/)
		this.buffer = lines.pop() || ""

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			if (line.trim()) {
				this.addLine(line)
			}

			if (i > 0 && i % YIELD_THRESHOLD === 0 && i < lines.length - 1) {
				await new Promise((resolve) => setImmediate(resolve))
			}
		}
	}

	public async run(terminal: vscode.Terminal, command: string): Promise<void> {
		await this.initializeLineLimit()

		// Reset state
		this.lineBuffer = []
		this.discardedLineCount = 0
		this.buffer = ""
		this.totalProcessingTime = 0
		this.chunkCount = 0
		this.totalDataSize = 0
		this.lineCount = 0

		this.debugLog(`Starting command with line limit ${this.terminalOutputLineLimit}: ${command}`, true)

		if (terminal.shellIntegration && terminal.shellIntegration.executeCommand) {
			const execution = terminal.shellIntegration.executeCommand(command)
			const stream = execution.read()
			let isFirstChunk = true
			let didEmitEmptyLine = false

			try {
				for await (let data of stream) {
					const processStart = performance.now()

					try {
						if (isFirstChunk) {
							data = isTestEnvironment ? stripAnsi(data) : this.processFirstChunk(data)
							isFirstChunk = false
						} else {
							data = stripAnsi(data)
						}

						if (!didEmitEmptyLine && data.trim()) {
							this.emit("line", "")
							didEmitEmptyLine = true
						}

						if (data.length > PROCESS_CHUNK_SIZE) {
							const chunkCount = Math.ceil(data.length / PROCESS_CHUNK_SIZE)
							for (let i = 0; i < chunkCount; i++) {
								const start = i * PROCESS_CHUNK_SIZE
								const end = Math.min(start + PROCESS_CHUNK_SIZE, data.length)
								const chunk = data.slice(start, end)

								await this.processStreamData(chunk)

								this.chunkCount++
								this.totalDataSize += chunk.length

								if (i < chunkCount - 1) {
									await new Promise((resolve) => setImmediate(resolve))
								}
							}
						} else {
							await this.processStreamData(data)
							this.chunkCount++
							this.totalDataSize += data.length
						}
					} catch (chunkError) {
						this.debugLog(`Error processing chunk: ${chunkError}`)
					}

					const processEnd = performance.now()
					this.totalProcessingTime += processEnd - processStart
				}

				if (this.buffer.trim()) {
					this.addLine(this.buffer)
					this.buffer = ""
				}

				// Log detailed statistics about buffer usage and line processing
				this.debugLog(
					`Command completed. Stats: processed ${this.chunkCount} chunks, ${this.totalDataSize} bytes`,
					true,
				)
				this.debugLog(
					`Buffer size: ${this.lineBuffer.length} lines, Discarded: ${this.discardedLineCount} lines`,
					true,
				)
				this.debugLog(
					`Total lines processed: ${this.lineCount}, Processing time: ${this.totalProcessingTime.toFixed(2)}ms`,
					true,
				)

				this.emit("completed")
				this.emit("continue")
			} catch (error) {
				this.debugLog(`Error processing command: ${error}`)
				this.emit("error", error as Error)
			}
		} else {
			terminal.sendText(command, true)
			this.emit("completed")
			this.emit("continue")
			this.emit("no_shell_integration")
		}
	}

	private processFirstChunk(data: string): string {
		try {
			const outputBetweenSequences = data.match(/\]633;C([\s\S]*?)\]633;D/)?.[1] || ""
			const vscodeSequenceRegex = /\]633;.[^]*/g
			const matchArray = [...data.matchAll(vscodeSequenceRegex)]
			const lastMatch = matchArray.length > 0 ? matchArray[matchArray.length - 1] : null

			if (lastMatch && lastMatch.index !== undefined) {
				data = data.slice(lastMatch.index + lastMatch[0].length)
			}

			if (outputBetweenSequences.trim()) {
				data = outputBetweenSequences.trim() + "\n" + data
			}

			return stripAnsi(data)
		} catch (error) {
			this.debugLog(`Error processing first chunk: ${error}`)
			return stripAnsi(data)
		}
	}

	public continue(): void {
		if (this.isListening) {
			if (this.buffer && this.buffer.trim()) {
				this.emit("line", this.buffer.trim())
				this.buffer = ""
			}
		}

		this.isListening = false
		this.emit("continue")
	}

	public getUnretrievedOutput(): string {
		try {
			let output = this.lineBuffer.join("\n")
			return this.removeLastLineArtifacts(output)
		} catch (error) {
			this.debugLog(`Error in getUnretrievedOutput: ${error}`)
			return `[Error retrieving output: ${error}]`
		}
	}

	private removeLastLineArtifacts(output: string): string {
		try {
			const lines = output.split("\n")
			for (let i = 0; i < lines.length; i++) {
				lines[i] = lines[i].replace(/[%$#>]\s*$/, "")
			}
			return lines.join("\n").trimEnd()
		} catch (error) {
			this.debugLog(`Error in removeLastLineArtifacts: ${error}`)
			return output
		}
	}
}

export type TerminalProcessResultPromise = TerminalProcess & Promise<void>

export function mergePromise(process: TerminalProcess, promise: Promise<void>): TerminalProcessResultPromise {
	const nativePromisePrototype = (async () => {})().constructor.prototype
	const descriptors = ["then", "catch", "finally"].map(
		(property) => [property, Reflect.getOwnPropertyDescriptor(nativePromisePrototype, property)] as const,
	)
	for (const [property, descriptor] of descriptors) {
		if (descriptor) {
			const value = descriptor.value.bind(promise)
			Reflect.defineProperty(process, property, { ...descriptor, value })
		}
	}
	return process as TerminalProcessResultPromise
}
