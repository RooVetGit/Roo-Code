import path from "path"
import { isBinaryFile } from "isbinaryfile"

import { Cline } from "../Cline"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { getReadablePath } from "../../utils/path"
import { countFileLines } from "../../integrations/misc/line-counter"
import { readLines } from "../../integrations/misc/read-lines"
import { extractTextFromFile, addLineNumbers } from "../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../services/tree-sitter"
import { RooCodeSettings } from "../../schemas" // Import the settings type

export async function readFileTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const pathParam: string | undefined = block.params.path
	const startLineStr: string | undefined = block.params.start_line
	const endLineStr: string | undefined = block.params.end_line

	let relPaths: string[] = []
	let parseError = false

	if (!pathParam) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("read_file")
		const errorMsg = await cline.sayAndCreateMissingParamError("read_file", "path")
		pushToolResult(`<tool_error tool_name="read_file">${errorMsg}</tool_error>`)
		return
	}

	const cleanedPathParam = removeClosingTag("path", pathParam)

	// Try parsing as JSON array with improved error handling
	if (cleanedPathParam.startsWith('[') && cleanedPathParam.includes('"')) {
		// Check if it looks like a JSON array but doesn't end correctly
		if (!cleanedPathParam.endsWith(']')) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("read_file")
			const errorMsg = t("tools:readFile.error.incompleteJsonArray", { value: cleanedPathParam })
			await cline.say("error", errorMsg)
			pushToolResult(`<tool_error tool_name="read_file">${errorMsg}</tool_error>`)
			return
		}
		try {
			const parsed = JSON.parse(cleanedPathParam)
			if (Array.isArray(parsed) && parsed.every((p) => typeof p === "string")) {
				relPaths = parsed
			} else {
				// Parsed successfully but not an array of strings
				cline.consecutiveMistakeCount++
				cline.recordToolError("read_file")
				const errorMsg = t("tools:readFile.error.invalidArrayFormat", { value: cleanedPathParam })
				await cline.say("error", errorMsg)
				pushToolResult(`<tool_error tool_name="read_file">${errorMsg}</tool_error>`)
				return
			}
		} catch (e) {
			// JSON parsing failed but it looked like an attempt at JSON
			cline.consecutiveMistakeCount++
			cline.recordToolError("read_file")
			const errorMsg = t("tools:readFile.error.invalidJsonArray", { value: cleanedPathParam })
			await cline.say("error", errorMsg)
			pushToolResult(`<tool_error tool_name="read_file">${errorMsg}</tool_error>`)
			return
		}
	} else {
		// Not JSON, treat as a single path
		relPaths = [cleanedPathParam]
	}

	// Filter out empty paths
	relPaths = relPaths.filter((p) => p.trim() !== "")

	if (relPaths.length === 0) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("read_file")
		const errorMsg = t("tools:readFile.error.noValidPaths")
		await cline.say("error", errorMsg)
		pushToolResult(`<tool_error tool_name="read_file">${errorMsg}</tool_error>`)
		return
	}

	// Get provider and state safely
	const provider = cline.providerRef.deref()
	const state = provider ? await provider.getState() : {} // Get state or default to empty object

	// Use Partial<RooCodeSettings> for better type safety with defaults
	const {
		maxReadFileLine = 500,
		maxConcurrentFileReads = 1,
		alwaysAllowReadOnly = false,
		alwaysAllowReadOnlyOutsideWorkspace = false,
	}: Partial<RooCodeSettings> = state // Apply type here

	// Validate against maxConcurrentFileReads
	if (relPaths.length > maxConcurrentFileReads) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("read_file")
		const errorMsg = t("tools:readFile.error.tooManyFiles", { count: relPaths.length, max: maxConcurrentFileReads })
		await cline.say("error", errorMsg)
		pushToolResult(`<tool_error tool_name="read_file">${errorMsg}</tool_error>`)
		return
	}

	// Check for line range parameters (only valid for single file)
	if ((startLineStr || endLineStr) && relPaths.length > 1) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("read_file")
		const errorMsg = t("tools:readFile.error.lineParamsMultipleFiles")
		await cline.say("error", errorMsg)
		pushToolResult(`<tool_error tool_name="read_file">${errorMsg}</tool_error>`)
		return
	}

	const isFullRead = maxReadFileLine === -1

	// Check if we're doing a line range read
	let isRangeRead = false
	let startLine: number | undefined = undefined
	let endLine: number | undefined = undefined

	// Check if we have either range parameter and we're not doing a full read
	if (!isFullRead && (startLineStr || endLineStr)) {
		isRangeRead = true
	}

	// Parse start_line if provided
	if (startLineStr) {
		startLine = parseInt(startLineStr)
		if (isNaN(startLine)) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("read_file")
			const errorMsg = t("tools:readFile.error.invalidStartLine", { value: startLineStr })
			await cline.say("error", errorMsg)
			pushToolResult(`<tool_error tool_name="read_file">${errorMsg}</tool_error>`)
			return
		}
		startLine -= 1 // Convert to 0-based index
	}

	// Parse end_line if provided
	if (endLineStr) {
		endLine = parseInt(endLineStr)
		if (isNaN(endLine)) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("read_file")
			const errorMsg = t("tools:readFile.error.invalidEndLine", { value: endLineStr })
			await cline.say("error", errorMsg)
			pushToolResult(`<tool_error tool_name="read_file">${errorMsg}</tool_error>`)
			return
		}
		endLine -= 1 // Convert to 0-based index
	}

	// --- Approval Logic ---
	let needsApproval = false
	const pathsRequiringApproval: string[] = []
	const absolutePaths: string[] = []

	for (const relPath of relPaths) {
		const absolutePath = path.resolve(cline.cwd, relPath)
		absolutePaths.push(absolutePath)

		const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			await cline.say("rooignore_error", relPath)
			const errorMsg = formatResponse.rooIgnoreError(relPath)
			// Push individual error for this file, but continue processing others
			pushToolResult(`<file_error path="${relPath}" reason="${errorMsg}"/>`)
			continue // Skip this file
		}

		const isOutside = isPathOutsideWorkspace(absolutePath)
		const requiresThisFileApproval =
			(isOutside && !alwaysAllowReadOnlyOutsideWorkspace) || (!isOutside && !alwaysAllowReadOnly)

		if (requiresThisFileApproval) {
			needsApproval = true
			pathsRequiringApproval.push(getReadablePath(cline.cwd, relPath))
		}
	}

	// If any file requires approval, ask once for the batch
	if (needsApproval) {
		// Create line snippet description for approval message
		let lineSnippet = ""
		if (isFullRead) {
			// No snippet for full read
		} else if (startLine !== undefined && endLine !== undefined) {
			lineSnippet = t("tools:readFile.linesRange", { start: startLine + 1, end: endLine + 1 })
		} else if (startLine !== undefined) {
			lineSnippet = t("tools:readFile.linesFromToEnd", { start: startLine + 1 })
		} else if (endLine !== undefined) {
			lineSnippet = t("tools:readFile.linesFromStartTo", { end: endLine + 1 })
		} else if (maxReadFileLine === 0) {
			lineSnippet = t("tools:readFile.definitionsOnly")
		} else if (maxReadFileLine > 0) {
			lineSnippet = t("tools:readFile.maxLines", { max: maxReadFileLine })
		}

		const approvalMessageContent =
			pathsRequiringApproval.length === 1
				? pathsRequiringApproval[0]
				: t("tools:readFile.multipleFiles", { count: pathsRequiringApproval.length })

		const completeMessage = JSON.stringify({
			tool: "readFile",
			path: approvalMessageContent, // Show single path or "X files"
			isOutsideWorkspace: pathsRequiringApproval.some((p) => isPathOutsideWorkspace(path.resolve(cline.cwd, p))), // True if any are outside
			content: approvalMessageContent, // Use path/count for content display
			reason: lineSnippet,
		} satisfies ClineSayTool)

		const didApprove = await askApproval("tool", completeMessage)
		if (!didApprove) {
			// User denied approval for the batch
			pushToolResult(`<tool_error tool_name="read_file">${t("common:errors.userDeniedApproval")}</tool_error>`)
			return
		}
	}
	// --- End Approval Logic ---

	cline.consecutiveMistakeCount = 0
	const results: string[] = []

	for (let i = 0; i < relPaths.length; i++) {
		const relPath = relPaths[i]
		const absolutePath = absolutePaths[i] // Use pre-resolved path

		// Re-check rooignore in case it was skipped during approval check
		if (!cline.rooIgnoreController?.validateAccess(relPath)) {
			// This check might be redundant if the approval logic already pushed an error,
			// but ensures consistency if approval wasn't needed.
			const errorMsg = formatResponse.rooIgnoreError(relPath)
			results.push(`<file_error path="${relPath}" reason="${errorMsg}"/>`)
			continue
		}

		try {
			// Count total lines in the file
			let totalLines = 0;
			try {
				// Log before counting using the provider's logger
				cline.providerRef.deref()?.log(`[readFileTool] Counting lines for: ${absolutePath}`);
				totalLines = await countFileLines(absolutePath);
				cline.providerRef.deref()?.log(`[readFileTool] Counted ${totalLines} lines for: ${absolutePath}`);
			} catch (error: any) {
				// Log the specific error during counting using the provider's logger
				cline.providerRef.deref()?.log(`[readFileTool] Error counting lines for ${relPath} (${absolutePath}): ${error?.message}`);
				
				// Handle specific file error using relPath, not the entire array
				if (error.code === "ENOENT") {
					const errorMsg = t("tools:readFile.error.fileNotFound", { path: relPath });
					results.push(`<file_error path="${relPath}" reason="${errorMsg}"/>`);
				} else {
					const errorMsg = t("tools:readFile.error.countingLines", { path: relPath, message: error.message });
					results.push(`<file_error path="${relPath}" reason="${errorMsg}"/>`);
				}
				continue; // Skip to next file on error
			}

			// Now execute the tool like normal for this file
			let content: string
			let isFileTruncated = false
			let sourceCodeDef = ""

			const isBinary = await isBinaryFile(absolutePath).catch(() => false)

			if (isRangeRead) {
				if (startLine === undefined) {
					content = addLineNumbers(await readLines(absolutePath, endLine, startLine))
				} else {
					content = addLineNumbers(await readLines(absolutePath, endLine, startLine), startLine + 1)
				}
			} else if (!isBinary && maxReadFileLine >= 0 && totalLines > maxReadFileLine) {
				// If file is too large, only read the first maxReadFileLine lines
				isFileTruncated = true

				const res = await Promise.all([
					maxReadFileLine > 0 ? readLines(absolutePath, maxReadFileLine - 1, 0) : "",
					parseSourceCodeDefinitionsForFile(absolutePath, cline.rooIgnoreController),
				])

				content = res[0].length > 0 ? addLineNumbers(res[0]) : ""
				const result = res[1]

				if (result) {
					sourceCodeDef = `${result}`
				}
			} else {
				// Read entire file
				content = await extractTextFromFile(absolutePath)
			}

			// Create variables to store XML components for this file
			let xmlInfo = ""
			let contentTag = ""

			// Add truncation notice if applicable
			if (isFileTruncated) {
				xmlInfo += `<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines. Use start_line and end_line if you need to read more</notice>\n`

				// Add source code definitions if available
				if (sourceCodeDef) {
					xmlInfo += `<list_code_definition_names>${sourceCodeDef}</list_code_definition_names>\n`
				}
			}

			// Empty files (zero lines)
			if (content === "" && totalLines === 0) {
				// Always add self-closing content tag and notice for empty files
				contentTag = `<content/>`
				xmlInfo += `<notice>File is empty</notice>\n`
			}
			// Range reads should always show content regardless of maxReadFileLine
			else if (isRangeRead) {
				// Create content tag with line range information
				let lineRangeAttr = ""
				const displayStartLine = startLine !== undefined ? startLine + 1 : 1
				const displayEndLine = endLine !== undefined ? endLine + 1 : totalLines
				lineRangeAttr = ` lines="${displayStartLine}-${displayEndLine}"`

				contentTag = `<content${lineRangeAttr}>\n${content}\n</content>\n` // Added newline before closing tag
			}
			// maxReadFileLine=0 for non-range reads
			else if (maxReadFileLine === 0 && !isRangeRead) { // Ensure range reads still show content even if maxReadFileLine is 0
				// Skip content tag for maxReadFileLine=0 (definitions only mode)
				contentTag = ""
				// Still add definitions if available and truncated (though truncation might not happen if maxReadFileLine is 0)
				if (sourceCodeDef) {
					xmlInfo += `<list_code_definition_names>${sourceCodeDef}</list_code_definition_names>\n`
				}
			}
			// Normal case: non-empty files with content (non-range reads)
			else {
				// For non-range reads, always show line range
				let lines = totalLines

				if (maxReadFileLine >= 0 && totalLines > maxReadFileLine) {
					lines = maxReadFileLine
				}

				const lineRangeAttr = ` lines="1-${lines}"`

				contentTag = `<content${lineRangeAttr}>\n${content}\n</content>\n` // Added newline before closing tag
			}

			// Track file read operation
			await cline.getFileContextTracker().trackFileContext(relPath, "read_tool" as RecordSource)

			// Format the result for this file
			const fileResult = `<file_content path="${relPath}">\n${contentTag}${xmlInfo}</file_content>`
			results.push(fileResult)
		} catch (error: any) {
			// Log general errors during reading/processing using the provider's logger
			cline.providerRef.deref()?.log(`[readFileTool] Error processing file ${relPath} (${absolutePath}): ${error?.message}`);
			const errorMsg = t("tools:readFile.error.readingFile", { path: relPath, message: error.message });
			results.push(`<file_error path="${relPath}" reason="${errorMsg}"/>`);
			// Continue to the next file
		}
	} // End loop through paths

	// Aggregate results and push
	if (results.length > 0) {
		const finalResult = `<read_result>\n${results.join("\n")}\n</read_result>`
		pushToolResult(finalResult)
	} else {
		// This case might happen if all paths resulted in errors handled within the loop
		pushToolResult(`<read_result/>`)
	}
}