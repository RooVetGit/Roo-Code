// Core Node.js imports
import path from "path"
import fs from "fs/promises"
import delay from "delay"

// Internal imports
import { Task } from "../task/Task"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolUse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { fileExistsAtPath } from "../../utils/fs"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"

/**
 * Tool for performing search and replace operations on files
 * Supports regex and case-sensitive/insensitive matching
 */

/**
 * Validates required parameters for search and replace operation
 */
async function validateParams(
	cline: Task,
	relPath: string | undefined,
	search: string | undefined,
	replace: string | undefined,
	pushToolResult: PushToolResult,
): Promise<boolean> {
	if (!relPath) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("search_and_replace")
		pushToolResult(await cline.sayAndCreateMissingParamError("search_and_replace", "path"))
		return false
	}

	if (!search) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("search_and_replace")
		pushToolResult(await cline.sayAndCreateMissingParamError("search_and_replace", "search"))
		return false
	}

	if (replace === undefined) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("search_and_replace")
		pushToolResult(await cline.sayAndCreateMissingParamError("search_and_replace", "replace"))
		return false
	}

	return true
}

/**
 * Performs search and replace operations on a file
 * @param cline - Cline instance
 * @param block - Tool use parameters
 * @param askApproval - Function to request user approval
 * @param handleError - Function to handle errors
 * @param pushToolResult - Function to push tool results
 * @param removeClosingTag - Function to remove closing tags
 */
export async function searchAndReplaceTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	// Extract and validate parameters
	const relPath: string | undefined = block.params.path
	const search: string | undefined = block.params.search
	const replace: string | undefined = block.params.replace
	const useRegex: boolean = block.params.use_regex === "true"
	const ignoreCase: boolean = block.params.ignore_case === "true"
	const requireUniqueMatch: boolean = block.params.requireUniqueMatch === "true" // Added
	const startLine: number | undefined = block.params.start_line ? parseInt(block.params.start_line, 10) : undefined
	const endLine: number | undefined = block.params.end_line ? parseInt(block.params.end_line, 10) : undefined

	try {
		// Handle partial tool use
		if (block.partial) {
			const partialMessageProps = {
				tool: "searchAndReplace" as const,
				path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
				search: removeClosingTag("search", search),
				replace: removeClosingTag("replace", replace),
				useRegex: block.params.use_regex === "true",
				ignoreCase: block.params.ignore_case === "true",
				requireUniqueMatch: block.params.requireUniqueMatch === "true", // Added
				startLine,
				endLine,
			}
			await cline.ask("tool", JSON.stringify(partialMessageProps), block.partial).catch(() => {})
			return
		}

		// Validate required parameters
		if (!(await validateParams(cline, relPath, search, replace, pushToolResult))) {
			return
		}

		// At this point we know relPath, search and replace are defined
		const validRelPath = relPath as string
		const validSearch = search as string
		const validReplace = replace as string

		const sharedMessageProps: ClineSayTool = {
			tool: "searchAndReplace",
			path: getReadablePath(cline.cwd, validRelPath),
			search: validSearch,
			replace: validReplace,
			useRegex: useRegex,
			ignoreCase: ignoreCase,
			requireUniqueMatch: requireUniqueMatch, // Added
			startLine: startLine,
			endLine: endLine,
		}

		const accessAllowed = cline.rooIgnoreController?.validateAccess(validRelPath)

		if (!accessAllowed) {
			await cline.say("rooignore_error", validRelPath)
			pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(validRelPath)))
			return
		}

		const absolutePath = path.resolve(cline.cwd, validRelPath)
		const fileExists = await fileExistsAtPath(absolutePath)

		if (!fileExists) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("search_and_replace")
			const formattedError = formatResponse.toolError(
				`File does not exist at path: ${absolutePath}\nThe specified file could not be found. Please verify the file path and try again.`,
			)
			await cline.say("error", formattedError)
			pushToolResult(formattedError)
			return
		}

		// Reset consecutive mistakes since all validations passed
		cline.consecutiveMistakeCount = 0

		// Read and process file content
		let fileContent: string
		try {
			fileContent = await fs.readFile(absolutePath, "utf-8")
		} catch (error) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("search_and_replace")
			const errorMessage = `Error reading file: ${absolutePath}\nFailed to read the file content: ${
				error instanceof Error ? error.message : String(error)
			}\nPlease verify file permissions and try again.`
			const formattedError = formatResponse.toolError(errorMessage)
			await cline.say("error", formattedError)
			pushToolResult(formattedError)
			return
		}

		// Determine the text to search in
		let textToSearchIn: string
		let isRangeSearch = false
		const lines = fileContent.split("\n")
		let startRange = 0
		let endRange = lines.length

		if (startLine !== undefined || endLine !== undefined) {
			isRangeSearch = true
			startRange = Math.max((startLine ?? 1) - 1, 0)
			endRange = Math.min((endLine ?? lines.length), lines.length) // Use lines.length for slice end
			textToSearchIn = lines.slice(startRange, endRange).join("\n")
		} else {
			textToSearchIn = fileContent
		}

		if (requireUniqueMatch) {
			// If useRegex is true, we cannot reliably count literal occurrences with split.
			// The LLM should be instructed to use requireUniqueMatch with literal strings, not regex.
			// For this implementation, we'll assume validSearch is a literal string if requireUniqueMatch is true.
			if (useRegex) {
				pushToolResult(
					formatResponse.toolError(
						`Error: requireUniqueMatch cannot be used with use_regex=true. Please provide a literal search string.`,
					),
				)
				return
			}

			const searchTermForCounting = ignoreCase ? validSearch.toLowerCase() : validSearch
			const sourceTextForCounting = ignoreCase ? textToSearchIn.toLowerCase() : textToSearchIn
			const occurrences = sourceTextForCounting.split(searchTermForCounting).length - 1

			if (occurrences === 0) {
				pushToolResult(
					formatResponse.toolError(
						`Error: Could not find the exact text '${validSearch}' to replace in ${validRelPath}${
							isRangeSearch ? ` (lines ${startLine}-${endLine})` : ""
						}.`,
					),
				)
				return
			}
			if (occurrences > 1) {
				pushToolResult(
					formatResponse.toolError(
						`Error: Found multiple (${occurrences}) occurrences of the text '${validSearch}' in ${validRelPath}${
							isRangeSearch ? ` (lines ${startLine}-${endLine})` : ""
						}. Must be unique when requireUniqueMatch is true.`,
					),
				)
				return
			}
		}

		// Create search pattern and perform replacement
		let newContent: string

		if (requireUniqueMatch) {
			// Literal, single replacement
			const singleReplacePattern = new RegExp(escapeRegExp(validSearch), ignoreCase ? "i" : "")
			if (isRangeSearch) {
				const beforeLines = lines.slice(0, startRange)
				const afterLines = lines.slice(endRange)
				const targetContent = lines.slice(startRange, endRange).join("\n")
				const modifiedContent = targetContent.replace(singleReplacePattern, validReplace)
				newContent = [...beforeLines, modifiedContent, ...afterLines].join("\n")
			} else {
				newContent = fileContent.replace(singleReplacePattern, validReplace)
			}
		} else {
			// Global or regex replacement (existing logic)
			const globalSearchPattern = useRegex
				? new RegExp(validSearch, ignoreCase ? "gi" : "g")
				: new RegExp(escapeRegExp(validSearch), ignoreCase ? "gi" : "g")

			if (isRangeSearch) {
				const beforeLines = lines.slice(0, startRange)
				const afterLines = lines.slice(endRange)
				const targetContent = lines.slice(startRange, endRange).join("\n")
				const modifiedContent = targetContent.replace(globalSearchPattern, validReplace)
				newContent = [...beforeLines, modifiedContent, ...afterLines].join("\n")
			} else {
				newContent = fileContent.replace(globalSearchPattern, validReplace)
			}
		}

		// Initialize diff view
		cline.diffViewProvider.editType = "modify"
		cline.diffViewProvider.originalContent = fileContent

		// Generate and validate diff
		const diff = formatResponse.createPrettyPatch(validRelPath, fileContent, newContent)
		if (!diff) {
			pushToolResult(`No changes needed for '${relPath}'`)
			await cline.diffViewProvider.reset()
			return
		}

		// Show changes in diff view
		if (!cline.diffViewProvider.isEditing) {
			await cline.ask("tool", JSON.stringify(sharedMessageProps), true).catch(() => {})
			await cline.diffViewProvider.open(validRelPath)
			await cline.diffViewProvider.update(fileContent, false)
			cline.diffViewProvider.scrollToFirstDiff()
			await delay(200)
		}

		await cline.diffViewProvider.update(newContent, true)

		// Request user approval for changes
		const completeMessage = JSON.stringify({ ...sharedMessageProps, diff } satisfies ClineSayTool)
		const didApprove = await cline
			.ask("tool", completeMessage, false)
			.then((response) => response.response === "yesButtonClicked")

		if (!didApprove) {
			await cline.diffViewProvider.revertChanges()
			pushToolResult("Changes were rejected by the user.")
			await cline.diffViewProvider.reset()
			return
		}

		// Save current state to history BEFORE writing the new state
		// fileContent is the original content before replacement, which is also what originalContent should be.
		if (cline.diffViewProvider.originalContent !== undefined && cline.diffViewProvider.originalContent !== null) {
			const absolutePath = path.resolve(cline.cwd, validRelPath);
			const history = cline.editHistory.get(absolutePath) || [];
			history.push(cline.diffViewProvider.originalContent);
			cline.editHistory.set(absolutePath, history);
		}

		// Call saveChanges to update the DiffViewProvider properties
		await cline.diffViewProvider.saveChanges()

		// Track file edit operation
		if (relPath) {
			await cline.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
		}

		cline.didEditFile = true

		// Get the formatted response message
		const message = await cline.diffViewProvider.pushToolWriteResult(
			cline,
			cline.cwd,
			false, // Always false for search_and_replace
		)

		pushToolResult(message)

		// Record successful tool usage and cleanup
		cline.recordToolUsage("search_and_replace")
		await cline.diffViewProvider.reset()
	} catch (error) {
		handleError("search and replace", error)
		await cline.diffViewProvider.reset()
	}
}

/**
 * Escapes special regex characters in a string
 * @param input String to escape regex characters in
 * @returns Escaped string safe for regex pattern matching
 */
function escapeRegExp(input: string): string {
	return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
