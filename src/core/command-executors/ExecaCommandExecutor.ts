import { execa, ExecaError } from "execa"

import { CommandExecutor, ExecuteCommandOptions } from "./CommandExecutor"

export class ExecaCommandExecutor extends CommandExecutor {
	async execute({ command, cwd, onLine, onShellExecutionComplete, onStarted, onCompleted }: ExecuteCommandOptions) {
		let output = ""

		try {
			const controller = new AbortController()
			const cancelSignal = controller.signal
			const stream = execa({ shell: true, cwd, cancelSignal })`${command}`
			onStarted(controller)

			for await (const line of stream) {
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
