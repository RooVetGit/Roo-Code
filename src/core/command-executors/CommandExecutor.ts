import { TerminalProcess } from "../../integrations/terminal/TerminalProcess"
import { ExitCodeDetails } from "../../integrations/terminal/TerminalProcess"

export interface ExecuteCommandOptions {
	command: string
	cwd: string
	taskId?: string
	onLine: (line: string, process?: TerminalProcess) => void
	onCompleted: (output: string | undefined) => void
	onShellExecutionComplete: (details: ExitCodeDetails) => void
	onNoShellIntegration?: (message: string) => void
}

export abstract class CommandExecutor {
	public abstract execute(options: ExecuteCommandOptions): Promise<void>
}
