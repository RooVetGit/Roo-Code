import path from "path"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { t } from "../../i18n"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { getReadablePath } from "../../utils/path"
import { processFileForReading, formatProcessedFileResultToString } from "../../shared/fileReadUtils"

export async function readFileTool(
	cline: Task,
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
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: undefined } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!relPath) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("read_file")
				const errorMsg = await cline.sayAndCreateMissingParamError("read_file", "path")
				pushToolResult(`<file><path></path><error>${errorMsg}</error></file>`)
				return
			}

			const { maxReadFileLine = -1 } = (await cline.providerRef.deref()?.getState()) ?? {}
			const isFullRead = maxReadFileLine === -1

			// Parse start_line if provided (keep as 1-based)
			let requestedStartLine: number | undefined = undefined
			if (startLineStr) {
				requestedStartLine = parseInt(startLineStr)
				if (isNaN(requestedStartLine)) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("read_file")
					await cline.say("error", `Failed to parse start_line: ${startLineStr}`)
					pushToolResult(`<file><path>${relPath}</path><error>Invalid start_line value</error></file>`)
					return
				}
			}

			// Parse end_line if provided (keep as 1-based)
			let requestedEndLine: number | undefined = undefined
			if (endLineStr) {
				requestedEndLine = parseInt(endLineStr)
				if (isNaN(requestedEndLine)) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("read_file")
					await cline.say("error", `Failed to parse end_line: ${endLineStr}`)
					pushToolResult(`<file><path>${relPath}</path><error>Invalid end_line value</error></file>`)
					return
				}
			}

			// Create line snippet description for approval message
			let lineSnippet = ""

			if (isFullRead) {
				// No snippet for full read
			} else if (requestedStartLine !== undefined && requestedEndLine !== undefined) {
				lineSnippet = t("tools:readFile.linesRange", { start: requestedStartLine, end: requestedEndLine })
			} else if (requestedStartLine !== undefined) {
				lineSnippet = t("tools:readFile.linesFromToEnd", { start: requestedStartLine })
			} else if (requestedEndLine !== undefined) {
				lineSnippet = t("tools:readFile.linesFromStartTo", { end: requestedEndLine })
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

			// Use shared utility functions for file processing
			const result = await processFileForReading(
				absolutePath,
				relPath,
				maxReadFileLine,
				requestedStartLine,
				requestedEndLine,
				cline.rooIgnoreController,
			)

			// Track file read operation
			if (relPath) {
				await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)
			}

			// Format and push the result
			const xmlResult = formatProcessedFileResultToString(result)
			pushToolResult(xmlResult)
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		pushToolResult(`<file><path>${relPath || ""}</path><error>Error reading file: ${errorMsg}</error></file>`)
		await handleError("reading file", error)
	}
}
