import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { getModeBySlug, defaultModeSlug } from "../../../shared/modes" // Assuming path
import { telemetryService } from "../../../services/telemetry/TelemetryService"
import delay from "delay"

export class SwitchModeHandler extends ToolUseHandler {
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
		if (!this.toolUse.params.mode_slug) {
			throw new Error("Missing required parameter 'mode_slug'")
		}
		// reason is optional
	}

	protected async handlePartial(): Promise<void> {
		const modeSlug = this.toolUse.params.mode_slug
		const reason = this.toolUse.params.reason
		if (!modeSlug) return // Need mode_slug for message

		const partialMessage = JSON.stringify({
			tool: "switchMode",
			mode: this.removeClosingTag("mode_slug", modeSlug),
			reason: this.removeClosingTag("reason", reason), // Optional
		})

		try {
			await this.cline.ask("tool", partialMessage, true)
		} catch (error) {
			console.warn("SwitchModeHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const modeSlug = this.toolUse.params.mode_slug
		const reason = this.toolUse.params.reason

		// --- Parameter Validation ---
		if (!modeSlug) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("switch_mode", "mode_slug"),
			)
			return
		}

		// --- Execute Switch ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful validation

			const provider = this.cline.providerRef.deref()
			if (!provider) {
				throw new Error("ClineProvider reference is lost.")
			}
			const currentState = await provider.getState() // Get current state once

			// Verify the mode exists
			const targetMode = getModeBySlug(modeSlug, currentState?.customModes)
			if (!targetMode) {
				await this.cline.pushToolResult(this.toolUse, formatResponse.toolError(`Invalid mode: ${modeSlug}`))
				return
			}

			// Check if already in requested mode
			const currentModeSlug = currentState?.mode ?? defaultModeSlug
			if (currentModeSlug === modeSlug) {
				await this.cline.pushToolResult(
					this.toolUse,
					formatResponse.toolResult(`Already in ${targetMode.name} mode.`),
				)
				return
			}

			// --- Ask for Approval ---
			const completeMessage = JSON.stringify({
				tool: "switchMode",
				mode: modeSlug, // Use validated slug
				reason,
			})

			const didApprove = await this.cline.askApprovalHelper(this.toolUse, "tool", completeMessage)
			if (!didApprove) {
				// pushToolResult handled by helper
				return
			}

			// --- Perform Switch ---
			await provider.handleModeSwitch(modeSlug) // Call provider method

			// --- Push Result ---
			const currentModeName = getModeBySlug(currentModeSlug, currentState?.customModes)?.name ?? currentModeSlug
			const resultMessage = `Successfully switched from ${currentModeName} mode to ${targetMode.name} mode${reason ? ` because: ${reason}` : ""}.`
			await this.cline.pushToolResult(this.toolUse, formatResponse.toolResult(resultMessage))
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)

			// Delay to allow mode change to potentially affect subsequent actions
			await delay(500)
		} catch (error: any) {
			// Handle errors during validation, approval, or switch
			await this.cline.handleErrorHelper(this.toolUse, "switching mode", error)
		}
	}
}
