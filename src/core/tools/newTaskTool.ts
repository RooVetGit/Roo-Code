import delay from "delay"

import { RooCodeEventName } from "@roo-code/types"

import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { Task } from "../task/Task"
import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"

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
	const config: string | undefined = block.params.config

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "newTask",
				mode: removeClosingTag("mode", mode),
				content: removeClosingTag("message", message),
				config: config ? removeClosingTag("config", config) : undefined,
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
			// Un-escape one level of backslashes before '@' for hierarchical subtasks
			// Un-escape one level: \\@ -> \@ (removes one backslash for hierarchical subtasks)
			const unescapedMessage = message.replace(/\\\\@/g, "\\@")

			// Verify the mode exists
			const targetMode = getModeBySlug(mode, (await cline.providerRef.deref()?.getState())?.customModes)

			if (!targetMode) {
				pushToolResult(formatResponse.toolError(`Invalid mode: ${mode}`))
				return
			}

			// If a config was specified, verify it exists
			let configName: string | undefined
			if (config) {
				const provider = cline.providerRef.deref()
				if (!provider) {
					return
				}

				// Check if the specified config exists
				const hasConfig = await provider.providerSettingsManager.hasConfig(config)
				if (!hasConfig) {
					pushToolResult(
						formatResponse.toolError(
							`Configuration profile '${config}' not found. Using default configuration.`,
						),
					)
					// Continue without the config rather than failing completely
				} else {
					configName = config
				}
			}

			const toolMessage = JSON.stringify({
				tool: "newTask",
				mode: targetMode.name,
				content: message,
				...(configName && { config: configName }),
			})

			const didApprove = await askApproval("tool", toolMessage)

			if (!didApprove) {
				return
			}

			const provider = cline.providerRef.deref()

			if (!provider) {
				return
			}

			if (cline.enableCheckpoints) {
				cline.checkpointSave(true)
			}

			// Preserve the current mode so we can resume with it later.
			cline.pausedModeSlug = (await provider.getState()).mode ?? defaultModeSlug

			// Create new task instance first (this preserves parent's current mode in its history)
			const newCline = await provider.initClineWithTask(unescapedMessage, undefined, cline, configName)
			if (!newCline) {
				pushToolResult(t("tools:newTask.errors.policy_restriction"))
				return
			}

			// Now switch the newly created task to the desired mode
			await provider.handleModeSwitch(mode)

			// Delay to allow mode change to take effect
			await delay(500)

			cline.emit(RooCodeEventName.TaskSpawned, newCline.taskId)

			const successMessage = configName
				? `Successfully created new task in ${targetMode.name} mode with configuration '${configName}' and message: ${unescapedMessage}`
				: `Successfully created new task in ${targetMode.name} mode with message: ${unescapedMessage}`
			pushToolResult(successMessage)

			// Set the isPaused flag to true so the parent
			// task can wait for the sub-task to finish.
			cline.isPaused = true
			cline.emit(RooCodeEventName.TaskPaused)

			return
		}
	} catch (error) {
		await handleError("creating new task", error)
		return
	}
}
