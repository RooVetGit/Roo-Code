export interface RooTerminal {
	getCurrentWorkingDirectory(): string
	runCommand: (command: string, callbacks: RooTerminalCallbacks) => Promise<void>
}

export interface RooTerminalCallbacks {
	onLine: (line: string, process: RooTerminalProcess) => void
	onCompleted: (output: string | undefined, process: RooTerminalProcess) => void
	onShellExecutionComplete: (details: ExitCodeDetails, process: RooTerminalProcess) => void
	onNoShellIntegration: (message: string, process: RooTerminalProcess) => void
}

export interface RooTerminalProcess {
	continue: () => void
	abort: () => void
}

export interface RooTerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: [output?: string]
	error: [error: Error]
	no_shell_integration: [message: string]
	/**
	 * Emitted when a shell execution completes
	 * @param id The terminal ID
	 * @param exitDetails Contains exit code and signal information if process was terminated by signal
	 */
	shell_execution_complete: [exitDetails: ExitCodeDetails]
	stream_available: [stream: AsyncIterable<string>]
}

export interface ExitCodeDetails {
	exitCode: number | undefined
	signal?: number | undefined
	signalName?: string
	coreDumpPossible?: boolean
}
