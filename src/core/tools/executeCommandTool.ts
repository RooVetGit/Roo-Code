import fs from "fs/promises"
import * as path from "path"

import delay from "delay"

import { Cline } from "../Cline"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolResponse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { unescapeHtmlEntities } from "../../utils/text-normalization"
import { telemetryService } from "../../services/telemetry/TelemetryService"
import { ExitCodeDetails, RooTerminalProcess } from "../../integrations/terminal/types"
import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"
import { Terminal } from "../../integrations/terminal/Terminal"
import { ExecaTerminal } from "../../integrations/terminal/ExecaTerminal"

export async function executeCommandTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	let command: string | undefined = block.params.command
	const customCwd: string | undefined = block.params.cwd

	try {
		if (block.partial) {
			await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
			return
		} else {
			if (!command) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("execute_command")
				pushToolResult(await cline.sayAndCreateMissingParamError("execute_command", "command"))
				return
			}

			const ignoredFileAttemptedToAccess = cline.rooIgnoreController?.validateCommand(command)

			if (ignoredFileAttemptedToAccess) {
				await cline.say("rooignore_error", ignoredFileAttemptedToAccess)
				pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(ignoredFileAttemptedToAccess)))
				return
			}

			cline.consecutiveMistakeCount = 0

			command = unescapeHtmlEntities(command) // Unescape HTML entities.
			const didApprove = await askApproval("command", command)

			if (!didApprove) {
				return
			}

			const [userRejected, result] = await executeCommand(cline, command, customCwd)

			if (userRejected) {
				cline.didRejectTool = true
			}

			pushToolResult(result)

			return
		}
	} catch (error) {
		await handleError("executing command", error)
		return
	}
}

export async function executeCommand(
	cline: Cline,
	command: string,
	customCwd?: string,
	terminalProvider: "vscode" | "execa" = "vscode",
): Promise<[boolean, ToolResponse]> {
	let workingDir: string

	if (!customCwd) {
		workingDir = cline.cwd
	} else if (path.isAbsolute(customCwd)) {
		workingDir = customCwd
	} else {
		workingDir = path.resolve(cline.cwd, customCwd)
	}

	// Check if directory exists
	try {
		await fs.access(workingDir)
	} catch (error) {
		return [false, `Working directory '${workingDir}' does not exist.`]
	}

	// Update the working directory in case the terminal we asked for has
	// a different working directory so that the model will know where the
	// command actually executed:
	// workingDir = terminalInfo.getCurrentWorkingDirectory()
	const workingDirInfo = workingDir ? ` from '${workingDir.toPosix()}'` : ""

	let userFeedback: { text?: string; images?: string[] } | undefined
	let runInBackground: boolean | undefined = undefined
	let completed = false
	let result: string = ""
	let exitDetails: ExitCodeDetails | undefined
	const { terminalOutputLineLimit = 500 } = (await cline.providerRef.deref()?.getState()) ?? {}

	const debounceLineLimit = 100 // Flush after this many lines.
	const debounceTimeoutMs = 200 // Flush after this much time inactivity (ms).
	let buffer: string[] = []
	let debounceTimer: NodeJS.Timeout | null = null

	async function flush(process?: RooTerminalProcess) {
		if (debounceTimer) {
			clearTimeout(debounceTimer)
			debounceTimer = null
		}

		if (buffer.length === 0) {
			return
		}

		const output = buffer.join("\n")
		buffer = []

		result = Terminal.compressTerminalOutput(result + output, terminalOutputLineLimit)
		const compressed = Terminal.compressTerminalOutput(output, terminalOutputLineLimit)
		cline.say("command_output", compressed)

		if (typeof runInBackground !== "undefined") {
			return
		}

		console.log(`ask command_output: waiting for response`)
		const { response, text, images } = await cline.ask("command_output", compressed)
		console.log(`ask command_output =>`, response)

		if (response === "yesButtonClicked") {
			runInBackground = false
		} else {
			runInBackground = true
			userFeedback = { text, images }
		}

		process?.continue()
	}

	const callbacks = {
		onLine: async (line: string, process: RooTerminalProcess) => {
			buffer.push(line)

			if (buffer.length >= debounceLineLimit) {
				await flush(process)
			} else {
				if (debounceTimer) {
					clearTimeout(debounceTimer)
				}

				debounceTimer = setTimeout(() => flush(process), debounceTimeoutMs)
			}
		},
		onCompleted: () => (completed = true),
		onShellExecutionComplete: (details: ExitCodeDetails) => (exitDetails = details),
		onNoShellIntegration: async (message: string) => {
			telemetryService.captureShellIntegrationError(cline.taskId)
			await cline.say("shell_integration_warning", message)
		},
	}

	let terminal: Terminal | ExecaTerminal

	if (terminalProvider === "vscode") {
		terminal = await TerminalRegistry.getOrCreateTerminal(workingDir, !!workingDir, cline.taskId)
		terminal.terminal.show()
	} else {
		terminal = new ExecaTerminal(workingDir)
	}

	await terminal.runCommand(command, callbacks)

	if (debounceTimer) {
		clearTimeout(debounceTimer)
		debounceTimer = null
	}

	// If there are any lines in the buffer, flush them to `result`.
	await flush()

	// Wait for a short delay to ensure all messages are sent to the webview.
	// This delay allows time for non-awaited promises to be created and
	// for their associated messages to be sent to the webview, maintaining
	// the correct order of messages (although the webview is smart about
	// grouping command_output messages despite any gaps anyways).
	await delay(50)

	if (userFeedback) {
		await cline.say("user_feedback", userFeedback.text, userFeedback.images)

		return [
			true,
			formatResponse.toolResult(
				`Command is still running in terminal ${workingDirInfo}.${
					result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
				}\n\nThe user provided the following feedback:\n<feedback>\n${userFeedback.text}\n</feedback>`,
				userFeedback.images,
			),
		]
	} else if (completed) {
		let exitStatus: string = ""

		if (exitDetails !== undefined) {
			if (exitDetails.signal) {
				exitStatus = `Process terminated by signal ${exitDetails.signal} (${exitDetails.signalName})`

				if (exitDetails.coreDumpPossible) {
					exitStatus += " - core dump possible"
				}
			} else if (exitDetails.exitCode === undefined) {
				result += "<VSCE exit code is undefined: terminal output and command execution status is unknown.>"
				exitStatus = `Exit code: <undefined, notify user>`
			} else {
				if (exitDetails.exitCode !== 0) {
					exitStatus += "Command execution was not successful, inspect the cause and adjust as needed.\n"
				}

				exitStatus += `Exit code: ${exitDetails.exitCode}`
			}
		} else {
			result += "<VSCE exitDetails == undefined: terminal output and command execution status is unknown.>"
			exitStatus = `Exit code: <undefined, notify user>`
		}

		let workingDirInfo: string = workingDir ? ` within working directory '${workingDir.toPosix()}'` : ""
		// const newWorkingDir = terminalInfo.getCurrentWorkingDirectory()

		// if (newWorkingDir !== workingDir) {
		// 	workingDirInfo += `\nNOTICE: Your command changed the working directory for this terminal to '${newWorkingDir.toPosix()}' so you MUST adjust future commands accordingly because they will be executed in this directory`
		// }

		const outputInfo = `\nOutput:\n${result}`
		return [false, `Command executed in terminal ${workingDirInfo}. ${exitStatus}${outputInfo}`]
	} else {
		return [
			false,
			`Command is still running in terminal ${workingDirInfo}.${
				result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
			}\n\nYou will be updated on the terminal status and new output in the future.`,
		]
	}
}
