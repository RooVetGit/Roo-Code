import path from "path"
import { Cline } from "../Cline"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { ToolUse } from "../assistant-message"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "./types"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { getReadablePath } from "../../utils/path"
import { readFileContent } from "../../integrations/misc/extract-text"

export async function readFileTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relPath: string | undefined = block.params.path
	const startLineStr: string | undefined = block.params.start_line
	const endLineStr: string | undefined = block.params.end_line

	// Get the full path and determine if it's outside the workspace
	const fullPath = relPath ? path.resolve(cline.cwd, removeClosingTag("path", relPath)) : ""
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

	const sharedMessageProps: ClineSayTool = {
		tool: "readFile",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relPath)),
		isOutsideWorkspace,
	}
	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				...sharedMessageProps,
				content: undefined,
			} satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!relPath) {
				cline.consecutiveMistakeCount++
				const errorMsg = await cline.sayAndCreateMissingParamError("read_file", "path")
				pushToolResult(`<file><path></path><error>${errorMsg}</error></file>`)
				return
			}

			// Check if we're doing a line range read
			let isRangeRead = false
			let startLine: number | undefined = undefined
			let endLine: number | undefined = undefined

			// Check if we have either range parameter
			if (startLineStr || endLineStr) {
				isRangeRead = true
			}

			// Parse start_line if provided
			if (startLineStr) {
				startLine = parseInt(startLineStr)
				if (isNaN(startLine)) {
					// Invalid start_line
					cline.consecutiveMistakeCount++
					await cline.say("error", `Failed to parse start_line: ${startLineStr}`)
					pushToolResult(`<file><path>${relPath}</path><error>Invalid start_line value</error></file>`)
					return
				}
				startLine -= 1 // Convert to 0-based index
			}

			// Parse end_line if provided
			if (endLineStr) {
				endLine = parseInt(endLineStr)

				if (isNaN(endLine)) {
					// Invalid end_line
					cline.consecutiveMistakeCount++
					await cline.say("error", `Failed to parse end_line: ${endLineStr}`)
					pushToolResult(`<file><path>${relPath}</path><error>Invalid end_line value</error></file>`)
					return
				}

				// Convert to 0-based index
				endLine -= 1
			}

			const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
			if (!accessAllowed) {
				await cline.say("rooignore_error", relPath)
				const errorMsg = formatResponse.rooIgnoreError(relPath)
				pushToolResult(`<file><path>${relPath}</path><error>${errorMsg}</error></file>`)
				return
			}

			const { maxReadFileLine = 500 } = (await cline.providerRef.deref()?.getState()) ?? {}

			// Create line snippet description for approval message
			let lineSnippet = ""
			if (startLine !== undefined && endLine !== undefined) {
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

			cline.consecutiveMistakeCount = 0
			const absolutePath = path.resolve(cline.cwd, relPath)

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: absolutePath,
				reason: lineSnippet,
			} satisfies ClineSayTool)

			const didApprove = await askApproval("tool", completeMessage)
			if (!didApprove) {
				return
			}

			// Use readFileContent with relPath to get XML formatted output directly
			const xmlResult = await readFileContent(absolutePath, {
				maxReadFileLine: maxReadFileLine,
				startLine: isRangeRead ? startLine : undefined,
				endLine: isRangeRead ? endLine : undefined,
				rooIgnoreController: cline.rooIgnoreController,
				relPath: relPath,
			})
			pushToolResult(xmlResult)
			// Track file read operation
			if (relPath) {
				await cline.getFileContextTracker().trackFileContext(relPath, "read_tool" as RecordSource)
			}
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		pushToolResult(`<file><path>${relPath || ""}</path><error>Error reading file: ${errorMsg}</error></file>`)
		await handleError("reading file", error)
	}
}
