import * as path from "path"
import * as vscode from "vscode"
import { ToolUse, WriteToFileToolUse } from "../../assistant-message"
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { ClineSayTool, ToolProgressStatus } from "../../../shared/ExtensionMessage"
import { getReadablePath } from "../../../utils/path" // Keep this one
import { isPathOutsideWorkspace } from "../../../utils/pathUtils" // Import from pathUtils
import { fileExistsAtPath } from "../../../utils/fs"
import { detectCodeOmission } from "../../../integrations/editor/detect-omission"
import { everyLineHasLineNumbers, stripLineNumbers } from "../../../integrations/misc/extract-text"
import { telemetryService } from "../../../services/telemetry/TelemetryService" // Corrected path
import delay from "delay"

export class WriteToFileHandler extends ToolUseHandler {
	// Type assertion for specific tool use
	protected override toolUse: WriteToFileToolUse // Correct modifier order

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
		// Assert the type after calling super constructor
		this.toolUse = toolUse as WriteToFileToolUse
	}

	async handle(): Promise<boolean> {
		if (this.toolUse.partial) {
			await this.handlePartial()
			return false // Indicate partial handling (streaming)
		} else {
			await this.handleComplete()
			return true // Indicate complete handling
		}
	}

	validateParams(): void {
		if (!this.toolUse.params.path) {
			throw new Error("Missing required parameter 'path'")
		}
		// Content validation happens in handleComplete as it might stream partially
		if (!this.toolUse.partial && !this.toolUse.params.content) {
			throw new Error("Missing required parameter 'content'")
		}
		// Line count validation happens in handleComplete
		if (!this.toolUse.partial && !this.toolUse.params.line_count) {
			throw new Error("Missing required parameter 'line_count'")
		}
	}

	protected async handlePartial(): Promise<void> {
		const relPath = this.toolUse.params.path
		let newContent = this.toolUse.params.content

		// Skip if we don't have enough information yet (path is needed early)
		if (!relPath) {
			return
		}

		// Pre-process content early if possible (remove ``` markers)
		if (newContent?.startsWith("```")) {
			newContent = newContent.split("\n").slice(1).join("\n").trim()
		}
		if (newContent?.endsWith("```")) {
			newContent = newContent.split("\n").slice(0, -1).join("\n").trim()
		}

		// Validate access (can be done early with path)
		const accessAllowed = this.cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			// If access is denied early, stop processing and report error
			// Note: This might need refinement if partial denial is possible/needed
			await this.cline.say("rooignore_error", relPath)
			await this.cline.pushToolResult(
				this.toolUse,
				formatResponse.toolError(formatResponse.rooIgnoreError(relPath)),
			)
			// Consider how to stop further streaming/handling for this tool use
			return
		}

		// Determine file existence and edit type if not already set
		if (this.cline.diffViewProvider.editType === undefined) {
			const absolutePath = path.resolve(this.cline.cwd, relPath)
			const fileExists = await fileExistsAtPath(absolutePath)
			this.cline.diffViewProvider.editType = fileExists ? "modify" : "create"
		}
		const fileExists = this.cline.diffViewProvider.editType === "modify"

		// Determine if the path is outside the workspace
		const fullPath = path.resolve(this.cline.cwd, this.removeClosingTag("path", relPath))
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

		const sharedMessageProps: ClineSayTool = {
			tool: fileExists ? "editedExistingFile" : "newFileCreated",
			path: getReadablePath(this.cline.cwd, this.removeClosingTag("path", relPath)),
			isOutsideWorkspace,
		}

		// Update GUI message (ask with partial=true)
		const partialMessage = JSON.stringify(sharedMessageProps)
		// Use try-catch as ask can throw if interrupted
		try {
			await this.cline.ask("tool", partialMessage, true)
		} catch (error) {
			console.warn("WriteToFileHandler: ask for partial update interrupted.", error)
			// If ask fails, we might not want to proceed with editor updates
			return
		}

		// Update editor only if content is present
		if (newContent) {
			if (!this.cline.diffViewProvider.isEditing) {
				// Open the editor and prepare to stream content in
				await this.cline.diffViewProvider.open(relPath)
			}
			// Editor is open, stream content in
			await this.cline.diffViewProvider.update(
				everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
				false, // Indicate partial update
			)
		}
	}

	protected async handleComplete(): Promise<void> {
		const relPath = this.toolUse.params.path
		let newContent = this.toolUse.params.content
		const predictedLineCount = parseInt(this.toolUse.params.line_count ?? "0")

		// --- Parameter Validation ---
		if (!relPath) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("write_to_file", "path"),
			)
			await this.cline.diffViewProvider.reset() // Reset diff view state
			return
		}
		if (!newContent) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("write_to_file", "content"),
			)
			await this.cline.diffViewProvider.reset()
			return
		}
		if (!predictedLineCount) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("write_to_file", "line_count"),
			)
			await this.cline.diffViewProvider.reset()
			return
		}

		// --- Access Validation ---
		const accessAllowed = this.cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			await this.cline.say("rooignore_error", relPath)
			await this.cline.pushToolResult(
				this.toolUse,
				formatResponse.toolError(formatResponse.rooIgnoreError(relPath)),
			)
			await this.cline.diffViewProvider.reset()
			return
		}

		// --- Content Pre-processing ---
		if (newContent.startsWith("```")) {
			newContent = newContent.split("\n").slice(1).join("\n").trim()
		}
		if (newContent.endsWith("```")) {
			newContent = newContent.split("\n").slice(0, -1).join("\n").trim()
		}
		// Handle HTML entities (moved from Cline.ts)
		if (!this.cline.api.getModel().id.includes("claude")) {
			// Corrected check for double quote
			if (newContent.includes("&gt;") || newContent.includes("&lt;") || newContent.includes('"')) {
				newContent = newContent
					.replace(/&gt;/g, ">")
					.replace(/&lt;/g, "<")
					.replace(/&quot;/g, '"')
			}
		}

		// --- Determine File State ---
		// Ensure editType is set (might not have been if handlePartial wasn't called or skipped early)
		// Removed duplicate 'if' keyword
		if (this.cline.diffViewProvider.editType === undefined) {
			const absolutePath = path.resolve(this.cline.cwd, relPath)
			const fileExistsCheck = await fileExistsAtPath(absolutePath)
			this.cline.diffViewProvider.editType = fileExistsCheck ? "modify" : "create"
		}
		const fileExists = this.cline.diffViewProvider.editType === "modify"
		const fullPath = path.resolve(this.cline.cwd, relPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

		// --- Update Editor (Final) ---
		// Ensure editor is open if not already editing (covers cases where partial didn't run)
		if (!this.cline.diffViewProvider.isEditing) {
			await this.cline.diffViewProvider.open(relPath)
		}
		// Perform final update
		await this.cline.diffViewProvider.update(
			everyLineHasLineNumbers(newContent) ? stripLineNumbers(newContent) : newContent,
			true, // Indicate complete update
		)
		await delay(300) // Allow diff view to update
		this.cline.diffViewProvider.scrollToFirstDiff()

		// --- Code Omission Check ---
		if (detectCodeOmission(this.cline.diffViewProvider.originalContent || "", newContent, predictedLineCount)) {
			if (this.cline.diffStrategy) {
				// Check if diff strategy is enabled
				await this.cline.diffViewProvider.revertChanges()
				await this.cline.pushToolResult(
					this.toolUse,
					formatResponse.toolError(
						`Content appears to be truncated (file has ${newContent.split("\n").length} lines but was predicted to have ${predictedLineCount} lines), and found comments indicating omitted code (e.g., '// rest of code unchanged', '/* previous code */'). Please provide the complete file content without any omissions if possible, or otherwise use the 'apply_diff' tool to apply the diff to the original file.`,
					),
				)
				return // Stop processing
			} else {
				// Show warning if diff strategy is not enabled (original behavior)
				vscode.window
					.showWarningMessage(
						"Potential code truncation detected. This happens when the AI reaches its max output limit.",
						"Follow this guide to fix the issue",
					)
					.then((selection) => {
						if (selection === "Follow this guide to fix the issue") {
							vscode.env.openExternal(
								vscode.Uri.parse(
									"https://github.com/cline/cline/wiki/Troubleshooting-%E2%80%90-Cline-Deleting-Code-with-%22Rest-of-Code-Here%22-Comments",
								),
							)
						}
					})
			}
		}

		// --- Ask for Approval ---
		const sharedMessageProps: ClineSayTool = {
			tool: fileExists ? "editedExistingFile" : "newFileCreated",
			path: getReadablePath(this.cline.cwd, relPath),
			isOutsideWorkspace,
		}
		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			content: fileExists ? undefined : newContent, // Only show full content for new files
			diff: fileExists
				? formatResponse.createPrettyPatch(relPath, this.cline.diffViewProvider.originalContent, newContent)
				: undefined,
		} satisfies ClineSayTool)

		// Use helper from Cline or replicate askApproval logic here
		// For now, assuming askApproval is accessible or replicated
		// Pass this.toolUse as the first argument
		const didApprove = await this.cline.askApprovalHelper(this.toolUse, "tool", completeMessage)

		// --- Finalize or Revert ---
		if (didApprove) {
			try {
				await this.cline.diffViewProvider.saveChanges()
				// Use formatResponse.toolResult for success message
				await this.cline.pushToolResult(
					this.toolUse,
					formatResponse.toolResult(`Successfully saved changes to ${relPath}`),
				)
				this.cline.didEditFile = true // Mark that a file was edited
				this.cline.consecutiveMistakeCount = 0 // Reset mistake count on success
				telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name) // Capture telemetry
			} catch (error: any) {
				await this.cline.diffViewProvider.revertChanges()
				await this.cline.handleErrorHelper(this.toolUse, `saving file ${relPath}`, error) // Pass this.toolUse
			}
		} else {
			// User rejected
			await this.cline.diffViewProvider.revertChanges()
			// pushToolResult was already called within askApprovalHelper if user provided feedback or just denied
		}

		// Reset diff provider state regardless of outcome
		await this.cline.diffViewProvider.reset()
	}
}
