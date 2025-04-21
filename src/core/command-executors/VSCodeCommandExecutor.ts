import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"

import { CommandExecutor, ExecuteCommandOptions } from "./CommandExecutor"

export class VSCodeCommandExecutor extends CommandExecutor {
	public async execute({ command, cwd, taskId, onStarted, ...callbacks }: ExecuteCommandOptions) {
		const terminal = await TerminalRegistry.getOrCreateTerminal(cwd, !!cwd, taskId)
		terminal.terminal.show()
		const process = terminal.runCommand(command, callbacks)
		onStarted()
		await process
	}
}

export const vsCodeCommandExecutor = new VSCodeCommandExecutor()
