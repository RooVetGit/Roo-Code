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

export async function replaceLineTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	const lineNumberStr: string | undefined = block.params.line_number
	const newContent: string | undefined = block.params.content

	const sharedMessageProps: Omit<ClineSayTool, "diff"> & { lineNumber?: number; oldLinePreview?: string; newLinePreview?: string } = {
		tool: "replaceLine",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
		lineNumber: lineNumberStr ? parseInt(lineNumberStr, 10) : undefined,
		// content will be part of the diff, but previews can be useful
	}

	try {
		if (block.partial) {
			// For partial, include a preview of the new content if available
			if (newContent !== undefined) {
				sharedMessageProps.newLinePreview = newContent.substring(0, 80) + (newContent.length > 80 ? "..." : "")
			}
			await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
			return
		}

		// Validate required parameters
		if (!relPath) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_line")
			pushToolResult(await cline.sayAndCreateMissingParamError("replace_line", "path"))
			return
		}

		if (!lineNumberStr) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_line")
			pushToolResult(await cline.sayAndCreateMissingParamError("replace_line", "line_number"))
			return
		}

		if (newContent === undefined) { // Check for undefined specifically
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_line")
			pushToolResult(await cline.sayAndCreateMissingParamError("replace_line", "content"))
			return
		}

		// Validate that newContent does not contain newline characters
		if (newContent.includes("\n")) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_line")
			pushToolResult(
				formatResponse.toolError(
					"Invalid content: New content for a line replacement should not contain newline characters.",
				),
			)
			return
		}

		const lineNumber = parseInt(lineNumberStr, 10)
		if (isNaN(lineNumber)) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_line")
			pushToolResult(formatResponse.toolError("Invalid line_number. Must be an integer."))
			return
		}

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
			cline.recordToolError("replace_line")
			const formattedError = formatResponse.toolError(
				`File does not exist at path: ${absolutePath}\nThe specified file could not be found. Please verify the file path and try again.`,
			)
			pushToolResult(formattedError)
			return
		}

		// Read the file content
		const fileContent = await fs.readFile(absolutePath, "utf8")
		const lines = fileContent.split("\n")

		// Validate line_number bounds (1-indexed)
		if (lineNumber < 1 || lineNumber > lines.length) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_line")
			pushToolResult(
				formatResponse.toolError(
					`Invalid line_number. Must be between 1 and ${lines.length} (inclusive). File has ${lines.length} lines.`,
				),
			)
			return
		}

		// If file is empty and trying to replace line 1 (which doesn't exist)
		if (lines.length === 1 && lines[0] === "" && lineNumber === 1) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("replace_line")
			pushToolResult(
				formatResponse.toolError(
					`Invalid line_number: Cannot replace line 1 in an empty file. Use insert_content to add lines to an empty file.`,
				),
			)
			return
		}


		cline.consecutiveMistakeCount = 0 // Reset if all initial validations pass

		const lineToReplaceIndex = lineNumber - 1
		const oldLineContent = lines[lineToReplaceIndex]

		// Create updated content
		const updatedLines = [...lines]
		updatedLines[lineToReplaceIndex] = newContent // Replace the specific line
		const updatedContent = updatedLines.join("\n")

		cline.diffViewProvider.editType = "modify"
		cline.diffViewProvider.originalContent = fileContent

		// Update sharedMessageProps for approval
		sharedMessageProps.lineNumber = lineNumber
		sharedMessageProps.oldLinePreview = oldLineContent.substring(0, 80) + (oldLineContent.length > 80 ? "..." : "")
		sharedMessageProps.newLinePreview = newContent.substring(0, 80) + (newContent.length > 80 ? "..." : "")


		// Show changes in diff view
		if (!cline.diffViewProvider.isEditing) {
			await cline.ask("tool", JSON.stringify({...sharedMessageProps, diff: `--- a/${relPath}\n+++ b/${relPath}\n-${oldLineContent}\n+${newContent}`}), true).catch(() => {})
			await cline.diffViewProvider.open(relPath)
			await cline.diffViewProvider.update(fileContent, false)
			cline.diffViewProvider.scrollToFirstDiff()
			await delay(200)
		}

		await cline.diffViewProvider.update(updatedContent, true)

		const diff = formatResponse.createPrettyPatch(relPath, fileContent, updatedContent)
		// If old line is same as new content, diff might be empty.
		if (!diff && oldLineContent !== newContent) {
			// This case should be rare if oldLineContent !== newContent
			pushToolResult(`No changes needed for '${relPath}' (Line ${lineNumber} replacement resulted in no diff).`)
			await cline.diffViewProvider.reset()
			return
		}
		if (!diff && oldLineContent === newContent) {
			pushToolResult(`No changes needed for '${relPath}' (Line ${lineNumber} already matches the new content).`)
			await cline.diffViewProvider.reset()
			return
		}


		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			diff,
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

		// Save current state to history BEFORE writing the new state
		if (relPath && cline.diffViewProvider.originalContent !== undefined && cline.diffViewProvider.originalContent !== null) {
			const absolutePath = path.resolve(cline.cwd, relPath);
			const history = cline.editHistory.get(absolutePath) || [];
			history.push(cline.diffViewProvider.originalContent);
			cline.editHistory.set(absolutePath, history);
		}

		await cline.diffViewProvider.saveChanges()
		await cline.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
		cline.didEditFile = true

		const message = await cline.diffViewProvider.pushToolWriteResult(
			cline,
			cline.cwd,
			false,
		)

		pushToolResult(message)
		cline.recordToolUsage("replace_line")
		await cline.diffViewProvider.reset()

	} catch (error) {
		await cline.diffViewProvider.reset().catch(console.error)
		handleError("replace line", error)
	}
}
