import * as path from "path"
import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { ClineSayTool } from "../../../shared/ExtensionMessage"
import { getReadablePath } from "../../../utils/path"
import { listFiles } from "../../../services/glob/list-files" // Assuming this path is correct
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class ListFilesHandler extends ToolUseHandler {
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
		// recursive is optional
	}

	protected async handlePartial(): Promise<void> {
		const relDirPath = this.toolUse.params.path
		const recursiveRaw = this.toolUse.params.recursive
		if (!relDirPath) return // Need path for message

		const recursive = this.removeClosingTag("recursive", recursiveRaw)?.toLowerCase() === "true"

		const sharedMessageProps: ClineSayTool = {
			tool: !recursive ? "listFilesTopLevel" : "listFilesRecursive",
			path: getReadablePath(this.cline.cwd, this.removeClosingTag("path", relDirPath)),
		}

		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			content: "", // No content to show in partial
		} satisfies ClineSayTool)

		try {
			await this.cline.ask("tool", partialMessage, true)
		} catch (error) {
			console.warn("ListFilesHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const relDirPath = this.toolUse.params.path
		const recursiveRaw = this.toolUse.params.recursive

		// --- Parameter Validation ---
		if (!relDirPath) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("list_files", "path"),
			)
			return
		}

		// --- Execute List ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful validation

			const recursive = recursiveRaw?.toLowerCase() === "true"
			const absolutePath = path.resolve(this.cline.cwd, relDirPath)

			// Prepare shared props for approval message
			const sharedMessageProps: ClineSayTool = {
				tool: !recursive ? "listFilesTopLevel" : "listFilesRecursive",
				path: getReadablePath(this.cline.cwd, relDirPath),
			}

			// Perform the list operation *before* asking for approval
			// TODO: Consider adding a limit parameter to the tool/handler if needed
			const [files, didHitLimit] = await listFiles(absolutePath, recursive, 200) // Using default limit from original code

			const { showRooIgnoredFiles = true } = (await this.cline.providerRef.deref()?.getState()) ?? {}

			const result = formatResponse.formatFilesList(
				absolutePath,
				files,
				didHitLimit,
				this.cline.rooIgnoreController, // Pass ignore controller
				showRooIgnoredFiles,
			)

			// --- Ask for Approval (with results) ---
			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: result, // Include list results in the approval message
			} satisfies ClineSayTool)

			const didApprove = await this.cline.askApprovalHelper(this.toolUse, "tool", completeMessage)
			if (!didApprove) {
				// pushToolResult handled by helper
				return
			}

			// --- Push Result ---
			await this.cline.pushToolResult(this.toolUse, formatResponse.toolResult(result))
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			// Handle potential errors during listFiles or approval
			await this.cline.handleErrorHelper(this.toolUse, "listing files", error)
		}
		// No diff provider state to reset
	}
}
