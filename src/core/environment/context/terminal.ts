import pWaitFor from "p-wait-for"
import delay from "delay"

import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"
import { Terminal } from "../../../integrations/terminal/Terminal"
import type { Task } from "../../task/Task"

export async function getTerminalContext(cline: Task) {
	const state = await cline.providerRef.deref()?.getState()
	const { terminalOutputLineLimit = 500 } = state ?? {}
	const terminalsData: any[] = []
	const busyTerminals = [
		...TerminalRegistry.getTerminals(true, cline.taskId),
		...TerminalRegistry.getBackgroundTerminals(true),
	]
	const inactiveTerminals = [
		...TerminalRegistry.getTerminals(false, cline.taskId),
		...TerminalRegistry.getBackgroundTerminals(false),
	]

	// Wait for terminals to cool down if needed
	if (busyTerminals.length > 0 && cline.didEditFile) {
		await delay(300) // Delay after saving file to let terminals catch up
		await pWaitFor(() => busyTerminals.every((t) => !TerminalRegistry.isProcessHot(t.id)), {
			interval: 100,
			timeout: 5_000,
		}).catch(() => {})
	}
	cline.didEditFile = false

	// Process active terminals
	busyTerminals.forEach((terminal) => {
		const cwd = terminal.getCurrentWorkingDirectory()
		const command = terminal.getLastCommand()
		let output = TerminalRegistry.getUnretrievedOutput(terminal.id)

		const terminalData: any = {
			"@id": terminal.id.toString(),
			"@status": "Active",
			"@cwd": cwd,
			"@command": command,
		}

		if (output) {
			terminalData["#cdata"] = Terminal.compressTerminalOutput(output, terminalOutputLineLimit)
		}

		terminalsData.push(terminalData)
	})

	// Process inactive terminals with output
	inactiveTerminals
		.filter((t) => t.getProcessesWithOutput().length > 0)
		.forEach((terminal) => {
			const cwd = terminal.getCurrentWorkingDirectory()
			const processes = terminal.getProcessesWithOutput()

			processes.forEach((process) => {
				const output = process.getUnretrievedOutput()

				if (output) {
					terminalsData.push({
						"@id": terminal.id.toString(),
						"@status": "Inactive",
						"@cwd": cwd,
						"@command": process.command,
						"#cdata": Terminal.compressTerminalOutput(output, terminalOutputLineLimit),
					})
				}
			})

			terminal.cleanCompletedProcessQueue()
		})

	return terminalsData.length > 0 ? { terminal: terminalsData } : undefined
}
