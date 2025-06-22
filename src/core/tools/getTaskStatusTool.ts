import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolResponse } from "../../shared/tools"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"

export async function getTaskStatusTool(
	cline: Task, // The calling Task instance
	block: ToolUse, // Parsed tool use from LLM
	askApproval: AskApproval, // Not typically needed for a read-only status check
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const taskIdsParam: string | undefined = block.params.task_instance_ids

	try {
		if (block.partial) {
			// For a status check, partial streaming might not be very useful,
			// but handle it consistently.
			const partialData = {
				tool: "get_task_status",
				task_instance_ids: removeClosingTag("task_instance_ids", taskIdsParam),
			}
			await cline.say("tool_in_progress", JSON.stringify(partialData), undefined, true)
			return
		}

		if (!taskIdsParam) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("get_task_status")
			pushToolResult(await cline.sayAndCreateMissingParamError("get_task_status", "task_instance_ids"))
			return
		}

		cline.consecutiveMistakeCount = 0

		// Assuming task_instance_ids is a comma-separated string of IDs
		const taskIds = taskIdsParam.split(",").map(id => id.trim()).filter(id => id)

		if (taskIds.length === 0) {
			pushToolResult(formatResponse.toolError("No task instance IDs provided."))
			cline.recordToolError("get_task_status", "No task instance IDs provided")
			return
		}

		const statuses: Record<string, string> = {}
		let allFound = true

		for (const taskId of taskIds) {
			const taskInstance = Task.activeTasks.get(taskId)
			if (taskInstance) {
				statuses[taskId] = taskInstance.status
			} else {
				// If not in activeTasks, it might have completed/failed already and been removed.
				// Or it's an invalid ID. For now, mark as 'unknown' or try to find in history.
				// This part might need refinement if we need to query historical/non-active tasks.
				// For this iteration, "unknown" if not active is a starting point.
				// A more robust solution would be to check a persistent store or the history if the task is not active.
				// However, the task plan mentioned `Task.activeTasks.delete(this.taskId)` upon completion/failure.
				// This implies that if a task is not in `activeTasks`, it's considered terminal.
				// We need a way to get the *final* status if it was removed.
				// For now, if it's not in activeTasks, we'll assume it's "completed" or "failed" if we can't find its final state.
				// This part is tricky because the task removes itself from activeTasks upon completion/failure.
				// The `consolidate_results` tool will need a more robust way to get final results.
				// For `get_task_status`, if it's not active, its status is effectively its terminal state.
				// Let's assume for now that if it's not in activeTasks, we can't get a live status,
				// and it's up to `consolidate_results` to get final outcomes.
				// So, if not found in activeTasks, its current "live" status is effectively 'unknown' or 'terminated'.
				// The prompt for the tool should clarify it checks active tasks.
				// A better approach: The Task events for completion/failure should also update a persistent status if needed.
				// For now, let's keep it simple: if not in activeTasks, its status is what it was when it left.
				// This is a simplification. A truly robust status system might need tasks to log their final state somewhere
				// if they are removed from `activeTasks`.
				// Given the current setup where tasks remove themselves from `activeTasks` upon termination:
				// We can't reliably get a 'completed' or 'failed' status here for tasks already terminated *unless*
				// we check another source (e.g. task history, or a new service).
				// The plan states: "Task status is 'completed'" or "'failed'".
				// This implies the `task.status` property IS the source of truth.
				// So, if a task is NOT in `activeTasks` it means it already finished (completed, failed, aborted).
				// We need a way to query that final status.
				// This is a design flaw in removing from activeTasks immediately.
				// Alternative: activeTasks stores ALL tasks ever created in this session, and status is the source of truth.
				// Or, Task.status is updated, and it remains in activeTasks until consolidated or explicitly cleaned up.
				// For now, let's assume `Task.activeTasks` holds tasks that are 'pending' or 'running'.
				// If a task ID is not in `Task.activeTasks`, we cannot determine its status via this mechanism.
				// This means `get_task_status` is for *currently active* tasks.
				// The description of the tool for the LLM should reflect this.

				// Let's adjust the logic: if not in activeTasks, we cannot provide a live status.
				// The LLM should be guided to use this for tasks it expects to be still running.
				// `consolidate_results` will be the one to get final outcomes.
				statuses[taskId] = "unknown (not actively running or ID invalid)"
				// allFound = false; // Decided against this, let it return status for found ones.
			}
		}

		// if (!allFound && taskIds.length === 1) {
		// pushToolResult(formatResponse.toolError(`Task with ID ${taskIds[0]} not found or not active.`))
		// return
		// }

		pushToolResult(formatResponse.toolSuccess(JSON.stringify(statuses)))

	} catch (error) {
		await handleError(t("tools:getTaskStatus.errors.generic", { error: error.message }), error)
		cline.recordToolError("get_task_status", error.message)
		pushToolResult(formatResponse.toolError(t("tools:getTaskStatus.errors.generic", { error: error.message })))
		return
	}
}
