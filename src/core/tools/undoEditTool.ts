import fs from "fs/promises"
import path from "path"
import delay from "delay"

import { getReadablePath } from "../../utils/path"
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"

export async function undoEditTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path

	const sharedMessageProps: Omit<ClineSayTool, "diff"> & { originalContentPreview?: string, previousContentPreview?: string } = {
		tool: "undoEdit",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
	}

	try {
		if (block.partial) { // Should not really happen for a simple tool like this
			await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
			return
		}

		// Validate required parameters
		if (!relPath) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("undo_edit")
			pushToolResult(await cline.sayAndCreateMissingParamError("undo_edit", "path"))
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
			cline.recordToolError("undo_edit")
			pushToolResult(formatResponse.toolError(`File specified for undo does not exist: ${relPath}`))
			return
		}

		const history = cline.editHistory.get(absolutePath)
		if (!history || history.length === 0) {
			pushToolResult(formatResponse.toolError(`No edit history available for ${relPath} to undo.`))
			return
		}

		const previousContent = history.pop() // Temporarily remove from history

		if (previousContent === undefined) {
			// Should not happen if length check passed, but good for type safety
			pushToolResult(formatResponse.toolError(`Error retrieving previous state for ${relPath}. History might be corrupted.`))
			// Technically, if it was popped, it's gone, but if it was undefined from a bad pop, nothing to add back.
			// If history was [undefined] and pop returned undefined, this path is tricky.
			// For now, assume pop on empty or valid array.
			return
		}

		cline.consecutiveMistakeCount = 0

		const currentDiskContent = await fs.readFile(absolutePath, "utf-8")

		cline.diffViewProvider.editType = "modify"
		cline.diffViewProvider.originalContent = currentDiskContent // What's currently on disk

		// Update sharedMessageProps for approval dialog
		sharedMessageProps.originalContentPreview = currentDiskContent.substring(0, 80) + (currentDiskContent.length > 80 ? "..." : "")
		sharedMessageProps.previousContentPreview = previousContent.substring(0, 80) + (previousContent.length > 80 ? "..." : "")

		// Show changes in diff view
		if (!cline.diffViewProvider.isEditing) {
			await cline.ask("tool", JSON.stringify({...sharedMessageProps, diff: `Reverting to a previous version of the file.`}), true).catch(() => {})
			await cline.diffViewProvider.open(relPath)
			await cline.diffViewProvider.update(currentDiskContent, false) // Show current disk content first
			cline.diffViewProvider.scrollToFirstDiff()
			await delay(200)
		}

		await cline.diffViewProvider.update(previousContent, true) // Show the state we are undoing TO

		const diff = formatResponse.createPrettyPatch(relPath, currentDiskContent, previousContent)

		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			diff: diff || `File will be reverted to a previous state.`, // Diff might be empty if reverting to identical content somehow
		} satisfies ClineSayTool)

		const { response, text: feedbackText, images: feedbackImages } = await cline.ask("tool", completeMessage, false)
		const didApprove = response === "yesButtonClicked"

		if (!didApprove) {
			// User rejected: push the popped content back to history
			history.push(previousContent)
			cline.editHistory.set(absolutePath, history) // Ensure the map is updated if history was initially empty and created by .get()

			await cline.diffViewProvider.revertChanges()
			if (feedbackText) await cline.say("user_feedback", feedbackText, feedbackImages)
			pushToolResult(formatResponse.toolError("Undo operation was rejected by the user."))
			await cline.diffViewProvider.reset()
			return
		}

		if (feedbackText) await cline.say("user_feedback", feedbackText, feedbackImages)

		// IMPORTANT: The actual file write happens here, and it does NOT go through a process that saves to editHistory again.
		// We rely on diffViewProvider.saveChanges() to handle the editor state / file buffer if it's an open file,
		// and then we ensure the content is written to disk.
		// For many setups, saveChanges might already write to disk. This direct fs.writeFile ensures it.

		await cline.diffViewProvider.saveChanges(); // This primarily updates the diff view's state and potentially editor buffers.

		// Explicitly write the undone content to disk.
		// This step is crucial because saveChanges() in DiffViewProvider might not write to disk,
		// or if it does, we want to be certain this specific content (previousContent) is what's written.
		// This write does NOT (and should NOT) trigger another entry into editHistory.
		await fs.writeFile(absolutePath, previousContent)


		await cline.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
		cline.didEditFile = true

		// If history is now empty for this path, remove the key from the map
		if (history.length === 0) {
			cline.editHistory.delete(absolutePath)
		} else {
			cline.editHistory.set(absolutePath, history) // Make sure the modified (popped) history is saved
		}

		pushToolResult(formatResponse.toolSuccess(`File ${relPath} successfully reverted to its previous state.`))
		cline.recordToolUsage("undo_edit")
		await cline.diffViewProvider.reset()

	} catch (error) {
		await cline.diffViewProvider.reset().catch(console.error)
		handleError("undo edit", error)
	}
}
