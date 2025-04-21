import { execa, ExecaError } from "execa"

import { CommandExecutor, ExecuteCommandOptions } from "./CommandExecutor"

export class ExecaCommandExecutor extends CommandExecutor {
	async execute({
		command,
		cwd,
		taskId,
		onLine,
		onShellExecutionComplete,
		onCompleted,
	}: ExecuteCommandOptions): Promise<void> {
		let output = ""

		try {
			for await (const line of execa({ shell: true, cwd })`${command}`) {
				output += line
				onLine(line)
			}

			onShellExecutionComplete({ exitCode: 0 })
		} catch (error) {
			if (error instanceof ExecaError) {
				onShellExecutionComplete({ exitCode: error.exitCode, signalName: error.signal })
			} else {
				onShellExecutionComplete({ exitCode: 1 })
			}
		}

		onCompleted(output)
	}
}

export const execaCommandExecutor = new ExecaCommandExecutor()
