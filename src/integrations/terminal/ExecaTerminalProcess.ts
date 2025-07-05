import { execa, ExecaError } from "execa"
import psTree from "ps-tree"
import process from "process"
import * as vscode from "vscode"

import type { RooTerminal } from "./types"
import { BaseTerminalProcess } from "./BaseTerminalProcess"
import { processRegistry } from "../../core/process/ProcessRegistry"

export class ExecaTerminalProcess extends BaseTerminalProcess {
	private terminalRef: WeakRef<RooTerminal>
	private aborted = false
	private pid?: number
	private processId?: string

	constructor(terminal: RooTerminal) {
		super()

		this.terminalRef = new WeakRef(terminal)

		this.once("completed", () => {
			this.terminal.busy = false
		})
	}

	public get terminal(): RooTerminal {
		const terminal = this.terminalRef.deref()

		if (!terminal) {
			throw new Error("Unable to dereference terminal")
		}

		return terminal
	}

	public override async run(command: string) {
		this.command = command

		try {
			this.isHot = true

			const subprocess = execa({
				shell: true,
				cwd: this.terminal.getCurrentWorkingDirectory(),
				all: true,
				env: {
					...process.env,
					// Ensure UTF-8 encoding for Ruby, CocoaPods, etc.
					LANG: "en_US.UTF-8",
					LC_ALL: "en_US.UTF-8",
				},
			})`${command}`

			this.pid = subprocess.pid

			// Register the process with the ProcessRegistry for cleanup tracking
			if (subprocess.pid) {
				this.processId = `execa-${subprocess.pid}-${Date.now()}`
				try {
					const currentDebugSession = vscode.debug.activeDebugSession
					processRegistry.register(subprocess, this.processId, {
						description: `Terminal command: ${command}`,
						debugSessionId: currentDebugSession?.id,
					})
				} catch (error) {
					// In test environment, vscode.debug might not be available
					console.warn(`[ExecaTerminalProcess] Failed to register process: ${error}`)
				}
			}

			const stream = subprocess.iterable({ from: "all", preserveNewlines: true })
			this.terminal.setActiveStream(stream, subprocess.pid)

			for await (const line of stream) {
				if (this.aborted) {
					break
				}

				this.fullOutput += line

				const now = Date.now()

				if (this.isListening && (now - this.lastEmitTime_ms > 500 || this.lastEmitTime_ms === 0)) {
					this.emitRemainingBufferIfListening()
					this.lastEmitTime_ms = now
				}

				this.startHotTimer(line)
			}

			if (this.aborted) {
				let timeoutId: NodeJS.Timeout | undefined

				const kill = new Promise<void>((resolve) => {
					timeoutId = setTimeout(() => {
						try {
							subprocess.kill("SIGKILL")
						} catch (e) {}

						resolve()
					}, 5_000)
				})

				try {
					await Promise.race([subprocess, kill])
				} catch (error) {
					console.log(
						`[ExecaTerminalProcess] subprocess termination error: ${error instanceof Error ? error.message : String(error)}`,
					)
				}

				if (timeoutId) {
					clearTimeout(timeoutId)
				}
			}

			this.emit("shell_execution_complete", { exitCode: 0 })
		} catch (error) {
			if (error instanceof ExecaError) {
				console.error(`[ExecaTerminalProcess] shell execution error: ${error.message}`)
				this.emit("shell_execution_complete", { exitCode: error.exitCode ?? 0, signalName: error.signal })
			} else {
				console.error(
					`[ExecaTerminalProcess] shell execution error: ${error instanceof Error ? error.message : String(error)}`,
				)
				this.emit("shell_execution_complete", { exitCode: 1 })
			}
		}

		this.terminal.setActiveStream(undefined)
		this.emitRemainingBufferIfListening()
		this.stopHotTimer()

		// Unregister the process from the ProcessRegistry
		if (this.processId) {
			processRegistry.unregister(this.processId)
			this.processId = undefined
		}

		this.emit("completed", this.fullOutput)
		this.emit("continue")
	}

	public override continue() {
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}

	public override abort() {
		this.aborted = true

		// Use ProcessRegistry for cleanup if available, otherwise fall back to manual cleanup
		if (this.processId) {
			processRegistry.killProcess(this.processId, "SIGINT").catch((error) => {
				console.warn(`[ExecaTerminalProcess] Failed to kill process via registry: ${error}`)
			})
		} else if (this.pid) {
			// Fallback to manual cleanup for processes not registered
			psTree(this.pid, async (err, children) => {
				if (!err) {
					const pids = children.map((p) => parseInt(p.PID))

					for (const pid of pids) {
						try {
							process.kill(pid, "SIGINT")
						} catch (e) {
							console.warn(
								`[ExecaTerminalProcess] Failed to send SIGINT to child PID ${pid}: ${e instanceof Error ? e.message : String(e)}`,
							)
							// Optionally try SIGTERM or SIGKILL on failure, depending on desired behavior.
						}
					}
				} else {
					console.error(
						`[ExecaTerminalProcess] Failed to get process tree for PID ${this.pid}: ${err.message}`,
					)
				}
			})

			try {
				process.kill(this.pid, "SIGINT")
			} catch (e) {
				console.warn(
					`[ExecaTerminalProcess] Failed to send SIGINT to main PID ${this.pid}: ${e instanceof Error ? e.message : String(e)}`,
				)
			}
		}
	}

	public override hasUnretrievedOutput() {
		return this.lastRetrievedIndex < this.fullOutput.length
	}

	public override getUnretrievedOutput() {
		let output = this.fullOutput.slice(this.lastRetrievedIndex)
		let index = output.lastIndexOf("\n")

		if (index === -1) {
			return ""
		}

		index++
		this.lastRetrievedIndex += index

		// console.log(
		// 	`[ExecaTerminalProcess#getUnretrievedOutput] fullOutput.length=${this.fullOutput.length} lastRetrievedIndex=${this.lastRetrievedIndex}`,
		// 	output.slice(0, index),
		// )

		return output.slice(0, index)
	}

	private emitRemainingBufferIfListening() {
		if (!this.isListening) {
			return
		}

		const output = this.getUnretrievedOutput()

		if (output !== "") {
			this.emit("line", output)
		}
	}
}
