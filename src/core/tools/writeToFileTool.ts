import path from "path"
import delay from "delay"
import * as vscode from "vscode"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"
import { addLineNumbers, stripLineNumbers, everyLineHasLineNumbers } from "../../integrations/misc/extract-text"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { detectCodeOmission } from "../../integrations/editor/detect-omission"
import { unescapeHtmlEntities } from "../../utils/text-normalization"

// Helper function to validate access permissions
async function validateAccess(cline: Task, relPath: string, pushToolResult: PushToolResult): Promise<boolean> {
	const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
	if (!accessAllowed) {
		await cline.say("rooignore_error", relPath)
		pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(relPath)))
		return false
	}
	return true
}

// Helper function to check if file exists and set edit type
async function checkFileExists(cline: Task, relPath: string): Promise<boolean> {
	if (cline.diffViewProvider.editType !== undefined) {
		return cline.diffViewProvider.editType === "modify"
	}

	const absolutePath = path.resolve(cline.cwd, relPath)
	const fileExists = await fileExistsAtPath(absolutePath)
	cline.diffViewProvider.editType = fileExists ? "modify" : "create"
	return fileExists
}

// Helper function to preprocess content (remove markdown blocks, unescape HTML)
function preprocessContent(cline: Task, content: string): string {
	let processedContent = content

	// Remove markdown code block markers
	if (processedContent.startsWith("```")) {
		processedContent = processedContent.split("\n").slice(1).join("\n").trim()
	}
	if (processedContent.endsWith("```")) {
		processedContent = processedContent.split("\n").slice(0, -1).join("\n").trim()
	}

	// Unescape HTML entities for non-Claude models
	if (!cline.api.getModel().id.includes("claude")) {
		processedContent = unescapeHtmlEntities(processedContent)
	}

	return processedContent
}

// Helper function to create shared message properties
function createMessageProps(
	cline: Task,
	relPath: string,
	content: string,
	fileExists: boolean,
	removeClosingTag: RemoveClosingTag,
): { messageProps: ClineSayTool; fullPath: string; isOutsideWorkspace: boolean } {
	const fullPath = path.resolve(cline.cwd, removeClosingTag("path", relPath)).toPosix()
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

	const messageProps: ClineSayTool = {
		tool: fileExists ? "editedExistingFile" : "newFileCreated",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
		content,
		isOutsideWorkspace,
	}

	return { messageProps, fullPath, isOutsideWorkspace }
}

// Helper function to handle diff view operations
async function handleDiffViewUpdate(
	cline: Task,
	relPath: string,
	content: string,
	isPartial: boolean,
	messageProps: ClineSayTool,
): Promise<void> {
	if (!cline.diffViewProvider.isEditing) {
		const partialMessage = JSON.stringify(messageProps)
		await cline.ask("tool", partialMessage, isPartial).catch(() => {})
		await cline.diffViewProvider.open(relPath)
	}

	await cline.diffViewProvider.update(
		everyLineHasLineNumbers(content) ? stripLineNumbers(content) : content,
		!isPartial,
	)
}

export async function writeToFileTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	let newContent: string | undefined = block.params.content
	let predictedLineCount: number | undefined = parseInt(block.params.line_count ?? "0")

	// Handle partial blocks first - minimal validation, just streaming
	if (block.partial) {
		if (!relPath || newContent === undefined) {
			// checking for newContent ensure relPath is complete
			// wait so we can determine if it's a new file or editing an existing file
			return
		}

		// Validate access permissions
		if (!(await validateAccess(cline, relPath, pushToolResult))) {
			return
		}

		// Check if file exists
		const fileExists = await checkFileExists(cline, relPath)

		// Preprocess content
		newContent = preprocessContent(cline, newContent)

		// Create message properties
		const { messageProps } = createMessageProps(cline, relPath, newContent, fileExists, removeClosingTag)

		try {
			// Handle diff view update
			await handleDiffViewUpdate(cline, relPath, newContent, true, messageProps)
			return
		} catch (error) {
			await handleError("writing file", error)
			await cline.diffViewProvider.reset()
			return
		}
	}

	// Handle non-partial blocks - full validation and processing
	if (!relPath) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("write_to_file")
		pushToolResult(await cline.sayAndCreateMissingParamError("write_to_file", "path"))
		await cline.diffViewProvider.reset()
		return
	}

	if (newContent === undefined) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("write_to_file")
		pushToolResult(await cline.sayAndCreateMissingParamError("write_to_file", "content"))
		await cline.diffViewProvider.reset()
		return
	}

	// Validate access permissions
	if (!(await validateAccess(cline, relPath, pushToolResult))) {
		return
	}

	// Check if file exists
	const fileExists = await checkFileExists(cline, relPath)

	// Preprocess content
	newContent = preprocessContent(cline, newContent)

	// Create message properties
	const { messageProps: sharedMessageProps } = createMessageProps(
		cline,
		relPath,
		newContent,
		fileExists,
		removeClosingTag,
	)

	try {
		if (predictedLineCount === undefined) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("write_to_file")

			// Calculate the actual number of lines in the content
			const actualLineCount = newContent.split("\n").length

			// Check if this is a new file or existing file
			const isNewFile = !fileExists

			// Check if diffStrategy is enabled
			const diffStrategyEnabled = !!cline.diffStrategy

			// Use more specific error message for line_count that provides guidance based on the situation
			await cline.say(
				"error",
				`Roo tried to use write_to_file${
					relPath ? ` for '${relPath.toPosix()}'` : ""
				} but the required parameter 'line_count' was missing or truncated after ${actualLineCount} lines of content were written. Retrying...`,
			)

			pushToolResult(
				formatResponse.toolError(
					formatResponse.lineCountTruncationError(actualLineCount, isNewFile, diffStrategyEnabled),
				),
			)
			await cline.diffViewProvider.revertChanges()
			return
		}

		cline.consecutiveMistakeCount = 0

		// if isEditingFile false, that means we have the full contents of the file already.
		// it's important to note how cline function works, you can't make the assumption that the block.partial conditional will always be called since it may immediately get complete, non-partial data. So cline part of the logic will always be called.
		// in other words, you must always repeat the block.partial logic here
		await handleDiffViewUpdate(cline, relPath, newContent, false, sharedMessageProps)

		await delay(300) // wait for diff view to update
		cline.diffViewProvider.scrollToFirstDiff()

		// Check for code omissions before proceeding
		if (detectCodeOmission(cline.diffViewProvider.originalContent || "", newContent, predictedLineCount)) {
			if (cline.diffStrategy) {
				await cline.diffViewProvider.revertChanges()

				pushToolResult(
					formatResponse.toolError(
						`Content appears to be truncated (file has ${
							newContent.split("\n").length
						} lines but was predicted to have ${predictedLineCount} lines), and found comments indicating omitted code (e.g., '// rest of code unchanged', '/* previous code */'). Please provide the complete file content without any omissions if possible, or otherwise use the 'apply_diff' tool to apply the diff to the original file.`,
					),
				)
				return
			} else {
				vscode.window
					.showWarningMessage(
						"Potential code truncation detected. This happens when the AI reaches its max output limit.",
						"Follow cline guide to fix the issue",
					)
					.then((selection) => {
						if (selection === "Follow cline guide to fix the issue") {
							vscode.env.openExternal(
								vscode.Uri.parse(
									"https://github.com/cline/cline/wiki/Troubleshooting-%E2%80%90-Cline-Deleting-Code-with-%22Rest-of-Code-Here%22-Comments",
								),
							)
						}
					})
			}
		}

		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			content: fileExists ? undefined : newContent,
			diff: fileExists
				? formatResponse.createPrettyPatch(relPath, cline.diffViewProvider.originalContent, newContent)
				: undefined,
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

		cline.didEditFile = true // used to determine if we should wait for busy terminal to update before sending api request

		if (userEdits) {
			await cline.say(
				"user_feedback_diff",
				JSON.stringify({
					tool: fileExists ? "editedExistingFile" : "newFileCreated",
					path: getReadablePath(cline.cwd, relPath),
					diff: userEdits,
				} satisfies ClineSayTool),
			)

			pushToolResult(
				`The user made the following updates to your content:\n\n${userEdits}\n\n` +
					`The updated content, which includes both your original modifications and the user's edits, has been successfully saved to ${relPath.toPosix()}. Here is the full, updated content of the file, including line numbers:\n\n` +
					`<final_file_content path="${relPath.toPosix()}">\n${addLineNumbers(
						finalContent || "",
					)}\n</final_file_content>\n\n` +
					`Please note:\n` +
					`1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
					`2. Proceed with the task using this updated file content as the new baseline.\n` +
					`3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
					`${newProblemsMessage}`,
			)
		} else {
			pushToolResult(`The content was successfully saved to ${relPath.toPosix()}.${newProblemsMessage}`)
		}

		await cline.diffViewProvider.reset()
	} catch (error) {
		await handleError("writing file", error)
		await cline.diffViewProvider.reset()
		return
	}
}
