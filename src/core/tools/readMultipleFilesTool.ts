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
import { extractTextFromFile, addLineNumbers } from "../../integrations/misc/extract-text"

interface FileResult {
	path: string
	content?: string
	error?: string
}

export async function readMultipleFilesTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	// TODO: The schema expects a JSON array string for 'paths'. Need robust parsing.
	// For now, assume it's a simple comma-separated string for initial implementation.
	const pathsStr: string | undefined = block.params.paths
	let relPaths: string[] = []

	if (pathsStr) {
		try {
			// Attempt to parse as JSON array first
			const parsedPaths = JSON.parse(pathsStr)
			if (Array.isArray(parsedPaths) && parsedPaths.every((p) => typeof p === "string")) {
				relPaths = parsedPaths.map((p) => removeClosingTag("paths", p)) // Remove closing tag for each path
			} else {
				throw new Error("Parsed paths is not an array of strings")
			}
		} catch (jsonError) {
			// Fallback: Handle simple comma-separated list (less robust)
			console.warn("Failed to parse 'paths' as JSON array, falling back to comma-separated:", jsonError)
			relPaths = pathsStr.split(",").map((p) => removeClosingTag("paths", p.trim()))
		}
	}

	const readablePaths = relPaths.map((p) => getReadablePath(cline.cwd, p))
	const areAnyOutsideWorkspace = relPaths.some((p) => isPathOutsideWorkspace(path.resolve(cline.cwd, p)))

	const sharedMessageProps: Omit<ClineSayTool, "tool"> = {
		// Use Omit as tool type will vary
		path: readablePaths.join(", "), // Show all paths in approval message
		isOutsideWorkspace: areAnyOutsideWorkspace,
	}

	try {
		// Partial updates might not make sense for multiple files, handle as complete for now.
		if (block.partial) {
			await cline
				.ask("tool", JSON.stringify({ ...sharedMessageProps, tool: "readMultipleFiles" }), block.partial)
				.catch(() => {})
			return
		} else {
			if (!pathsStr || relPaths.length === 0) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("read_multiple_files") // Use new tool name
				const errorMsg = await cline.sayAndCreateMissingParamError("read_multiple_files", "paths")
				pushToolResult(`<files><error>${errorMsg}</error></files>`) // Use <files> wrapper
				return
			}

			cline.consecutiveMistakeCount = 0

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				tool: "readMultipleFiles", // Specify tool name
				reason: t("tools:readMultipleFiles.readingFiles", { count: relPaths.length }), // Add a reason
			})

			// Check for auto-approval
			const { alwaysAllowReadOnly, alwaysAllowReadOnlyOutsideWorkspace } =
				(await cline.providerRef.deref()?.getState()) ?? {}
			let shouldAskForApproval = true

			if (alwaysAllowReadOnly) {
				if (areAnyOutsideWorkspace) {
					// Files are outside workspace, check if that's allowed too
					if (alwaysAllowReadOnlyOutsideWorkspace) {
						shouldAskForApproval = false // Auto-approve allowed for outside workspace
					}
				} else {
					// All files are inside workspace, auto-approve applies
					shouldAskForApproval = false
				}
			}

			let didApprove = true // Assume approved if not asking
			if (shouldAskForApproval) {
				didApprove = await askApproval("tool", completeMessage)
			}

			if (!didApprove) {
				// User rejected or auto-approval didn't apply and user rejected
				return
			}

			const results: FileResult[] = []

			for (const relPath of relPaths) {
				const absolutePath = path.resolve(cline.cwd, relPath)
				let fileContent = ""
				let errorMsg: string | undefined = undefined

				try {
					const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
					if (!accessAllowed) {
						errorMsg = formatResponse.rooIgnoreError(relPath)
						await cline.say("rooignore_error", relPath)
					} else {
						const isBinary = await isBinaryFile(absolutePath).catch(() => false)
						if (isBinary) {
							// Handle binary files - maybe return an error or a notice?
							errorMsg = t("tools:readFile.binaryFileError") // Re-use existing translation
						} else {
							// Read entire file for now
							fileContent = await extractTextFromFile(absolutePath)
							// Track file read operation
							await cline
								.getFileContextTracker()
								.trackFileContext(relPath, "read_multiple_files_tool" as RecordSource)
						}
					}
				} catch (error) {
					errorMsg = error instanceof Error ? error.message : String(error)
					await handleError(`reading file ${relPath}`, error) // Log error for specific file
				}

				results.push({
					path: relPath,
					content: errorMsg ? undefined : addLineNumbers(fileContent), // Add line numbers only on success
					error: errorMsg,
				})
			}

			// Format the aggregated result into XML structure
			const xmlResult = `<files>\n${results
				.map((res) => {
					if (res.error) {
						return `  <file><path>${res.path}</path><error>${res.error}</error></file>`
					} else {
						// Add lines attribute similar to readFileTool
						const lineCount = (res.content?.match(/\n/g) || []).length + (res.content ? 1 : 0)
						const lineRangeAttr = lineCount > 0 ? ` lines="1-${lineCount}"` : ""
						return `  <file><path>${res.path}</path>\n    <content${lineRangeAttr}>\n${res.content || ""}</content>\n  </file>`
					}
				})
				.join("\n")}\n</files>`

			pushToolResult(xmlResult)
		}
	} catch (error) {
		// Catch any top-level errors during processing
		const errorMsg = error instanceof Error ? error.message : String(error)
		pushToolResult(`<files><error>Error processing multiple files: ${errorMsg}</error></files>`)
		await handleError("processing multiple files", error)
	}
}
