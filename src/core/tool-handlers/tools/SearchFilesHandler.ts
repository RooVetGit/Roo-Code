import * as path from "path"
import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { ClineSayTool } from "../../../shared/ExtensionMessage"
import { getReadablePath } from "../../../utils/path"
import { regexSearchFiles } from "../../../services/ripgrep" // Assuming this path is correct
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class SearchFilesHandler extends ToolUseHandler {
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
		if (!this.toolUse.params.path) {
			throw new Error("Missing required parameter 'path'")
		}
		if (!this.toolUse.params.regex) {
			throw new Error("Missing required parameter 'regex'")
		}
		// file_pattern is optional
	}

	protected async handlePartial(): Promise<void> {
		const relDirPath = this.toolUse.params.path
		const regex = this.toolUse.params.regex
		const filePattern = this.toolUse.params.file_pattern
		if (!relDirPath || !regex) return // Need path and regex for message

		const sharedMessageProps: ClineSayTool = {
			tool: "searchFiles",
			path: getReadablePath(this.cline.cwd, this.removeClosingTag("path", relDirPath)),
			regex: this.removeClosingTag("regex", regex),
			filePattern: this.removeClosingTag("file_pattern", filePattern), // Optional
		}

		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			content: "", // No content to show in partial
		} satisfies ClineSayTool)

		try {
			await this.cline.ask("tool", partialMessage, true)
		} catch (error) {
			console.warn("SearchFilesHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const relDirPath = this.toolUse.params.path
		const regex = this.toolUse.params.regex
		const filePattern = this.toolUse.params.file_pattern

		// --- Parameter Validation ---
		if (!relDirPath) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("search_files", "path"),
			)
			return
		}
		if (!regex) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("search_files", "regex"),
			)
			return
		}

		// --- Execute Search ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful validation

			const absolutePath = path.resolve(this.cline.cwd, relDirPath)

			// Prepare shared props for approval message
			const sharedMessageProps: ClineSayTool = {
				tool: "searchFiles",
				path: getReadablePath(this.cline.cwd, relDirPath),
				regex: regex,
				filePattern: filePattern, // Include optional pattern if present
			}

			// Perform the search *before* asking for approval to include results in the prompt
			const results = await regexSearchFiles(
				this.cline.cwd,
				absolutePath,
				regex,
				filePattern, // Pass optional pattern
				this.cline.rooIgnoreController, // Pass ignore controller
			)

			// --- Ask for Approval (with results) ---
			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: results, // Include search results in the approval message
			} satisfies ClineSayTool)

			const didApprove = await this.cline.askApprovalHelper(this.toolUse, "tool", completeMessage)
			if (!didApprove) {
				// pushToolResult handled by helper
				return
			}

			// --- Push Result ---
			await this.cline.pushToolResult(this.toolUse, formatResponse.toolResult(results))
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			// Handle potential errors during regexSearchFiles or approval
			await this.cline.handleErrorHelper(this.toolUse, "searching files", error)
		}
		// No diff provider state to reset for this tool
	}
}
