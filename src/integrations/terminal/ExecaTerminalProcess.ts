import { EventEmitter } from "events"

import { execa, ExecaError } from "execa"

import type { RooTerminal, RooTerminalProcessEvents } from "./types"

export class ExecaTerminalProcess extends EventEmitter<RooTerminalProcessEvents> {
	public command: string = ""

	private terminalRef: WeakRef<RooTerminal>
	private isListening: boolean = true
	private lastEmitTime_ms: number = 0
	private fullOutput: string = ""
	private lastRetrievedIndex: number = 0
	private controller?: AbortController
	private isStreamClosed: boolean = false

	constructor(terminal: RooTerminal) {
		super()

		this.terminalRef = new WeakRef(terminal)
	}

	public async run(command: string) {
		this.command = command
		this.controller = new AbortController()

		try {
			const stream = execa({
				shell: true,
				cwd: this.terminalRef.deref()?.getCurrentWorkingDirectory(),
				cancelSignal: this.controller.signal,
			})`${command}`

			for await (const line of stream) {
				this.fullOutput += line
				this.fullOutput += "\n"

				const now = Date.now()

				if (this.isListening && (now - this.lastEmitTime_ms > 100 || this.lastEmitTime_ms === 0)) {
					this.emitRemainingBufferIfListening()
					this.lastEmitTime_ms = now
				}
			}

			this.isStreamClosed = true
			this.emitRemainingBufferIfListening()

			this.emit("shell_execution_complete", { exitCode: 0 })
		} catch (error) {
			if (error instanceof ExecaError) {
				console.error(`[ExecaTerminalProcess] shell execution error: ${error.message}`)
				this.emit("shell_execution_complete", { exitCode: error.exitCode, signalName: error.signal })
			} else {
				this.emit("shell_execution_complete", { exitCode: 1 })
			}
		}

		this.emit("completed", this.fullOutput)
		this.emit("continue")
	}

	public continue() {
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}

	public hasUnretrievedOutput() {
		return this.lastRetrievedIndex < this.fullOutput.length
	}

	public getUnretrievedOutput() {
		let outputToProcess = this.fullOutput.slice(this.lastRetrievedIndex)
		let endIndex = -1

		if (this.isStreamClosed) {
			endIndex = outputToProcess.length
		} else {
			let endIndex = outputToProcess.lastIndexOf("\n")

			if (endIndex === -1) {
				return ""
			}

			endIndex++
		}

		this.lastRetrievedIndex += endIndex
		return outputToProcess.slice(0, endIndex)
	}

	private emitRemainingBufferIfListening() {
		if (!this.isListening) {
			return
		}

		const remainingBuffer = this.getUnretrievedOutput()

		if (remainingBuffer !== "") {
			this.emit("line", remainingBuffer)
		}
	}
}
