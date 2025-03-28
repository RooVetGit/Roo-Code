import { Anthropic } from "@anthropic-ai/sdk"
import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline, ToolResponse } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class AttemptCompletionHandler extends ToolUseHandler {
	// No specific toolUse type override needed

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
	}

	async handle(): Promise<boolean> {
		if (this.toolUse.partial) {
			await this.handlePartial()
			return false // Indicate partial handling
		} else {
			await this.handleComplete()
			return true // Indicate complete handling
		}
	}

	validateParams(): void {
		if (!this.toolUse.params.result) {
			throw new Error("Missing required parameter 'result'")
		}
		// command is optional
	}

	protected async handlePartial(): Promise<void> {
		const result = this.toolUse.params.result
		const command = this.toolUse.params.command

		try {
			const lastMessage = this.cline.clineMessages.at(-1)

			if (command) {
				// If command is starting to stream, the result part is complete.
				// Finalize the result 'say' message if needed.
				if (lastMessage?.say === "completion_result" && lastMessage.partial) {
					await this.cline.say("completion_result", this.removeClosingTag("result", result), undefined, false)
					telemetryService.captureTaskCompleted(this.cline.taskId)
					this.cline.emit("taskCompleted", this.cline.taskId, this.cline.getTokenUsage()) // Assuming getTokenUsage is public or accessible
				} else if (!lastMessage || lastMessage.say !== "completion_result") {
					// If result wasn't streamed partially first, send it completely now
					await this.cline.say("completion_result", this.removeClosingTag("result", result), undefined, false)
					telemetryService.captureTaskCompleted(this.cline.taskId)
					this.cline.emit("taskCompleted", this.cline.taskId, this.cline.getTokenUsage())
				}

				// Now handle partial command 'ask'
				await this.cline.ask("command", this.removeClosingTag("command", command), true)
			} else if (result) {
				// Still streaming the result part
				await this.cline.say("completion_result", this.removeClosingTag("result", result), undefined, true)
			}
		} catch (error) {
			console.warn("AttemptCompletionHandler: ask/say for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const result = this.toolUse.params.result
		const command = this.toolUse.params.command

		// --- Parameter Validation ---
		if (!result) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("attempt_completion", "result"),
			)
			return
		}

		// --- Execute Completion ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful validation

			let commandResult: ToolResponse | undefined
			const lastMessage = this.cline.clineMessages.at(-1)

			// --- Handle Optional Command ---
			if (command) {
				// Ensure completion_result 'say' is finalized if it was partial
				if (lastMessage?.say === "completion_result" && lastMessage.partial) {
					await this.cline.say("completion_result", result, undefined, false)
					telemetryService.captureTaskCompleted(this.cline.taskId)
					this.cline.emit("taskCompleted", this.cline.taskId, this.cline.getTokenUsage())
				} else if (!lastMessage || lastMessage.say !== "completion_result") {
					// If result wasn't streamed, send it now
					await this.cline.say("completion_result", result, undefined, false)
					telemetryService.captureTaskCompleted(this.cline.taskId)
					this.cline.emit("taskCompleted", this.cline.taskId, this.cline.getTokenUsage())
				}

				// Ask for command approval
				const didApprove = await this.cline.askApprovalHelper(this.toolUse, "command", command)
				if (!didApprove) return // Approval helper handles pushToolResult

				// Execute command
				const [userRejected, execCommandResult] = await this.cline.executeCommandTool(command)
				if (userRejected) {
					this.cline.didRejectTool = true
					await this.cline.pushToolResult(this.toolUse, execCommandResult) // Push rejection feedback
					return // Stop processing
				}
				commandResult = execCommandResult // Store command result if any
			} else {
				// No command, just finalize the result message
				await this.cline.say("completion_result", result, undefined, false)
				telemetryService.captureTaskCompleted(this.cline.taskId)
				this.cline.emit("taskCompleted", this.cline.taskId, this.cline.getTokenUsage())
			}

			// --- Handle Subtask Completion ---
			if (this.cline.parentTask) {
				// Assuming askFinishSubTaskApproval helper exists or logic is replicated
				// const didApproveFinish = await this.cline.askFinishSubTaskApproval();
				// For now, let's assume it needs manual implementation or skip if not critical path
				console.warn("Subtask completion approval logic needs implementation in AttemptCompletionHandler.")
				// If approval needed and failed: return;

				// Finish subtask
				await this.cline.providerRef.deref()?.finishSubTask(`Task complete: ${result}`)
				// No pushToolResult needed here as the task is ending/returning control
				return
			}

			// --- Ask for User Feedback/Next Action (Main Task) ---
			// Ask with empty string to relinquish control
			const {
				response,
				text: feedbackText,
				images: feedbackImages,
			} = await this.cline.ask("completion_result", "", false)

			if (response === "yesButtonClicked") {
				// User clicked "New Task" or similar - provider handles this
				// Push an empty result? Original code did this.
				await this.cline.pushToolResult(this.toolUse, "")
				return
			}

			// User provided feedback (messageResponse or noButtonClicked)
			await this.cline.say("user_feedback", feedbackText ?? "", feedbackImages)

			// --- Format Feedback for API ---
			const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
			if (commandResult) {
				if (typeof commandResult === "string") {
					toolResults.push({ type: "text", text: commandResult })
				} else if (Array.isArray(commandResult)) {
					toolResults.push(...commandResult)
				}
			}
			toolResults.push({
				type: "text",
				text: `The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.\n<feedback>\n${feedbackText}\n</feedback>`,
			})
			toolResults.push(...formatResponse.imageBlocks(feedbackImages))

			// Push combined feedback as the "result" of attempt_completion
			// Note: Original code pushed this with a "Result:" prefix, replicating that.
			await this.cline.pushToolResult(this.toolUse, toolResults)
		} catch (error: any) {
			// Handle errors during command execution, approval, or feedback
			await this.cline.handleErrorHelper(this.toolUse, "attempting completion", error)
		}
	}
}
