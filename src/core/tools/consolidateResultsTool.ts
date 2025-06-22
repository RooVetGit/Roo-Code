import pWaitFor from "p-wait-for"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolResponse } from "../../shared/tools"
import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"

export async function consolidateResultsTool(
	cline: Task, // The calling Task instance
	block: ToolUse, // Parsed tool use from LLM
	askApproval: AskApproval, // May not be needed if consolidation is an automatic internal step
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const taskIdsParam: string | undefined = block.params.task_instance_ids

	try {
		if (block.partial) {
			const partialData = {
				tool: "consolidate_results",
				task_instance_ids: removeClosingTag("task_instance_ids", taskIdsParam),
			}
			await cline.say("tool_in_progress", JSON.stringify(partialData), undefined, true)
			return
		}

		if (!taskIdsParam) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("consolidate_results")
			pushToolResult(await cline.sayAndCreateMissingParamError("consolidate_results", "task_instance_ids"))
			return
		}

		cline.consecutiveMistakeCount = 0
		const taskIdsToConsolidate = taskIdsParam.split(",").map(id => id.trim()).filter(id => id)

		if (taskIdsToConsolidate.length === 0) {
			pushToolResult(formatResponse.toolError("No task instance IDs provided for consolidation."))
			cline.recordToolError("consolidate_results", "No task instance IDs provided")
			return
		}

		// This tool is blocking. Inform the user.
		await cline.say("text", `Waiting for tasks to complete: ${taskIdsToConsolidate.join(", ")}...`, undefined, false, undefined, "in_progress")

		const results: Record<string, { status: string; result: string | null }> = {}
		const consolidationTimeoutMs = 300_000 // 5 minutes timeout for all tasks to complete, adjust as needed
		const individualTaskCheckIntervalMs = 500 // How often to check each task's status

		await Promise.all(
			taskIdsToConsolidate.map(async (taskId) => {
				try {
					await pWaitFor(
						() => {
							const taskInstance = Task.activeTasks.get(taskId)
							return taskInstance?.status === "completed" || taskInstance?.status === "failed" || taskInstance?.status === "aborted"
						},
						{
							interval: individualTaskCheckIntervalMs,
							timeout: consolidationTimeoutMs / taskIdsToConsolidate.length, // Crude per-task timeout
							message: `Timeout waiting for task ${taskId} to complete.`
						}
					)
					const taskInstance = Task.activeTasks.get(taskId)
					if (taskInstance) {
						results[taskId] = {
							status: taskInstance.status,
							result: taskInstance.finalResult,
						}
						// Optional: Clean up task from activeTasks after consolidation
						// Task.activeTasks.delete(taskId)
						// cline.dispatchedTaskIds.delete(taskId) // Also remove from parent's tracking set
					} else {
						// Should not happen if pWaitFor resolved based on status, unless task was removed by another process.
						results[taskId] = {
							status: "unknown",
							result: "Task instance not found after waiting.",
						}
					}
				} catch (error) {
					results[taskId] = {
						status: "timeout_or_error",
						result: error.message || "Error during consolidation wait.",
					}
				}
			})
		)

		// Update progress status to complete
		await cline.say("text", `Consolidation complete for tasks: ${taskIdsToConsolidate.join(", ")}.`, undefined, false, undefined, "complete")


		pushToolResult(formatResponse.toolSuccess(JSON.stringify(results)))

	} catch (error) {
		await handleError(t("tools:consolidateResults.errors.generic", { error: error.message }), error)
		cline.recordToolError("consolidate_results", error.message)
		// Ensure progress is marked as error if the tool itself fails
		await cline.say("text", `Error during task consolidation: ${error.message}`, undefined, false, undefined, "error")
		pushToolResult(formatResponse.toolError(t("tools:consolidateResults.errors.generic", { error: error.message })))
		return
	}
}
