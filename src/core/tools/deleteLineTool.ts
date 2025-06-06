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

export async function deleteLineTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	const lineNumberStr: string | undefined = block.params.line_number

	const sharedMessageProps: Omit<ClineSayTool, "diff"> & { lineNumber?: number; lineContentPreview?: string } = {
		tool: "deleteLine",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
		lineNumber: lineNumberStr ? parseInt(lineNumberStr, 10) : undefined,
	}

	try {
		if (block.partial) {
			await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
			return
		}

		// Validate required parameters
		if (!relPath) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("delete_line")
			pushToolResult(await cline.sayAndCreateMissingParamError("delete_line", "path"))
			return
		}

		if (!lineNumberStr) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("delete_line")
			pushToolResult(await cline.sayAndCreateMissingParamError("delete_line", "line_number"))
			return
		}

		const lineNumber = parseInt(lineNumberStr, 10)
		if (isNaN(lineNumber)) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("delete_line")
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
			cline.recordToolError("delete_line")
			const formattedError = formatResponse.toolError(
				`File does not exist at path: ${absolutePath}\nThe specified file could not be found. Please verify the file path and try again.`,
			)
			// await cline.say("error", formattedError) // Say is handled by pushToolResult typically or should be more specific
			pushToolResult(formattedError)
			return
		}

		// Read the file content
		const fileContent = await fs.readFile(absolutePath, "utf8")
		const lines = fileContent.split("\n")

		// Validate line_number bounds (1-indexed)
		if (lineNumber < 1 || lineNumber > lines.length) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("delete_line")
			pushToolResult(
				formatResponse.toolError(
					`Invalid line_number. Must be between 1 and ${lines.length} (inclusive). File has ${lines.length} lines.`,
				),
			)
			return
		}

		cline.consecutiveMistakeCount = 0 // Reset if all initial validations pass

		const lineToRemoveIndex = lineNumber - 1
		const removedLineContent = lines[lineToRemoveIndex] // For the approval message

		// Create updated content
		const updatedLines = [...lines]
		updatedLines.splice(lineToRemoveIndex, 1)
		const updatedContent = updatedLines.join("\n")

		cline.diffViewProvider.editType = "modify"
		cline.diffViewProvider.originalContent = fileContent

		// Update sharedMessageProps with actual line content for approval
		sharedMessageProps.lineNumber = lineNumber
		sharedMessageProps.lineContentPreview = removedLineContent.substring(0, 80) + (removedLineContent.length > 80 ? "..." : "")


		// Show changes in diff view
		if (!cline.diffViewProvider.isEditing) {
			// It's good practice to show the tool is attempting something before the diff view is fully ready
			await cline.ask("tool", JSON.stringify({...sharedMessageProps, diff: `--- a/${relPath}\n+++ b/${relPath}\n-${removedLineContent}`}), true).catch(() => {})
			await cline.diffViewProvider.open(relPath)
			await cline.diffViewProvider.update(fileContent, false) // Show original first
			cline.diffViewProvider.scrollToFirstDiff() // Or perhaps better: cline.diffViewProvider.scrollToLine(lineNumber)
			await delay(200) // Allow UI to catch up
		}

		await cline.diffViewProvider.update(updatedContent, true) // Show the proposed change

		const diff = formatResponse.createPrettyPatch(relPath, fileContent, updatedContent)
		if (!diff) {
			// This case should ideally not happen if lineNumber is valid and file is not empty,
			// as deleting a line always creates a diff.
			pushToolResult(`No changes needed for '${relPath}' (Line ${lineNumber} deletion resulted in no diff).`)
			await cline.diffViewProvider.reset()
			return
		}

		const completeMessage = JSON.stringify({
			...sharedMessageProps, // Already updated with lineNumber and lineContentPreview
			diff, // Full diff for the approval dialog
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

		// Call saveChanges to update the DiffViewProvider properties
		await cline.diffViewProvider.saveChanges()

		// Track file edit operation
		await cline.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
		cline.didEditFile = true

		// Get the formatted response message
		const message = await cline.diffViewProvider.pushToolWriteResult(
			cline,
			cline.cwd,
			false, // Always false for delete_line
		)

		pushToolResult(message)
		cline.recordToolUsage("delete_line")
		await cline.diffViewProvider.reset()

	} catch (error) {
		// Ensure diff view is reset on any unexpected error
		await cline.diffViewProvider.reset().catch(console.error)
		// Use the handleError callback for consistent error reporting
		handleError("delete line", error)
	}
}
