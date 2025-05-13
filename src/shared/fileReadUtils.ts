/**
 * Utilities for reading and processing files with various options and controls
 */

import { RooIgnoreController } from "../core/ignore/RooIgnoreController"
import { isBinaryFile } from "isbinaryfile"
import * as fs from "node:fs"
import * as readline from "node:readline"
import { parseSourceCodeDefinitionsForFile } from "../services/tree-sitter"

// Utility functions
async function countFileLines(filePath: string): Promise<number> {
	const fileStream = fs.createReadStream(filePath)
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	})

	let count = 0
	for await (const _ of rl) {
		count++
	}
	return count
}

async function readLines(filePath: string, endLine: number | undefined, startLine = 0): Promise<string[]> {
	const fileStream = fs.createReadStream(filePath)
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	})

	const lines: string[] = []
	let currentLine = 0

	for await (const line of rl) {
		if (currentLine >= startLine && (endLine === undefined || currentLine <= endLine)) {
			lines.push(line)
		}
		currentLine++
		if (endLine !== undefined && currentLine > endLine) break
	}

	return lines
}

function addLineNumbers(lines: string[], startAt = 1): string {
	return lines.map((line, i) => `${startAt + i} | ${line}`).join("\n")
}

async function extractTextFromFile(filePath: string): Promise<string> {
	const content = await fs.promises.readFile(filePath, "utf-8")
	return addLineNumbers(content.split("\n"), 1)
}

/**
 * Represents the result of processing a file read operation
 */
export interface ProcessedFileReadResult {
	/** Relative path to the file from workspace root */
	relativePath: string
	/** File content with line numbers (if applicable) */
	contentWithLineNumbers?: string
	/** Notice or warning message about the read operation */
	notice?: string
	/** Extracted source code definitions (if applicable) */
	sourceCodeDefinitions?: string
	/** Error message if reading failed */
	error?: string
	/** Actual start line that was read (1-based) */
	actualStartLine?: number
	/** Actual end line that was read (1-based) */
	actualEndLine?: number
	/** Total number of lines in the file */
	totalLinesInFile: number
	/** Whether the file is binary */
	isBinary: boolean
	/** Whether the content was truncated */
	wasTruncated: boolean
	/** Whether a range was read (vs full file) */
	wasRangeRead: boolean
}

/**
 * Processes a file for reading with various options and controls
 * @param absolutePath Absolute path to the file
 * @param relativePath Relative path from workspace root
 * @param maxReadFileLine Maximum lines to read
 * @param requestedStartLine Optional start line (1-based)
 * @param requestedEndLine Optional end line (1-based)
 * @param rooIgnoreController Optional ignore controller
 * @returns Processed file read result
 */
export async function processFileForReading(
	absolutePath: string,
	relativePath: string,
	maxReadFileLine: number,
	requestedStartLine: number | undefined,
	requestedEndLine: number | undefined,
	rooIgnoreController: RooIgnoreController | undefined,
): Promise<ProcessedFileReadResult> {
	// 1. Initial checks & setup
	if (rooIgnoreController && !rooIgnoreController.validateAccess(relativePath)) {
		return {
			relativePath,
			error: "Access to file denied by .rooignore",
			totalLinesInFile: 0,
			isBinary: false,
			wasTruncated: false,
			wasRangeRead: false,
		}
	}

	// 2. Validate range parameters
	const baseErrorResult = {
		relativePath,
		totalLinesInFile: 0,
		isBinary: false, // Assuming not binary until checked, or error occurs before
		wasTruncated: false,
		wasRangeRead: false, // If range params are invalid, it's not a valid range read
	}

	if (requestedStartLine !== undefined) {
		if (typeof requestedStartLine !== "number" || isNaN(requestedStartLine) || requestedStartLine < 1) {
			return { ...baseErrorResult, error: "Invalid start_line value" }
		}
	}
	if (requestedEndLine !== undefined) {
		if (typeof requestedEndLine !== "number" || isNaN(requestedEndLine) || requestedEndLine < 1) {
			return { ...baseErrorResult, error: "Invalid end_line value" }
		}
	}
	if (requestedStartLine !== undefined && requestedEndLine !== undefined && requestedStartLine > requestedEndLine) {
		return { ...baseErrorResult, error: "start_line must be less than or equal to end_line" }
	}

	// 3. Count lines and check for binary (moved after range validation)
	let totalLinesInFile = 0
	try {
		totalLinesInFile = await countFileLines(absolutePath)
	} catch (error) {
		return {
			relativePath,
			error: `Failed to count lines: ${error instanceof Error ? error.message : String(error)}`,
			totalLinesInFile: 0,
			isBinary: false,
			wasTruncated: false,
			wasRangeRead: false, // If counting lines fails, it's not a successful range read
		}
	}

	const isBinary = await isBinaryFile(absolutePath).catch(() => false)
	// Determine wasRangeRead *after* validation and *before* it's used for logic
	const wasRangeRead = requestedStartLine !== undefined || requestedEndLine !== undefined
	const startLine0Based = requestedStartLine ? requestedStartLine - 1 : 0
	const endLine0Based = requestedEndLine ? requestedEndLine - 1 : undefined

	// Initialize result object
	const result: ProcessedFileReadResult = {
		relativePath,
		totalLinesInFile,
		isBinary,
		wasTruncated: false,
		wasRangeRead,
	}

	// 2. Handle binary files
	if (isBinary) {
		result.notice = "File is binary. Content display may be limited."
		return result
	}

	// 3. Determine read strategy
	if (wasRangeRead) {
		// Range read logic
		const linesArray = await readLines(absolutePath, endLine0Based, startLine0Based)
		result.contentWithLineNumbers = addLineNumbers(linesArray, requestedStartLine || 1)
		result.actualStartLine = requestedStartLine || 1
		result.actualEndLine = result.actualStartLine + linesArray.length - 1

		if (requestedEndLine && result.actualEndLine < requestedEndLine) {
			result.notice = `File ended at line ${result.actualEndLine} (requested to ${requestedEndLine})`
		}
	} else {
		// Full or partial read logic
		const wasTruncated = maxReadFileLine >= 0 && totalLinesInFile > maxReadFileLine
		result.wasTruncated = wasTruncated

		if (maxReadFileLine === 0) {
			result.notice = "Content omitted (maxReadFileLine: 0). Showing definitions if available."
		} else if (wasTruncated) {
			const linesArray = await readLines(absolutePath, maxReadFileLine - 1, 0)
			result.contentWithLineNumbers = addLineNumbers(linesArray, 1)
			result.actualStartLine = 1
			result.actualEndLine = maxReadFileLine
			result.notice = `Showing only ${maxReadFileLine} of ${totalLinesInFile} total lines. Use start_line and end_line if you need to read more.`
		} else {
			result.contentWithLineNumbers = await extractTextFromFile(absolutePath)
			result.actualStartLine = 1
			result.actualEndLine = totalLinesInFile
		}

		// Get source code definitions if needed
		if ((wasTruncated && maxReadFileLine > 0) || (maxReadFileLine === 0 && !wasRangeRead)) {
			try {
				const definitions = await parseSourceCodeDefinitionsForFile(absolutePath, rooIgnoreController)
				if (definitions) {
					result.sourceCodeDefinitions = definitions
				}
			} catch (error) {
				if (error instanceof Error && !error.message.startsWith("Unsupported language:")) {
					console.error(`Error parsing definitions: ${error.message}`)
				}
			}
		}
	}

	// Handle empty files
	if (totalLinesInFile === 0 && !isBinary) {
		result.notice = "File is empty."
	}

	return result
}

/**
 * Formats a processed file result to a string representation
 * @param result The processed file result
 * @returns Formatted string
 */
export function formatProcessedFileResultToString(result: ProcessedFileReadResult): string {
	// Handle errors first
	if (result.error) {
		return `<file><path>${result.relativePath}</path><error>${result.error}</error></file>`
	}

	// Initialize XML components
	let xmlInfo = ""
	let contentTag = ""
	const pathTag = `<path>${result.relativePath}</path>\n`

	// Build xmlInfo from result properties
	if (result.notice) {
		xmlInfo += `<notice>${result.notice}</notice>\n`
	}
	if (result.sourceCodeDefinitions) {
		xmlInfo += `<list_code_definition_names>${result.sourceCodeDefinitions}</list_code_definition_names>\n`
	}

	// Build contentTag based on file type and read mode
	if (result.isBinary) {
		contentTag = `<content/>\n`
	} else if (result.totalLinesInFile === 0) {
		contentTag = `<content/>\n`
	} else if (result.wasRangeRead) {
		const lineRangeAttr = `lines="${result.actualStartLine}-${result.actualEndLine}"`
		contentTag = `<content ${lineRangeAttr}>\n${result.contentWithLineNumbers || ""}</content>\n`
	} else {
		if (result.contentWithLineNumbers === undefined) {
			contentTag = ""
		} else {
			const lineRangeAttr = `lines="${result.actualStartLine}-${result.actualEndLine}"`
			contentTag = `<content ${lineRangeAttr}>\n${result.contentWithLineNumbers || ""}</content>\n`
		}
	}

	// Assemble final XML string
	return `<file>${pathTag}${contentTag}${xmlInfo}</file>`
}
