import * as path from "path"
import * as fs from "fs/promises"
import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { ClineSayTool } from "../../../shared/ExtensionMessage"
import { getReadablePath } from "../../../utils/path"
import { parseSourceCodeDefinitionsForFile, parseSourceCodeForDefinitionsTopLevel } from "../../../services/tree-sitter" // Assuming this path is correct
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class ListCodeDefinitionNamesHandler extends ToolUseHandler {
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
	}

	protected async handlePartial(): Promise<void> {
		const relPath = this.toolUse.params.path
		if (!relPath) return // Need path for message

		const sharedMessageProps: ClineSayTool = {
			tool: "listCodeDefinitionNames",
			path: getReadablePath(this.cline.cwd, this.removeClosingTag("path", relPath)),
		}

		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			content: "", // No content to show in partial
		} satisfies ClineSayTool)

		try {
			await this.cline.ask("tool", partialMessage, true)
		} catch (error) {
			console.warn("ListCodeDefinitionNamesHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const relPath = this.toolUse.params.path

		// --- Parameter Validation ---
		if (!relPath) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("list_code_definition_names", "path"),
			)
			return
		}

		// --- Execute Parse ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful validation

			const absolutePath = path.resolve(this.cline.cwd, relPath)

			// Prepare shared props for approval message
			const sharedMessageProps: ClineSayTool = {
				tool: "listCodeDefinitionNames",
				path: getReadablePath(this.cline.cwd, relPath),
			}

			let result: string
			try {
				const stats = await fs.stat(absolutePath)
				if (stats.isFile()) {
					// Check access before parsing file
					const accessAllowed = this.cline.rooIgnoreController?.validateAccess(relPath)
					if (!accessAllowed) {
						await this.cline.say("rooignore_error", relPath)
						await this.cline.pushToolResult(
							this.toolUse,
							formatResponse.toolError(formatResponse.rooIgnoreError(relPath)),
						)
						return
					}
					const fileResult = await parseSourceCodeDefinitionsForFile(
						absolutePath,
						this.cline.rooIgnoreController, // Pass ignore controller
					)
					result = fileResult ?? "No source code definitions found in this file."
				} else if (stats.isDirectory()) {
					// Directory parsing handles ignore checks internally via parseSourceCodeDefinitionsForFile
					result = await parseSourceCodeForDefinitionsTopLevel(
						absolutePath,
						this.cline.rooIgnoreController, // Pass ignore controller
					)
				} else {
					result = "The specified path is neither a file nor a directory."
				}
			} catch (error: any) {
				if (error.code === "ENOENT") {
					result = `${absolutePath}: does not exist or cannot be accessed.`
				} else {
					// Re-throw other errors to be caught by the outer try-catch
					throw error
				}
			}

			// --- Ask for Approval (with results) ---
			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: result, // Include parse results in the approval message
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
			// Handle potential errors during parsing or approval
			await this.cline.handleErrorHelper(this.toolUse, "parsing source code definitions", error)
		}
		// No diff provider state to reset
	}
}
