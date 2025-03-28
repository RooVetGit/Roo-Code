import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
// Import the existing tool logic function
import { fetchInstructionsTool } from "../../tools/fetchInstructionsTool" // Adjusted path relative to this handler file
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class FetchInstructionsHandler extends ToolUseHandler {
	// No specific toolUse type override needed

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
	}

	async handle(): Promise<boolean> {
		// This tool likely doesn't have a meaningful partial state beyond showing the tool name
		if (this.toolUse.partial) {
			await this.handlePartial()
			return false // Indicate partial handling
		} else {
			// The actual logic is synchronous or handled within fetchInstructionsTool
			// We await it here for consistency, though it might resolve immediately
			await this.handleComplete()
			// fetchInstructionsTool calls pushToolResult internally, so the result is pushed.
			// We return true because the tool action (fetching and pushing result) is complete.
			return true // Indicate complete handling
		}
	}

	validateParams(): void {
		// Validation is likely handled within fetchInstructionsTool, but basic check here
		if (!this.toolUse.params.task) {
			throw new Error("Missing required parameter 'task'")
		}
	}

	protected async handlePartial(): Promise<void> {
		const task = this.toolUse.params.task
		if (!task) return

		// Simple partial message showing the tool being used
		const partialMessage = JSON.stringify({
			tool: "fetchInstructions",
			task: this.removeClosingTag("task", task),
		})

		try {
			// Using 'tool' ask type for consistency, though original might not have shown UI for this
			await this.cline.ask("tool", partialMessage, true)
		} catch (error) {
			console.warn("FetchInstructionsHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		// --- Execute Fetch ---
		try {
			// Call the existing encapsulated logic function
			// Pass the Cline instance, the toolUse block, and the helper methods
			await fetchInstructionsTool(
				this.cline,
				this.toolUse,
				// Pass helper methods bound to the Cline instance
				(type, msg, status) => this.cline.askApprovalHelper(this.toolUse, type, msg, status),
				(action, error) => this.cline.handleErrorHelper(this.toolUse, action, error),
				(content) => this.cline.pushToolResult(this.toolUse, content),
			)
			// No need to call pushToolResult here, as fetchInstructionsTool does it.
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			// Although fetchInstructionsTool has its own error handling via the passed helper,
			// catch any unexpected errors during the call itself.
			console.error("Unexpected error calling fetchInstructionsTool:", error)
			// Use the standard error helper
			await this.cline.handleErrorHelper(this.toolUse, "fetching instructions", error)
		}
	}
}
