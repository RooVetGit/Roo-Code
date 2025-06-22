import Anthropic from "@anthropic-ai/sdk"

import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"
import {
	ToolResponse,
	ToolUse,
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	ToolDescription,
	AskFinishSubTaskApproval,
} from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

export async function attemptCompletionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
	toolDescription: ToolDescription,
	askFinishSubTaskApproval: AskFinishSubTaskApproval,
) {
	const result: string | undefined = block.params.result
	const command: string | undefined = block.params.command

	try {
		const lastMessage = cline.clineMessages.at(-1)

		if (block.partial) {
			if (command) {
				// the attempt_completion text is done, now we're getting command
				// remove the previous partial attempt_completion ask, replace with say, post state to webview, then stream command

				// const secondLastMessage = cline.clineMessages.at(-2)
				if (lastMessage && lastMessage.ask === "command") {
					// update command
					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				} else {
					// last message is completion_result
					// we have command string, which means we have the result as well, so finish it (doesnt have to exist yet)
					await cline.say("completion_result", removeClosingTag("result", result), undefined, false)

					TelemetryService.instance.captureTaskCompleted(cline.taskId)
					cline.emit("taskCompleted", cline.taskId, cline.getTokenUsage(), cline.toolUsage)

					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				}
			} else {
				// no command, still outputting partial result
				await cline.say("completion_result", removeClosingTag("result", result), undefined, block.partial)
			}
			return
		} else {
			if (!result) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("attempt_completion")
				pushToolResult(await cline.sayAndCreateMissingParamError("attempt_completion", "result"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Command execution is permanently disabled in attempt_completion
			// Users must use execute_command tool separately before attempt_completion
			await cline.say("completion_result", result, undefined, false)

			cline.finalResult = result // Set the final result on the task instance

			TelemetryService.instance.captureTaskCompleted(cline.taskId)
			// Emitting taskCompleted will trigger the handler in Task.ts to set status = "completed"
			// Note: The task remains in Task.activeTasks
			cline.emit("taskCompleted", cline.taskId, cline.getTokenUsage(), cline.toolUsage)

			const provider = cline.providerRef.deref()
			if (!provider) {
				// Should not happen, but good to check
				await handleError("attempt_completion", new Error("Provider reference lost"))
				return
			}

			const { taskCompletionMediatorModeEnabled, taskCompletionMediatorAgentMode } = await provider.getState()

			if (taskCompletionMediatorModeEnabled) {
				const mediatorInput = {
					originalTaskId: cline.taskId,
					originalParentId: cline.parentTask?.taskId || null,
					originalResult: result,
				}
				const mediatorMessage = JSON.stringify(mediatorInput)

				const originalParentTaskInstance = cline.parentTask;

				if (originalParentTaskInstance) {
					originalParentTaskInstance.isAwaitingMediation = true
					provider.log(`[Mediator] Task ${cline.taskId} completed. Parent ${originalParentTaskInstance.taskId} now awaiting mediation.`)
				} else {
					provider.log(`[Mediator] Root task ${cline.taskId} completed. Initiating mediator task (as new root).`)
				}

				const originalModeOfProvider = (await provider.getState()).mode ?? defaultModeSlug;
				await provider.handleModeSwitch(taskCompletionMediatorAgentMode);
				await new Promise(resolve => setTimeout(resolve, 100)); // Ensure mode switch is processed

				// Launch mediator:
				// - If originalParentTaskInstance exists, mediator is its child.
				// - If not (cline was a root task), mediator is a new root task.
				const mediatorTaskParent = originalParentTaskInstance || undefined;
				const mediatorTask = await provider.initClineWithTask(mediatorMessage, undefined, mediatorTaskParent, {});

				if (!mediatorTask) {
					await handleError("attempt_completion", new Error("Failed to create mediator task."));
					if (originalParentTaskInstance) originalParentTaskInstance.isAwaitingMediation = false;
					await provider.handleModeSwitch(originalModeOfProvider); // Switch back mode
					return;
				}
				provider.log(`[Mediator] Mediator task ${mediatorTask.taskId} (parent: ${mediatorTaskParent?.taskId || 'none'}) created in mode '${taskCompletionMediatorAgentMode}'.`);

				// Restore provider's mode if it was changed for the mediator.
				// This is important if the completingTask's own completion processing by the provider might be affected by the mode.
				// However, the completingTask (`cline`) will be terminated shortly.
				// The active mode should remain `taskCompletionMediatorAgentMode` for the mediator.
				// If `originalParentTaskInstance` was null, this means the mediator is now the primary task.
				// If `originalParentTaskInstance` exists, it will resume in its own original mode when the mediator calls `resume_parent_task`.
				// So, no need to switch back `originalModeOfProvider` here. The provider is now set for the mediator.

				// Terminate the current task (cline) cleanly.
				// Its result is passed to the mediator. It should not proceed to call finishSubTask.
				// We can set a special status and prevent further actions.
				cline.status = "completed_pending_mediation" as any; // Add this to status types if persisted
				cline.finalResult = `Handed off to mediator. Original result: ${result}`;
				// No call to provider.finishSubTask(result) for cline.
				// The task `cline` is now effectively done. Its parent (if any, which is originalParentTaskInstance)
				// will not be resumed by `cline`'s completion, but by the mediator.
				// If `cline` itself was the root, the mediator effectively becomes the new primary flow.

				// We need to ensure that `cline` is popped from the stack correctly if it's a sub-task
				// without triggering the standard parent resumption.
				// `attemptCompletionTool` is called from `presentAssistantMessage`.
				// After this tool returns, `presentAssistantMessage` might try to do more.
				// The `return;` here ensures this tool's execution path stops.
				// The `cline` (completing task) itself will be on the `clineStack`.
				// If `mediatorTaskParent` is `originalParentTaskInstance`, then `mediatorTask` is pushed onto the stack.
				// When `mediatorTask` finishes, it pops, and `originalParentTaskInstance` is at top.
				// If `mediatorTaskParent` is `undefined`, `mediatorTask` becomes a new root stack.
				// What happens to `cline` on the stack?
				// If `cline` was `taskA` (child of `root`), and `originalParentTaskInstance` is `root`.
				// Mediator becomes child of `root`. `taskA` is still on stack below mediator.
				// This needs careful handling of `clineStack` in `ClineProvider`.

				// Revised thought: `cline` (completing task) should be removed from stack by its `provider.finishSubTask`
				// but `finishSubTask` needs to know NOT to resume `cline.parentTask` if mediation is involved.
				// The `isAwaitingMediation` flag on `cline.parentTask` already handles this.
				// So, `cline` can complete "normally" after this point, its `finishSubTask` will be called.
				// `finishSubTask` will see `cline.parentTask.isAwaitingMediation` is true and not resume it.

				// So, the `return;` is correct. `cline` has done its part.
				// The system state (`isAwaitingMediation`, `mediatedResultForResumption`) will handle the rest.
				return;
			}

			// --- Original logic if mediator mode is NOT enabled ---
			if (cline.parentTask) {
				const didApprove = await askFinishSubTaskApproval()

				if (!didApprove) {
					return
				}

				// tell the provider to remove the current subtask and resume the previous task in the stack
				await provider.finishSubTask(result)
				return
			}

			// We already sent completion_result says, an
			// empty string asks relinquishes control over
			// button and field.
			const { response, text, images } = await cline.ask("completion_result", "", false)

			// Signals to recursive loop to stop (for now
			// cline never happens since yesButtonClicked
			// will trigger a new task).
			if (response === "yesButtonClicked") {
				pushToolResult("")
				return
			}

			await cline.say("user_feedback", text ?? "", images)
			const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []

			toolResults.push({
				type: "text",
				text: `The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
			})

			toolResults.push(...formatResponse.imageBlocks(images))
			cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })
			cline.userMessageContent.push(...toolResults)

			return
		}
	} catch (error) {
		await handleError("inspecting site", error)
		return
	}
}
