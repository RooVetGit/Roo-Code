import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { Task } from "../task/Task"
import { ClineProvider } from "../webview/ClineProvider" // May need provider access
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"

export async function resumeParentTaskTool(
	cline: Task, // This is the Mediator Task instance
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const originalParentId: string | null = block.params.original_parent_id === "null" ? null : block.params.original_parent_id
	const mediatedResult: string | undefined = block.params.mediated_result

	try {
		if (block.partial) {
			const partialData = {
				tool: "resume_parent_task",
				original_parent_id: removeClosingTag("original_parent_id", originalParentId),
				mediated_result: removeClosingTag("mediated_result", mediatedResult),
			}
			await cline.say("tool_in_progress", JSON.stringify(partialData), undefined, true)
			return
		}

		if (mediatedResult === undefined) { // original_parent_id can be null, but result is essential
			cline.consecutiveMistakeCount++
			cline.recordToolError("resume_parent_task")
			pushToolResult(await cline.sayAndCreateMissingParamError("resume_parent_task", "mediated_result"))
			return
		}

		cline.consecutiveMistakeCount = 0

		const toolMessage = JSON.stringify({
			tool: "resume_parent_task",
			original_parent_id: originalParentId,
			mediated_result: mediatedResult,
		})

		const didApprove = await askApproval("tool", toolMessage)
		if (!didApprove) {
			pushToolResult(formatResponse.toolError(t("common:errors.user_rejected_tool_use", { toolName: "resume_parent_task" })))
			return
		}

		const provider = cline.providerRef.deref()
		if (!provider) {
			throw new Error("ClineProvider reference lost from mediator task")
		}

		if (originalParentId) {
			const originalParentTask = Task.activeTasks.get(originalParentId)

			if (!originalParentTask) {
				pushToolResult(formatResponse.toolError(`Original parent task with ID '${originalParentId}' not found.`))
				cline.recordToolError("resume_parent_task", `Original parent task ${originalParentId} not found.`)
				return
			}

			if (!originalParentTask.isAwaitingMediation) {
				pushToolResult(formatResponse.toolError(`Original parent task '${originalParentId}' was not awaiting mediation.`))
				cline.recordToolError("resume_parent_task", `Original parent task ${originalParentId} not awaiting mediation.`)
				return
			}

			originalParentTask.isAwaitingMediation = false

			// To correctly resume, the originalParentTask needs to become the current task on the stack
			// and then be unpaused.
			// This might be complex if the mediator task is a child of the *completing* task,
			// and the originalParentTask is further down the stack.
			// `finishSubTask` on the mediator task (`cline`) should pop it.
			// Then, if `originalParentTask` is now at the top of the stack, it can be resumed.

			// For now, let's assume `originalParentTask.resumePausedTask` will make it active if it's the current one.
			// The crucial part is that `finishSubTask` for the *mediator* task needs to happen AFTER this tool logic.
			// This tool's success means the mediator's job is done.

			// The `resumePausedTask` method handles unsetting `isPaused` and processing the message.
			// We need to ensure the task stack in ClineProvider is managed correctly.
			// When the mediator task (current `cline`) calls `attempt_completion` after this tool,
			// its `finishSubTask` will be called. If its parent was the `completingTask`, that one would resume.
			// This is not what we want.

			// We need a way for the provider to switch active context back to originalParentTask
			// and then feed it the result.

			provider.log(`[Mediator] Resuming original parent task ${originalParentId} with mediated result.`)

			// This is a conceptual step. The actual mechanism might need provider involvement
			// to manage the task stack correctly and make originalParentTask the active one to resume.
			// A simple direct call might not be enough if originalParentTask is not clineStack.getCurrentCline().

			// Let's try a more direct approach assuming the `originalParentTask` can be directly "woken up".
			// This assumes `resumePausedTask` can handle being called on a non-top-of-stack task
			// if the provider's current task logic is adjusted, or if `finishSubTask` of the mediator
			// correctly pops to the original parent.

			// The mediator task (`cline`) will complete after this. Its parent is the `completingTask`.
			// When `cline` (mediator) completes, `finishSubTask` will be called for it.
			// `provider.finishSubTask` will pop `cline`, then attempt to resume `cline.parentTask` (the `completingTask`).
			// This is fine. The `completingTask` will then also complete (as its `attempt_completion` was the trigger).
			// When `completingTask` finishes, `provider.finishSubTask` is called for it.
			// This will pop `completingTask`. Its parent is `originalParentTask`.
			// Now `originalParentTask` is at the top. `provider.finishSubTask` for `completingTask` will call
			// `originalParentTask.resumePausedTask(mediatedResult)` because `isAwaitingMediation` is now false.
			// This seems like a plausible flow. The key is that `mediatedResult` must be passed along.

			// So, this tool's job is primarily to:
			// 1. Mark `originalParentTask.isAwaitingMediation = false`. (Done earlier)
			// 2. Store `mediatedResult` on the `originalParentTask` so `ClineProvider.finishSubTask` can use it.

			originalParentTask.mediatedResultForResumption = mediatedResult;

			pushToolResult(formatResponse.toolSuccess(`Original parent task '${originalParentId}' is now set to resume with the new result. Mediator task should now complete.`))

			// The mediator task should now call attempt_completion with a message indicating its success.
			// Example: "Mediator processing complete. Original parent task ${originalParentId} will now resume."

		} else {
			// Original task was a root task. Mediator is effectively the new "main" result.
			provider.log(`[Mediator] Original task was a root task. Mediator result: ${mediatedResult}`)
			// The mediator can just say this result.
			await cline.say("text", `Mediator result (original was root task): ${mediatedResult}`)
			pushToolResult(formatResponse.toolSuccess("Mediator processed result for original root task."))
		}

	} catch (error) {
		await handleError(t("tools:resumeParentTask.errors.generic", { error: error.message }), error)
		cline.recordToolError("resume_parent_task", error.message)
		pushToolResult(formatResponse.toolError(t("tools:resumeParentTask.errors.generic", { error: error.message })))
		return
	}
}
