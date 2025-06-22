import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolResponse } from "../../shared/tools"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"

export async function cancelTaskTool(
	cline: Task, // The calling Task instance
	block: ToolUse, // Parsed tool use from LLM
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const taskIdToCancel: string | undefined = block.params.task_instance_id

	try {
		if (block.partial) {
			const partialData = {
				tool: "cancel_task",
				task_instance_id: removeClosingTag("task_instance_id", taskIdToCancel),
			}
			await cline.say("tool_in_progress", JSON.stringify(partialData), undefined, true)
			return
		}

		if (!taskIdToCancel) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("cancel_task")
			pushToolResult(await cline.sayAndCreateMissingParamError("cancel_task", "task_instance_id"))
			return
		}

		cline.consecutiveMistakeCount = 0

		const toolMessage = JSON.stringify({
			tool: "cancel_task",
			task_instance_id: taskIdToCancel,
		})

		// Approval might be important for cancelling tasks
		const didApprove = await askApproval("tool", toolMessage)
		if (!didApprove) {
			pushToolResult(formatResponse.toolError(t("common:errors.user_rejected_tool_use", { toolName: "cancel_task" })))
			return
		}

		const taskInstance = Task.activeTasks.get(taskIdToCancel)

		if (!taskInstance) {
			pushToolResult(formatResponse.toolError(`Task with ID '${taskIdToCancel}' not found or already terminated.`))
			cline.recordToolError("cancel_task", `Task ID ${taskIdToCancel} not found`)
			return
		}

		if (taskInstance.status === "aborted" || taskInstance.status === "completed" || taskInstance.status === "failed") {
			pushToolResult(formatResponse.toolSuccess(`Task with ID '${taskIdToCancel}' is already in a terminal state: ${taskInstance.status}.`))
			return
		}

		await taskInstance.abortTask(true) // true for isAbandoned, or consider if this should be false

		// abortTask now sets the status to "aborted" and finalResult.
		// It also emits "taskAborted" event.
		// The task remains in Task.activeTasks.

		pushToolResult(formatResponse.toolSuccess(`Task with ID '${taskIdToCancel}' has been requested to cancel. Its status is now '${taskInstance.status}'.`))

	} catch (error) {
		await handleError(t("tools:cancelTask.errors.generic", { error: error.message }), error)
		cline.recordToolError("cancel_task", error.message)
		pushToolResult(formatResponse.toolError(t("tools:cancelTask.errors.generic", { error: error.message })))
		return
	}
}
