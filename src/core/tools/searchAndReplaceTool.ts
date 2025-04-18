import path from "path"
import fs from "fs/promises"

import { Cline } from "../Cline"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { fileExistsAtPath } from "../../utils/fs"
import { addLineNumbers } from "../../integrations/misc/extract-text"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { parseXml } from "../../utils/xml"

type SearchReplaceOperation = {
	search: string
	replace: string
	"@_start_line"?: string
	"@_end_line"?: string
	"@_use_regex"?: string
	"@_ignore_case"?: string
	"@_regex_flags"?: string
}

export async function searchAndReplaceTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	const operations: string | undefined = block.params.operations

	const sharedMessageProps: ClineSayTool = {
		tool: "appliedDiff",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
	}

	try {
		// Handle partial block
		if (block.partial) {
			await handlePartialBlock(cline, relPath, operations, removeClosingTag)
			return
		}

		// Validate required parameters
		if (!relPath || !operations) {
			await handleMissingParams(cline, pushToolResult, relPath, operations)
			return
		}

		// Validate file exists
		const absolutePath = path.resolve(cline.cwd, relPath)
		const fileExists = await fileExistsAtPath(absolutePath)
		if (!fileExists) {
			await handleFileNotFound(cline, pushToolResult, absolutePath)
			return
		}

		// Parse operations
		const parsedOperations = await parseOperations(cline, operations, pushToolResult)
		if (!parsedOperations) return

		// Read and process file content
		const fileContent = await fs.readFile(absolutePath, "utf-8")
		const newContent = await processOperations(parsedOperations, fileContent)

		// Setup diff view
		cline.diffViewProvider.editType = "modify"
		cline.diffViewProvider.originalContent = fileContent

		// Generate and validate diff
		const diff = formatResponse.createPrettyPatch(relPath, fileContent, newContent)
		if (!diff) {
			pushToolResult(`No changes needed for '${relPath}'`)
			return
		}

		// Show diff preview and get approval
		const approved = await showDiffPreview(cline, relPath, newContent, diff, sharedMessageProps, askApproval)
		if (!approved) {
			await cline.diffViewProvider.revertChanges()
			return
		}

		// Save changes and handle user edits
		await saveChangesAndHandleEdits(cline, relPath, fileExists, pushToolResult)

		cline.recordToolUsage({ toolName: "search_and_replace" })
		await cline.diffViewProvider.reset()
	} catch (error) {
		await handleError("applying search and replace", error)
		await cline.diffViewProvider.reset()
	}
}

async function handlePartialBlock(
	cline: Cline,
	relPath: string | undefined,
	operations: string | undefined,
	removeClosingTag: RemoveClosingTag,
) {
	const partialMessage = JSON.stringify({
		path: removeClosingTag("path", relPath),
		operations: removeClosingTag("operations", operations),
	})
	await cline.ask("tool", partialMessage, true).catch(() => {})
}

async function handleMissingParams(
	cline: Cline,
	pushToolResult: PushToolResult,
	relPath: string | undefined,
	operations: string | undefined,
) {
	cline.consecutiveMistakeCount++
	cline.recordToolUsage({ toolName: "search_and_replace", success: false })

	if (!relPath) {
		pushToolResult(await cline.sayAndCreateMissingParamError("search_and_replace", "path"))
		return
	}

	pushToolResult(await cline.sayAndCreateMissingParamError("search_and_replace", "operations"))
}

async function handleFileNotFound(cline: Cline, pushToolResult: PushToolResult, absolutePath: string) {
	cline.consecutiveMistakeCount++
	cline.recordToolUsage({ toolName: "search_and_replace", success: false })
	const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
	await cline.say("error", formattedError)
	pushToolResult(formattedError)
}

async function parseOperations(
	cline: Cline,
	operations: string,
	pushToolResult: PushToolResult,
): Promise<SearchReplaceOperation[] | null> {
	try {
		const xmlResult = parseXml(operations, ["operation.search", "operation.replace"]) as {
			operation: SearchReplaceOperation[] | SearchReplaceOperation
		}

		const ops = Array.isArray(xmlResult.operation) ? xmlResult.operation : [xmlResult.operation]
		return ops.map((op) => ({
			search: op.search,
			replace: op.replace,
			start_line: op["@_start_line"] ? parseInt(op["@_start_line"], 10) : undefined,
			end_line: op["@_end_line"] ? parseInt(op["@_end_line"], 10) : undefined,
			use_regex: op["@_use_regex"] === "true",
			ignore_case: op["@_ignore_case"] === "true",
			regex_flags: op["@_regex_flags"],
		}))
	} catch (error) {
		cline.consecutiveMistakeCount++
		cline.recordToolUsage({ toolName: "search_and_replace", success: false })
		await cline.say("error", `Failed to parse operations: ${error.message}`)
		pushToolResult(formatResponse.toolError("Invalid operations XML format"))
		return null
	}
}

async function processOperations(operations: SearchReplaceOperation[], fileContent: string): Promise<string> {
	let lines = fileContent.split("\n")

	for (const op of operations) {
		const flags = op["@_regex_flags"] ?? (op["@_ignore_case"] === "true" ? "gi" : "g")
		const multilineFlags = flags.includes("m") ? flags : flags + "m"

		const searchPattern =
			op["@_use_regex"] === "true"
				? new RegExp(op.search, multilineFlags)
				: new RegExp(escapeRegExp(op.search), multilineFlags)

		if (op["@_start_line"] || op["@_end_line"]) {
			lines = processLineRange(lines, op, searchPattern)
		} else {
			lines = processGlobalReplace(lines, searchPattern, op.replace)
		}
	}

	return lines.join("\n")
}

function processLineRange(lines: string[], op: SearchReplaceOperation, searchPattern: RegExp): string[] {
	const startLine = Math.max((op["@_start_line"] ? parseInt(op["@_start_line"], 10) : 1) - 1, 0)
	const endLine = Math.min((op["@_end_line"] ? parseInt(op["@_end_line"], 10) : lines.length) - 1, lines.length - 1)

	const beforeLines = lines.slice(0, startLine)
	const afterLines = lines.slice(endLine + 1)

	const targetContent = lines.slice(startLine, endLine + 1).join("\n")
	const modifiedContent = targetContent.replace(searchPattern, op.replace)
	const modifiedLines = modifiedContent.split("\n")

	return [...beforeLines, ...modifiedLines, ...afterLines]
}

function processGlobalReplace(lines: string[], searchPattern: RegExp, replace: string): string[] {
	const fullContent = lines.join("\n")
	const modifiedContent = fullContent.replace(searchPattern, replace)
	return modifiedContent.split("\n")
}

async function showDiffPreview(
	cline: Cline,
	relPath: string,
	newContent: string,
	diff: string,
	sharedMessageProps: ClineSayTool,
	askApproval: AskApproval,
): Promise<boolean> {
	await cline.diffViewProvider.open(relPath)
	await cline.diffViewProvider.update(newContent, true)
	cline.diffViewProvider.scrollToFirstDiff()

	const completeMessage = JSON.stringify({ ...sharedMessageProps, diff } satisfies ClineSayTool)
	return askApproval("tool", completeMessage)
}

async function saveChangesAndHandleEdits(
	cline: Cline,
	relPath: string,
	fileExists: boolean,
	pushToolResult: PushToolResult,
) {
	const { newProblemsMessage, userEdits, finalContent } = await cline.diffViewProvider.saveChanges()

	if (relPath) {
		await cline.getFileContextTracker().trackFileContext(relPath, "roo_edited" as RecordSource)
	}

	cline.didEditFile = true
	cline.consecutiveMistakeCount = 0

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
				`<final_file_content path="${relPath.toPosix()}">\n${addLineNumbers(finalContent || "")}\n</final_file_content>\n\n` +
				`Please note:\n` +
				`1. You do not need to re-write the file with these changes, as they have already been applied.\n` +
				`2. Proceed with the task using cline updated file content as the new baseline.\n` +
				`3. If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.` +
				`${newProblemsMessage}`,
		)
	} else {
		pushToolResult(`Changes successfully applied to ${relPath.toPosix()}:\n\n${newProblemsMessage}`)
	}
}

function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
