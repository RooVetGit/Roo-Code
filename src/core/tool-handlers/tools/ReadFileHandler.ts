import * as path from "path"
import { ToolUse, ReadFileToolUse } from "../../assistant-message"
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { ClineSayTool } from "../../../shared/ExtensionMessage"
import { getReadablePath } from "../../../utils/path" // Keep this one
import { isPathOutsideWorkspace } from "../../../utils/pathUtils" // Import from pathUtils
import { extractTextFromFile, addLineNumbers } from "../../../integrations/misc/extract-text"
import { countFileLines } from "../../../integrations/misc/line-counter"
import { readLines } from "../../../integrations/misc/read-lines"
import { parseSourceCodeDefinitionsForFile } from "../../../services/tree-sitter"
import { isBinaryFile } from "isbinaryfile"
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class ReadFileHandler extends ToolUseHandler {
	protected override toolUse: ReadFileToolUse

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
		this.toolUse = toolUse as ReadFileToolUse
	}

	async handle(): Promise<boolean> {
		// read_file doesn't have a meaningful partial state other than showing the tool use message
		if (this.toolUse.partial) {
			await this.handlePartial()
			return false // Indicate partial handling
		} else {
			await this.handleComplete()
			return true // Indicate complete handling
		}
	}

	validateParams(): void {
		if (!this.toolUse.params.path) {
			throw new Error("Missing required parameter 'path'")
		}
		// Optional params (start_line, end_line) are validated during parsing in handleComplete
	}

	protected async handlePartial(): Promise<void> {
		const relPath = this.toolUse.params.path
		if (!relPath) return // Need path to show message

		const fullPath = path.resolve(this.cline.cwd, this.removeClosingTag("path", relPath))
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

		const sharedMessageProps: ClineSayTool = {
			tool: "readFile",
			path: getReadablePath(this.cline.cwd, this.removeClosingTag("path", relPath)),
			isOutsideWorkspace,
		}

		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			content: undefined, // No content to show in partial
		} satisfies ClineSayTool)

		try {
			await this.cline.ask("tool", partialMessage, true)
		} catch (error) {
			console.warn("ReadFileHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const relPath = this.toolUse.params.path
		const startLineStr = this.toolUse.params.start_line
		const endLineStr = this.toolUse.params.end_line

		// --- Parameter Validation ---
		if (!relPath) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("read_file", "path"),
			)
			return
		}

		let startLine: number | undefined = undefined
		let endLine: number | undefined = undefined
		let isRangeRead = false

		if (startLineStr || endLineStr) {
			isRangeRead = true
			if (startLineStr) {
				startLine = parseInt(startLineStr)
				if (isNaN(startLine) || startLine < 1) {
					// Line numbers are 1-based
					this.cline.consecutiveMistakeCount++
					await this.cline.say(
						"error",
						`Invalid start_line value: ${startLineStr}. Must be a positive integer.`,
					)
					await this.cline.pushToolResult(
						this.toolUse,
						formatResponse.toolError("Invalid start_line value. Must be a positive integer."),
					)
					return
				}
				startLine -= 1 // Convert to 0-based index for internal use
			}
			if (endLineStr) {
				endLine = parseInt(endLineStr)
				if (isNaN(endLine) || endLine < 1) {
					// Line numbers are 1-based
					this.cline.consecutiveMistakeCount++
					await this.cline.say("error", `Invalid end_line value: ${endLineStr}. Must be a positive integer.`)
					await this.cline.pushToolResult(
						this.toolUse,
						formatResponse.toolError("Invalid end_line value. Must be a positive integer."),
					)
					return
				}
				// No need to convert endLine to 0-based for readLines, it expects 1-based end line
				// endLine -= 1;
			}
			// Validate range logic (e.g., start <= end)
			if (startLine !== undefined && endLine !== undefined && startLine >= endLine) {
				this.cline.consecutiveMistakeCount++
				await this.cline.say(
					"error",
					`Invalid line range: start_line (${startLineStr}) must be less than end_line (${endLineStr}).`,
				)
				await this.cline.pushToolResult(
					this.toolUse,
					formatResponse.toolError("Invalid line range: start_line must be less than end_line."),
				)
				return
			}
		}

		// --- Access Validation ---
		const accessAllowed = this.cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			await this.cline.say("rooignore_error", relPath)
			await this.cline.pushToolResult(
				this.toolUse,
				formatResponse.toolError(formatResponse.rooIgnoreError(relPath)),
			)
			return
		}

		// --- Ask for Approval ---
		const absolutePath = path.resolve(this.cline.cwd, relPath)
		const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)
		const sharedMessageProps: ClineSayTool = {
			tool: "readFile",
			path: getReadablePath(this.cline.cwd, relPath),
			isOutsideWorkspace,
		}
		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			content: absolutePath, // Show the path being read
		} satisfies ClineSayTool)

		const didApprove = await this.cline.askApprovalHelper(this.toolUse, "tool", completeMessage)
		if (!didApprove) {
			// pushToolResult is handled by askApprovalHelper
			return
		}

		// --- Execute Read ---
		try {
			const { maxReadFileLine = 500 } = (await this.cline.providerRef.deref()?.getState()) ?? {}
			let totalLines = 0
			try {
				totalLines = await countFileLines(absolutePath)
			} catch (error) {
				// Handle file not found specifically
				if (error.code === "ENOENT") {
					this.cline.consecutiveMistakeCount++
					const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
					await this.cline.say("error", formattedError)
					await this.cline.pushToolResult(this.toolUse, formatResponse.toolError(formattedError))
					return
				}
				console.error(`Error counting lines in file ${absolutePath}:`, error)
				// Proceed anyway, totalLines will be 0
			}

			let content: string
			let isFileTruncated = false
			let sourceCodeDef = ""
			const isBinary = await isBinaryFile(absolutePath).catch(() => false)

			if (isRangeRead) {
				// readLines expects 0-based start index and 1-based end line number
				content = addLineNumbers(
					await readLines(absolutePath, endLine, startLine), // endLine is already 1-based (or undefined), startLine is 0-based
					startLine !== undefined ? startLine + 1 : 1, // Start numbering from 1-based startLine
				)
			} else if (!isBinary && maxReadFileLine >= 0 && totalLines > maxReadFileLine) {
				isFileTruncated = true
				const [fileChunk, defResult] = await Promise.all([
					maxReadFileLine > 0 ? readLines(absolutePath, maxReadFileLine - 1, 0) : "", // Use maxReadFileLine - 1 for 0-based end index
					parseSourceCodeDefinitionsForFile(absolutePath, this.cline.rooIgnoreController),
				])
				content = fileChunk.length > 0 ? addLineNumbers(fileChunk) : ""
				if (defResult) {
					sourceCodeDef = `\n\n${defResult}`
				}
			} else {
				content = await extractTextFromFile(absolutePath)
				// Add line numbers only if it's not binary and not already range-read (which adds numbers)
				// Removed redundant addLineNumbers call, as extractTextFromFile handles it for text files.
				// Binary files won't have line numbers added by extractTextFromFile.
			}

			if (isFileTruncated) {
				content += `\n\n[Showing only ${maxReadFileLine} of ${totalLines} total lines. Use start_line and end_line if you need to read more]${sourceCodeDef}`
			}

			await this.cline.pushToolResult(this.toolUse, content)
			this.cline.consecutiveMistakeCount = 0 // Reset mistake count on success
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name) // Capture telemetry
		} catch (error: any) {
			// Handle file not found during read attempt as well
			if (error.code === "ENOENT") {
				this.cline.consecutiveMistakeCount++
				const formattedError = `File does not exist at path: ${absolutePath}\n\n<error_details>\nThe specified file could not be found. Please verify the file path and try again.\n</error_details>`
				await this.cline.say("error", formattedError)
				await this.cline.pushToolResult(this.toolUse, formatResponse.toolError(formattedError))
				return
			}
			// Handle other errors
			await this.cline.handleErrorHelper(this.toolUse, "reading file", error)
		}
	}
}
