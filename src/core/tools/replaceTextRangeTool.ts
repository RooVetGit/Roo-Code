import delay from "delay"
import fs from "fs/promises"
import path from "path"

import { getReadablePath } from "../../utils/path"
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"
import { safeBlockEdit } from "../../utils/fileEditUtils"

export async function replaceTextRangeTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	const startLineStr: string | undefined = block.params.start_line
	const endLineStr: string | undefined = block.params.end_line
	const newContent: string | undefined = block.params.new_content // Note: Renamed from 'content' for clarity

	const sharedMessageProps: Omit<ClineSayTool, "diff"> & { startLine?: number; endLine?: number; newContentPreview?: string } = {
		tool: "replaceTextRange",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
		startLine: startLineStr ? parseInt(startLineStr, 10) : undefined,
		endLine: endLineStr ? parseInt(endLineStr, 10) : undefined,
		newContentPreview: newContent ? (newContent.substring(0, 100) + (newContent.length > 100 ? "..." : "")) : undefined,
	}

	try {
		if (block.partial) { // Should ideally not be partial for this kind of direct edit.
			await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
			return
		}

		// Validate required parameters
		if (!relPath) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_text_range")
			pushToolResult(await cline.sayAndCreateMissingParamError("replace_text_range", "path"))
			return
		}
		if (!startLineStr) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_text_range")
			pushToolResult(await cline.sayAndCreateMissingParamError("replace_text_range", "start_line"))
			return
		}
		if (!endLineStr) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_text_range")
			pushToolResult(await cline.sayAndCreateMissingParamError("replace_text_range", "end_line"))
			return
		}
		if (newContent === undefined) { // new_content can be an empty string, so check for undefined
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_text_range")
			pushToolResult(await cline.sayAndCreateMissingParamError("replace_text_range", "new_content"))
			return
		}

		const startLine1Indexed = parseInt(startLineStr, 10)
		const endLine1Indexed = parseInt(endLineStr, 10)

		if (isNaN(startLine1Indexed)) {
			pushToolResult(formatResponse.toolError("Invalid start_line: Must be an integer."))
			return
		}
		if (isNaN(endLine1Indexed)) {
			pushToolResult(formatResponse.toolError("Invalid end_line: Must be an integer."))
			return
		}

		if (startLine1Indexed < 1) {
			pushToolResult(formatResponse.toolError("Invalid start_line: Must be 1 or greater."))
			return
		}
		if (endLine1Indexed < 0) { // Allow 0 for inserting before the first line when start_line is 1
			pushToolResult(formatResponse.toolError("Invalid end_line: Must be 0 or greater."))
			return
		}
        // Further validation of start_line vs end_line vs file lines happens implicitly in safeBlockEdit
        // or can be added here if specific error messages are desired before reading file.

		const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			await cline.say("rooignore_error", relPath)
			pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(relPath)))
			return
		}

		const absolutePath = path.resolve(cline.cwd, relPath)
		const fileExists = await fileExistsAtPath(absolutePath)

		if (!fileExists) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_text_range")
			pushToolResult(formatResponse.toolError(`File does not exist at path: ${relPath}`))
			return
		}

		cline.consecutiveMistakeCount = 0

		const originalFileContent = await fs.readFile(absolutePath, "utf-8")
		cline.diffViewProvider.originalContent = originalFileContent

		const updatedContent = safeBlockEdit(originalFileContent, startLine1Indexed, endLine1Indexed, newContent)

		cline.diffViewProvider.editType = "modify"

		if (!cline.diffViewProvider.isEditing) {
			await cline.ask("tool", JSON.stringify({...sharedMessageProps, diff: `Replacing lines ${startLine1Indexed}-${endLine1Indexed}`}), true).catch(() => {})
			await cline.diffViewProvider.open(relPath)
			await cline.diffViewProvider.update(originalFileContent, false)
			cline.diffViewProvider.scrollToLine(startLine1Indexed)
			await delay(200)
		}

		await cline.diffViewProvider.update(updatedContent, true)

		const diffForApproval = formatResponse.createPrettyPatch(relPath, originalFileContent, updatedContent)

		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			diff: diffForApproval || `Content of lines ${startLine1Indexed}-${endLine1Indexed} will be replaced.`,
		} satisfies ClineSayTool)

		const { response, text: feedbackText, images: feedbackImages } = await cline.ask("tool", completeMessage, false)
		const didApprove = response === "yesButtonClicked"

		if (!didApprove) {
			await cline.diffViewProvider.revertChanges()
			if (feedbackText) await cline.say("user_feedback", feedbackText, feedbackImages)
			pushToolResult(formatResponse.toolError("Changes were rejected by the user."))
			await cline.diffViewProvider.reset()
			return
		}

		if (feedbackText) await cline.say("user_feedback", feedbackText, feedbackImages)

		// Save to edit history
		if (cline.diffViewProvider.originalContent !== undefined && cline.diffViewProvider.originalContent !== null) {
			const history = cline.editHistory.get(absolutePath) || []
			history.push(cline.diffViewProvider.originalContent)
			cline.editHistory.set(absolutePath, history)
		}

		await cline.diffViewProvider.saveChanges()
		await cline.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
		cline.didEditFile = true

		const message = await cline.diffViewProvider.pushToolWriteResult(cline, cline.cwd, false)
		pushToolResult(message)
		cline.recordToolUsage("replace_text_range")
		await cline.diffViewProvider.reset()

	} catch (error) {
		await cline.diffViewProvider.reset().catch(console.error)
		handleError("replace text range", error)
	}
}
