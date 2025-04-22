import { RooTerminal, RooTerminalCallbacks } from "./types"
import { ExecaTerminalProcess } from "./ExecaTerminalProcess"
import { RooTerminalProcessResultPromise, mergePromise } from "./mergePromise"

export class ExecaTerminal implements RooTerminal {
	public process?: ExecaTerminalProcess

	private initialCwd: string

	constructor(cwd: string) {
		this.initialCwd = cwd
	}

	public getCurrentWorkingDirectory(): string {
		return this.initialCwd
	}

	public runCommand(command: string, callbacks: RooTerminalCallbacks): RooTerminalProcessResultPromise {
		const process = new ExecaTerminalProcess(this)
		process.command = command
		this.process = process

		process.on("line", (line) => callbacks.onLine(line, process))
		process.once("completed", (output) => callbacks.onCompleted(output, process))
		process.once("shell_execution_complete", (details) => callbacks.onShellExecutionComplete(details, process))

		const promise = new Promise<void>((resolve, reject) => {
			process.once("continue", () => resolve())
			process.once("error", (error) => reject(error))
			process.run(command)
		})

		return mergePromise(process, promise)
	}
}
