import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolDescription } from "../../shared/tools"
import { Task } from "../task/Task"
import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"

export async function dispatchTaskTool(
	cline: Task, // The calling Task instance (orchestrator)
	block: ToolUse, // Parsed tool use from LLM
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
	toolDescription: ToolDescription,
) {
	const mode: string | undefined = block.params.mode
	const message: string | undefined = block.params.message

	try {
		if (block.partial) {
			// Handle partial streaming if necessary (similar to other tools)
			const partialData = {
				tool: "dispatch_task",
				mode: removeClosingTag("mode", mode),
				message: removeClosingTag("message", message),
			}
			// For dispatch, we might not need to ask for approval on partial,
			// but good to have a placeholder for consistency.
			// Let's assume it just updates UI for now, doesn't block.
			await cline.say("tool_in_progress", JSON.stringify(partialData), undefined, true)
			return
		}

		// Validate parameters
		if (!mode) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("dispatch_task")
			pushToolResult(await cline.sayAndCreateMissingParamError("dispatch_task", "mode"))
			return
		}

		if (!message) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("dispatch_task")
			pushToolResult(await cline.sayAndCreateMissingParamError("dispatch_task", "message"))
			return
		}

		cline.consecutiveMistakeCount = 0
		const unescapedMessage = message.replace(/\\\\@/g, "\\@") // Consistent with newTaskTool

		const provider = cline.providerRef.deref()
		if (!provider) {
			throw new Error("ClineProvider reference lost")
		}

		const targetMode = getModeBySlug(mode, (await provider.getState()).customModes)
		if (!targetMode) {
			pushToolResult(formatResponse.toolError(`Invalid mode: ${mode}`))
			cline.recordToolError("dispatch_task", `Invalid mode: ${mode}`)
			return
		}

		const toolMessage = JSON.stringify({
			tool: "dispatch_task",
			mode: targetMode.name,
			content: unescapedMessage,
		})

		const didApprove = await askApproval("tool", toolMessage)
		if (!didApprove) {
			// User rejected the tool use
			pushToolResult(formatResponse.toolError(t("common:errors.user_rejected_tool_use", { toolName: "dispatch_task" })))
			// No need to increment consecutiveMistakeCount here as it's a user decision
			return
		}

		// Save checkpoint if enabled
		if (cline.enableCheckpoints) {
			await cline.checkpointSave(true)
		}

		// IMPORTANT: Unlike newTaskTool, we do NOT set cline.isPaused = true here.
		// The parent task (cline) continues execution.

		// Create the new task. It will be a child of the current task (cline).
		// The provider.initClineWithTask will handle adding it to the clineStack.
		const dispatchedTask = await provider.initClineWithTask(unescapedMessage, undefined, cline, {
			// Pass relevant options from parent if needed, or use defaults
			enableDiff: cline.diffEnabled,
			enableCheckpoints: cline.enableCheckpoints,
			fuzzyMatchThreshold: cline.fuzzyMatchThreshold,
			consecutiveMistakeLimit: cline.consecutiveMistakeLimit,
			experiments: (await provider.getState()).experiments,
		})

		if (!dispatchedTask) {
			pushToolResult(formatResponse.toolError(t("tools:newTask.errors.policy_restriction"))) // Reusing existing translation
			cline.recordToolError("dispatch_task", "Policy restriction or task creation failed")
			return
		}

		// Store the dispatched task's ID in the parent task
		cline.dispatchedTaskIds.add(dispatchedTask.taskId)

		// Emit an event indicating a task was dispatched (optional, but good for observability)
		cline.emit("taskSpawned" as any, dispatchedTask.taskId) // Reusing taskSpawned for now

		// Return the taskId to the LLM
		pushToolResult(formatResponse.toolSuccess(`Task dispatched with ID: ${dispatchedTask.taskId}. Mode: ${targetMode.name}. Message: "${unescapedMessage}"`))

	} catch (error) {
		await handleError(t("tools:dispatchTask.errors.generic", { error: error.message }), error)
		cline.recordToolError("dispatch_task", error.message)
		// Ensure a result is pushed even in case of unexpected errors
		pushToolResult(formatResponse.toolError(t("tools:dispatchTask.errors.generic", { error: error.message })))
		return
	}
}
