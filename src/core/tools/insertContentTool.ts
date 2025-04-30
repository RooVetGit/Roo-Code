import fs from "fs/promises"
import path from "path"
import { getReadablePath } from "../../utils/path"
import { Cline } from "../Cline"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"
import { insertGroups } from "../diff/insert-groups"

import { setImmediate } from "timers"
const CONTENT_UPDATE_DELAY = () => new Promise((resolve) => setTimeout(resolve, 200))

async function prepareAndShowContent(
	cline: Cline,
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
			index: lineNumber,
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

	await CONTENT_UPDATE_DELAY()

	return { fileContent, updatedContent, diff }
}

export async function insertContentTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	const line: string | undefined = block.params.line
	const content: string | undefined = block.params.content

	// 0-based lineNumber
	const lineNumber = line ? parseInt(line, 10) - 1 : undefined

	const sharedMessageProps: ClineSayTool = {
		tool: "insertContent",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),

		// Use 1-based line number for display
		lineNumber: lineNumber !== undefined ? lineNumber + 1 : undefined,
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

			if (!fileExists) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("insert_content")
				const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
				await cline.say("error", formattedError)
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

		if (!fileExists) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("insert_content")
			const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
			await cline.say("error", formattedError)
			pushToolResult(formattedError)
			return
		}

		// -1 here is append, so it is allowed:
		if (lineNumber === undefined || isNaN(lineNumber) || lineNumber < -1) {
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

		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			diff,
			lineNumber: lineNumber,
		} satisfies ClineSayTool)

		const didApprove = await cline
			.ask("tool", completeMessage, false)
			.then((response) => response.response === "yesButtonClicked")

		if (!didApprove) {
			await cline.diffViewProvider.revertChanges()
			pushToolResult("Changes were rejected by the user.")
			return
		}

		const { newProblemsMessage, userEdits, finalContent } = await cline.diffViewProvider.saveChanges()

		// Track file edit operation
		if (relPath) {
			await cline.getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
		}

		cline.didEditFile = true

		if (!userEdits) {
			pushToolResult(
				`The content was successfully inserted in ${relPath.toPosix()} at line ${lineNumber}.${newProblemsMessage}`,
			)
			await cline.diffViewProvider.reset()
			return
		}

		const userFeedbackDiff = JSON.stringify({
			tool: "insertContent",
			path: getReadablePath(cline.cwd, relPath),
			lineNumber: lineNumber,
			diff: userEdits,
		} satisfies ClineSayTool)

		await cline.say("user_feedback_diff", userFeedbackDiff)

		pushToolResult(
			`The user made the following updates to your content:\n\n${userEdits}\n\n` +
				`The updated content has been successfully saved to ${relPath.toPosix()}. Here is the full, updated content of the file:\n\n` +
				`<final_file_content path="${relPath.toPosix()}">\n${finalContent}\n</final_file_content>\n\n` +
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
