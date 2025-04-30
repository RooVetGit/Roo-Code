import fs from "fs/promises"
import path from "path"
import { getReadablePath } from "../../utils/path"
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"
import { insertGroups } from "../diff/insert-groups"
import { telemetryService } from "../../services/telemetry/TelemetryService"
import { addLineNumbers } from "../../integrations/misc/extract-text"

const CONTENT_UPDATE_DELAY = 200

async function prepareAndShowContent(
	cline: Task,
	absolutePath: string,
	relPath: string,
	content: string,
	lineNumber: number,
	sharedMessageProps: ClineSayTool,
	partial: boolean,
) {
	const fileContent = !cline.diffViewProvider.isEditing
		? await fs.readFile(absolutePath, "utf8")
		: cline.diffViewProvider.originalContent!

	const lines = fileContent.split("\n")
	const updatedContent = insertGroups(lines, [
		{
			index: lineNumber - 1,
			elements: content.split("\n"),
		},
	]).join("\n")

	if (!cline.diffViewProvider.isEditing) {
		cline.diffViewProvider.editType = "modify"
		cline.diffViewProvider.originalContent = fileContent
		await cline.ask("tool", JSON.stringify(sharedMessageProps), true).catch(() => {})
		await cline.diffViewProvider.open(relPath)
		await cline.diffViewProvider.update(updatedContent, true, false)
		cline.diffViewProvider.scrollToFirstDiff()
	} else {
		await cline.diffViewProvider.update(updatedContent, true, false)
	}

	const diff = formatResponse.createPrettyPatch(relPath, fileContent, updatedContent)

	// Send partial message with current state
	if (partial) {
		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			diff,
			content, // Include content for CodeAccordian to show during streaming
		})
		await cline.ask("tool", partialMessage, partial).catch(() => {})
	}

	// without this the diff vscode interface does not update because it
	// coalesces updates and if they come too fast then nothing changes.
	await new Promise((resolve) => setTimeout(resolve, CONTENT_UPDATE_DELAY))

	return { fileContent, updatedContent, diff }
}

export async function insertContentTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	const line: string | undefined = block.params.line
	const content: string | undefined = block.params.content

	// 1-based lineNumber
	const lineNumber = line ? parseInt(line, 10) : undefined

	const sharedMessageProps: ClineSayTool = {
		tool: "insertContent",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
		diff: content,
		lineNumber,
	}

	try {
		if (block.partial) {
			// Validate all required parameters exist before proceeding
			if (!relPath || lineNumber === undefined || !content) {
				// Wait for all parameters before proceeding
				return
			}

			const absolutePath = path.resolve(cline.cwd, relPath)
			const fileExists = await fileExistsAtPath(absolutePath)

			const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
			if (!accessAllowed) {
				await cline.say("rooignore_error", relPath)
				pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(relPath)))
				return
			}

			if (!fileExists) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("insert_content")
				const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
				const currentCount = (cline.consecutiveMistakeCountForInsertContent?.get(relPath) || 0) + 1
				cline.consecutiveMistakeCountForInsertContent?.set(relPath, currentCount)
				telemetryService.captureInsertContentError(cline.taskId, currentCount)
				if (currentCount >= 2) {
					await cline.say("error", formattedError)
				}
				pushToolResult(formattedError)
				return
			}

			await prepareAndShowContent(
				cline,
				absolutePath,
				relPath,
				content,
				lineNumber,
				sharedMessageProps,
				block.partial,
			)
			return
		}

		// Validate required parameters
		if (!relPath) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("insert_content")
			pushToolResult(await cline.sayAndCreateMissingParamError("insert_content", "path"))
			return
		}

		if (!line) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("insert_content")
			pushToolResult(await cline.sayAndCreateMissingParamError("insert_content", "line"))
			return
		}

		if (!content) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("insert_content")
			pushToolResult(await cline.sayAndCreateMissingParamError("insert_content", "content"))
			return
		}

		const absolutePath = path.resolve(cline.cwd, relPath)
		const fileExists = await fileExistsAtPath(absolutePath)

		const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			await cline.say("rooignore_error", relPath)
			pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(relPath)))
			return
		}

		if (!fileExists) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("insert_content")
			const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
			const currentCount = (cline.consecutiveMistakeCountForInsertContent?.get(relPath) || 0) + 1
			cline.consecutiveMistakeCountForInsertContent?.set(relPath, currentCount)
			telemetryService.captureInsertContentError(cline.taskId, currentCount)
			await cline.say("error", formattedError)
			pushToolResult(formattedError)
			return
		}

		// 0 here is append, so it is allowed:
		if (lineNumber === undefined || isNaN(lineNumber) || lineNumber < 0) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("insert_content")
			pushToolResult(formatResponse.toolError("Invalid line number. Must be a non-negative integer."))
			return
		}

		cline.consecutiveMistakeCount = 0

		const { diff } = await prepareAndShowContent(
			cline,
			absolutePath,
			relPath,
			content,
			lineNumber,
			sharedMessageProps,
			block.partial,
		)

		if (!diff) {
			pushToolResult(`No changes needed for '${relPath}'`)
			return
		}

		cline.consecutiveMistakeCount = 0
		cline.consecutiveMistakeCountForInsertContent?.delete(relPath)
		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			diff,
			lineNumber: lineNumber + 1,
		} satisfies ClineSayTool)

		const didApprove = await askApproval("tool", completeMessage)

		if (!didApprove) {
			await cline.diffViewProvider.revertChanges()
			return
		}

		const { newProblemsMessage, userEdits, finalContent } = await cline.diffViewProvider.saveChanges()

		// Track file edit operation
		if (relPath) {
			await cline.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
		}

		cline.didEditFile = true

		if (!userEdits) {
			pushToolResult(
				`The content was successfully inserted in ${relPath.toPosix()} at line ${lineNumber}.${newProblemsMessage}`,
			)
			await cline.diffViewProvider.reset()
			return
		}

		await cline.say(
			"user_feedback_diff",
			JSON.stringify({
				tool: "insertContent",
				path: getReadablePath(cline.cwd, relPath),
				diff: userEdits,
				lineNumber: lineNumber,
			} satisfies ClineSayTool),
		)

		pushToolResult(
			`The user made the following updates to your content:\n\n${userEdits}\n\n` +
				`The updated content has been successfully saved to ${relPath.toPosix()}. Here is the full, updated content of the file:\n\n` +
				`<final_file_content path="${relPath.toPosix()}">\n${addLineNumbers(finalContent || "")}\n</final_file_content>\n\n` +
				`Please note:\n` +
				`1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
				`2. Proceed with the task using this updated file content as the new baseline.\n` +
				`3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
				`${newProblemsMessage}`,
		)

		await cline.diffViewProvider.reset()
	} catch (error) {
		handleError("insert content", error)
		await cline.diffViewProvider.reset()
	}
}
