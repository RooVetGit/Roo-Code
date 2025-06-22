import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolResponse } from "../../shared/tools"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"

export async function releaseTasksTool(
	cline: Task, // The calling Task instance
	block: ToolUse, // Parsed tool use from LLM
	askApproval: AskApproval, // Approval might be good for a "destructive" action like releasing
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const taskIdsParam: string | undefined = block.params.task_instance_ids

	try {
		if (block.partial) {
			const partialData = {
				tool: "release_tasks",
				task_instance_ids: removeClosingTag("task_instance_ids", taskIdsParam),
			}
			await cline.say("tool_in_progress", JSON.stringify(partialData), undefined, true)
			return
		}

		if (!taskIdsParam) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("release_tasks")
			pushToolResult(await cline.sayAndCreateMissingParamError("release_tasks", "task_instance_ids"))
			return
		}

		cline.consecutiveMistakeCount = 0
		const taskIdsToRelease = taskIdsParam.split(",").map(id => id.trim()).filter(id => id)

		if (taskIdsToRelease.length === 0) {
			pushToolResult(formatResponse.toolError("No task instance IDs provided for release."))
			cline.recordToolError("release_tasks", "No task instance IDs provided")
			return
		}

		const toolMessage = JSON.stringify({
			tool: "release_tasks",
			task_instance_ids: taskIdsToRelease.join(", "),
		})

		// It's good practice to ask for approval before removing task records,
		// even if they are terminated.
		const didApprove = await askApproval("tool", toolMessage)
		if (!didApprove) {
			pushToolResult(formatResponse.toolError(t("common:errors.user_rejected_tool_use", { toolName: "release_tasks" })))
			return
		}

		const releasedIds: string[] = []
		const notFoundIds: string[] = []
		const stillActiveIds: string[] = []

		for (const taskId of taskIdsToRelease) {
			const taskInstance = Task.activeTasks.get(taskId)
			if (taskInstance) {
				// Only release tasks that are in a terminal state
				if (taskInstance.status === "completed" || taskInstance.status === "failed" || taskInstance.status === "aborted") {
					Task.activeTasks.delete(taskId)
					releasedIds.push(taskId)
					// The calling/orchestrator task should manage its own dispatchedTaskIds list
				} else {
					stillActiveIds.push(taskId)
				}
			} else {
				notFoundIds.push(taskId)
			}
		}

		let resultMessage = ""
		if (releasedIds.length > 0) {
			resultMessage += `Successfully released task records for IDs: ${releasedIds.join(", ")}. `
		}
		if (notFoundIds.length > 0) {
			resultMessage += `Task IDs not found (possibly already released or invalid): ${notFoundIds.join(", ")}. `
		}
		if (stillActiveIds.length > 0) {
			resultMessage += `Task IDs not released because they are still active (status not completed, failed, or aborted): ${stillActiveIds.join(", ")}. `
		}

		if (resultMessage === "") {
			resultMessage = "No tasks were eligible for release or found with the provided IDs."
		}

		pushToolResult(formatResponse.toolSuccess(resultMessage.trim()))

	} catch (error) {
		await handleError(t("tools:releaseTasks.errors.generic", { error: error.message }), error)
		cline.recordToolError("release_tasks", error.message)
		pushToolResult(formatResponse.toolError(t("tools:releaseTasks.errors.generic", { error: error.message })))
		return
	}
}
