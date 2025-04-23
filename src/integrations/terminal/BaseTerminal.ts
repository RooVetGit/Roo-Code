import type { RooTerminal, RooTerminalCallbacks, RooTerminalProcess, RooTerminalProcessResultPromise } from "./types"

export abstract class BaseTerminal implements RooTerminal {
	public process?: RooTerminalProcess

	protected readonly initialCwd: string

	constructor(cwd: string) {
		this.initialCwd = cwd
	}

	public getCurrentWorkingDirectory(): string {
		return this.initialCwd
	}

	abstract runCommand(command: string, callbacks: RooTerminalCallbacks): RooTerminalProcessResultPromise
}
