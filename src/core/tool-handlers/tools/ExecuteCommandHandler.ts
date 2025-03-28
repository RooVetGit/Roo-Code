import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class ExecuteCommandHandler extends ToolUseHandler {
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
		if (!this.toolUse.params.command) {
			throw new Error("Missing required parameter 'command'")
		}
		// cwd is optional
	}

	protected async handlePartial(): Promise<void> {
		const command = this.toolUse.params.command
		if (!command) return // Need command for message

		try {
			// Show command being typed in UI
			await this.cline.ask("command", this.removeClosingTag("command", command), true)
		} catch (error) {
			console.warn("ExecuteCommandHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const command = this.toolUse.params.command
		const customCwd = this.toolUse.params.cwd

		// --- Parameter Validation ---
		if (!command) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("execute_command", "command"),
			)
			return
		}

		// --- Access/Ignore Validation ---
		const ignoredFileAttemptedToAccess = this.cline.rooIgnoreController?.validateCommand(command)
		if (ignoredFileAttemptedToAccess) {
			await this.cline.say("rooignore_error", ignoredFileAttemptedToAccess)
			await this.cline.pushToolResult(
				this.toolUse,
				formatResponse.toolError(formatResponse.rooIgnoreError(ignoredFileAttemptedToAccess)),
			)
			return
		}

		// --- Execute Command ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful validation

			// --- Ask for Approval ---
			const didApprove = await this.cline.askApprovalHelper(this.toolUse, "command", command)
			if (!didApprove) {
				// pushToolResult handled by helper
				return
			}

			// --- Execute via Cline's method ---
			// executeCommandTool handles terminal management, output streaming, and user feedback during execution
			const [userRejectedMidExecution, result] = await this.cline.executeCommandTool(command, customCwd)

			if (userRejectedMidExecution) {
				// If user rejected *during* command execution (via command_output prompt)
				this.cline.didRejectTool = true // Set rejection flag on Cline instance
			}

			// Push the final result (which includes output, status, and any user feedback)
			await this.cline.pushToolResult(this.toolUse, result)
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			// Handle errors during approval or execution
			await this.cline.handleErrorHelper(this.toolUse, "executing command", error)
		}
		// No diff provider state to reset
	}
}
