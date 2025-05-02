import delay from "delay"

import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag, AttachedFileSpec } from "../../shared/tools"
import { Task } from "../task/Task"
import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import { formatResponse } from "../prompts/responses"

export async function newTaskTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const mode: string | undefined = block.params.mode
	const message: string | undefined = block.params.message
	const filesParam: string | undefined = block.params.files

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "newTask",
				mode: removeClosingTag("mode", mode),
				message: removeClosingTag("message", message),
			})

			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!mode) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("new_task")
				pushToolResult(await cline.sayAndCreateMissingParamError("new_task", "mode"))
				return
			}

			if (!message) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("new_task")
				pushToolResult(await cline.sayAndCreateMissingParamError("new_task", "message"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Verify the mode exists
			const targetMode = getModeBySlug(mode, (await cline.providerRef.deref()?.getState())?.customModes)

			if (!targetMode) {
				pushToolResult(formatResponse.toolError(`Invalid mode: ${mode}`))
				return
			}

			let attachedFiles: AttachedFileSpec[] = []
			if (filesParam && filesParam.trim()) {
				const fileRegex = /<file>(.*?)<\/file>/g
				for (const match of filesParam.matchAll(fileRegex)) {
					const fileString = match[1]
					// Parse the file string to extract path and optional line range
					// Format could be: path/to/file.js or path/to/file.js:10:20
					const rangeRegex = /^(.*?)(?::(\d+):(\d+))?$/
					const rangeMatch = fileString.match(rangeRegex)

					if (rangeMatch) {
						const [, filePath, startLineStr, endLineStr] = rangeMatch
						const fileSpec: AttachedFileSpec = { path: filePath }

						// Convert line numbers to numbers if they exist
						if (startLineStr && endLineStr) {
							fileSpec.startLine = parseInt(startLineStr, 10)
							fileSpec.endLine = parseInt(endLineStr, 10)
						}

						attachedFiles.push(fileSpec)
					}
				}
			}

			const toolMessage = JSON.stringify({
				tool: "newTask",
				mode: targetMode.name,
				content: message,
				files: attachedFiles,
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			const provider = cline.providerRef.deref()

			if (!provider) {
				return
			}

			// Preserve the current mode so we can resume with it later.
			cline.pausedModeSlug = (await provider.getState()).mode ?? defaultModeSlug

			// Switch mode first, then create new task instance.
			await provider.handleModeSwitch(mode)

			// Delay to allow mode change to take effect before next tool is executed.
			await delay(500)

			const newCline = await provider.initClineWithTask(message, undefined, cline, {
				attachedFiles,
				enableDiff: true,
				enableCheckpoints: true,
			})
			cline.emit("taskSpawned", newCline.taskId)

			pushToolResult(`Successfully created new task in ${targetMode.name} mode with message: ${message}`)

			// Set the isPaused flag to true so the parent
			// task can wait for the sub-task to finish.
			cline.isPaused = true
			cline.emit("taskPaused")

			return
		}
	} catch (error) {
		await handleError("creating new task", error)
		return
	}
}
