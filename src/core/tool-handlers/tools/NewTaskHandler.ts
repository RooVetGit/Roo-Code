import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { getModeBySlug, defaultModeSlug } from "../../../shared/modes" // Assuming path
import { telemetryService } from "../../../services/telemetry/TelemetryService"
import delay from "delay"

export class NewTaskHandler extends ToolUseHandler {
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
		if (!this.toolUse.params.mode) {
			throw new Error("Missing required parameter 'mode'")
		}
		if (!this.toolUse.params.message) {
			throw new Error("Missing required parameter 'message'")
		}
	}

	protected async handlePartial(): Promise<void> {
		const mode = this.toolUse.params.mode
		const message = this.toolUse.params.message
		if (!mode || !message) return // Need mode and message for UI

		const partialMessage = JSON.stringify({
			tool: "newTask",
			mode: this.removeClosingTag("mode", mode),
			message: this.removeClosingTag("message", message),
		})

		try {
			await this.cline.ask("tool", partialMessage, true)
		} catch (error) {
			console.warn("NewTaskHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const mode = this.toolUse.params.mode
		const message = this.toolUse.params.message

		// --- Parameter Validation ---
		if (!mode) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("new_task", "mode"),
			)
			return
		}
		if (!message) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("new_task", "message"),
			)
			return
		}

		// --- Execute New Task ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful validation

			const provider = this.cline.providerRef.deref()
			if (!provider) {
				throw new Error("ClineProvider reference is lost.")
			}
			const currentState = await provider.getState() // Get state once

			// Verify the mode exists
			const targetMode = getModeBySlug(mode, currentState?.customModes)
			if (!targetMode) {
				await this.cline.pushToolResult(this.toolUse, formatResponse.toolError(`Invalid mode: ${mode}`))
				return
			}

			// --- Ask for Approval ---
			const toolMessage = JSON.stringify({
				tool: "newTask",
				mode: targetMode.name, // Show mode name
				content: message, // Use 'content' key consistent with UI? Check original askApproval call
			})
			const didApprove = await this.cline.askApprovalHelper(this.toolUse, "tool", toolMessage)
			if (!didApprove) {
				// pushToolResult handled by helper
				return
			}

			// --- Perform New Task Creation ---
			// Preserve current mode for potential resumption (needs isPaused/pausedModeSlug on Cline to be public or handled via methods)
			// this.cline.pausedModeSlug = currentState?.mode ?? defaultModeSlug; // Requires pausedModeSlug to be public/settable

			// Switch mode first
			await provider.handleModeSwitch(mode)
			await delay(500) // Allow mode switch to settle

			// Create new task instance, passing current Cline as parent
			const newCline = await provider.initClineWithTask(message, undefined, this.cline)
			this.cline.emit("taskSpawned", newCline.taskId) // Emit event from parent

			// Pause the current (parent) task (needs isPaused to be public/settable)
			// this.cline.isPaused = true;
			this.cline.emit("taskPaused") // Emit pause event

			// --- Push Result ---
			const resultMessage = `Successfully created new task in ${targetMode.name} mode with message: ${message}`
			await this.cline.pushToolResult(this.toolUse, formatResponse.toolResult(resultMessage))
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)

			// Note: The original code breaks here. The handler should likely return control,
			// and the main loop should handle the paused state based on the emitted event.
			// The handler itself doesn't wait.
		} catch (error: any) {
			// Handle errors during validation, approval, or task creation
			await this.cline.handleErrorHelper(this.toolUse, "creating new task", error)
		}
	}
}
