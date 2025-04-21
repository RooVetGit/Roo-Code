import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"

import { CommandExecutor, ExecuteCommandOptions } from "./CommandExecutor"

export class VSCodeCommandExecutor extends CommandExecutor {
	public async execute({ command, cwd, taskId, ...callbacks }: ExecuteCommandOptions): Promise<void> {
		const terminal = await TerminalRegistry.getOrCreateTerminal(cwd, !!cwd, taskId)
		terminal.terminal.show()
		await terminal.runCommand(command, callbacks)
	}
}

export const vsCodeCommandExecutor = new VSCodeCommandExecutor()
