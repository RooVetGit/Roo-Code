import * as path from "path"
// @ts-ignore-next-line
import pdf from "pdf-parse/lib/pdf-parse"
import mammoth from "mammoth"
import fs from "fs/promises"
import { isBinaryFile } from "isbinaryfile"
import { countFileLines } from "./line-counter"
import { readLines } from "./read-lines"
import { parseSourceCodeDefinitionsForFile } from "../../services/tree-sitter"
/**
 * Map of file extensions to their MIME types and descriptions.
 * Used for better error messages and future extensibility.
 */
const FILE_TYPE_MAP: Record<string, { mimeType: string; description: string; supported: boolean }> = {
	".pdf": { mimeType: "application/pdf", description: "PDF Document", supported: true },
	".docx": {
		mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		description: "Word Document",
		supported: true,
	},
	".docm": {
		mimeType: "application/vnd.ms-word.document.macroEnabled.12",
		description: "Word Document (with Macros)",
		supported: true,
	},
	".ipynb": { mimeType: "application/json", description: "Jupyter Notebook", supported: true },
	".xlsx": {
		mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		description: "Excel Spreadsheet",
		supported: false,
	},
	".xlsm": {
		mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
		description: "Excel Spreadsheet (with Macros)",
		supported: false,
	},
	".xls": { mimeType: "application/vnd.ms-excel", description: "Excel Spreadsheet (Legacy)", supported: false },
	".pptx": {
		mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
		description: "PowerPoint Presentation",
		supported: false,
	},
	".md": { mimeType: "text/markdown", description: "Markdown Document", supported: true },
	".csv": { mimeType: "text/csv", description: "CSV File", supported: true },
}

/**
 * Gets file type information based on file extension.
 *
 * @param filePath Path to the file
 * @returns File type information or undefined if not in the map
 */
function getFileTypeInfo(filePath: string): { mimeType: string; description: string; supported: boolean } | undefined {
	const fileExtension = path.extname(filePath).toLowerCase()
	return FILE_TYPE_MAP[fileExtension]
}

/**
 * Reads file content with support for range reading and auto-truncation.
 * This is a unified function that handles all file reading operations.
 *
 * Features:
 * - Supports reading specific line ranges
 * - Auto-truncates large files with source code definitions
 * - Extracts text from PDF, DOCX, and Jupyter Notebook files
 * - Detects binary files and provides helpful error messages
 * - Adds line numbers to output for easier reference
 *
 * @param filePath Path to the file to read
 * @param options Optional parameters for reading
 * @param options.maxReadFileLine Maximum number of lines to read when auto-truncating
 * @param options.startLine Start line for range reading (0-based)
 * @param options.endLine End line for range reading (0-based, inclusive)
 * @param options.autoTruncate Whether to auto-truncate large files
 * @param options.rooIgnoreController Optional RooIgnoreController for source code definitions
 * @returns The file content with line numbers
 * @throws Error if file not found, is binary, or extraction fails
 */
export async function readFileContent(
	filePath: string,
	options?: {
		maxReadFileLine?: number
		startLine?: number
		endLine?: number
		rooIgnoreController?: any // TODO: Add proper type when available
	},
): Promise<string> {
	const { maxReadFileLine, startLine, endLine, rooIgnoreController } = options || {}

	// Check if file exists
	try {
		await fs.access(filePath)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		throw new Error(`File not found: ${filePath} (${errorMessage})`)
	}

	// Check if it's a special file type that needs custom extraction
	const fileExtension = path.extname(filePath).toLowerCase()
	const fileTypeInfo = getFileTypeInfo(filePath)

	try {
		// Handle known file types
		if (fileTypeInfo) {
			if (!fileTypeInfo.supported) {
				throw new Error(
					`File type ${fileTypeInfo.description} (${fileExtension}) is not supported for text extraction`,
				)
			}

			switch (fileExtension) {
				case ".pdf":
					return await extractTextFromPDF(filePath)
				case ".docx":
				case ".docm": // Also handle macro-enabled Word documents
					return await extractTextFromDOCX(filePath)
				case ".ipynb":
					return await extractTextFromIPYNB(filePath)
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		throw new Error(`Failed to extract text from ${fileExtension} file: ${filePath} (${errorMessage})`)
	}

	// Check if it's a binary file
	const isBinary = await isBinaryFile(filePath).catch((error) => {
		console.error(`Error checking if file is binary: ${filePath}`, error)
		return false
	})

	if (isBinary) {
		const typeDesc = fileTypeInfo ? fileTypeInfo.description : fileExtension
		throw new Error(`Cannot read text for binary file: ${typeDesc} at ${filePath}`)
	}

	// Count total lines for truncation check
	let totalLines = 0
	try {
		totalLines = await countFileLines(filePath)
	} catch (error) {
		console.error(`Error counting lines in file ${filePath}:`, error)
	}

	// Handle range reading
	const isRangeRead = startLine !== undefined || endLine !== undefined
	if (isRangeRead) {
		const effectiveStartLine = startLine ?? 0
		const effectiveEndLine = endLine ?? totalLines - 1

		// readLines expects (filePath, endLine, startLine)
		const content = await readLines(filePath, effectiveEndLine, effectiveStartLine)
		return addLineNumbers(content, effectiveStartLine + 1)
	}

	// Handle auto-truncation for large files
	if (maxReadFileLine !== undefined && totalLines > maxReadFileLine) {
		try {
			// Read the first portion of the file
			const fileContent = maxReadFileLine > 0 ? await readLines(filePath, maxReadFileLine - 1, 0) : ""

			// Get source code definitions if available
			const sourceCodeDefs = await parseSourceCodeDefinitionsForFile(filePath, rooIgnoreController).catch(
				(error) => {
					console.error(`Error parsing source code definitions: ${filePath}`, error)
					return null
				},
			)

			// Format the truncated content
			const truncationMessage = `\n\n[Showing only ${maxReadFileLine} of ${totalLines} total lines. Use start_line and end_line if you need to read more]`
			const formattedContent = fileContent.length > 0 ? addLineNumbers(fileContent) : ""

			// Add source code definitions if available
			return formattedContent + truncationMessage + (sourceCodeDefs ? `\n\n${sourceCodeDefs}` : "")
		} catch (error) {
			console.error(`Error during auto-truncation: ${filePath}`, error)
			// Fall back to reading the entire file if truncation fails
			return addLineNumbers(await fs.readFile(filePath, "utf8"))
		}
	}

	// Read entire file
	try {
		const content = await fs.readFile(filePath, "utf8")
		return addLineNumbers(content)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		throw new Error(`Error reading file: ${filePath} (${errorMessage})`)
	}
}

/**
 * Legacy function that uses the new unified readFileContent function.
 * Maintained for backward compatibility.
 */
export async function extractTextFromFile(filePath: string, maxReadFileLine?: number): Promise<string> {
	return readFileContent(filePath, {
		maxReadFileLine,
	})
}

async function extractTextFromPDF(filePath: string): Promise<string> {
	const dataBuffer = await fs.readFile(filePath)
	const data = await pdf(dataBuffer)
	return addLineNumbers(data.text)
}

async function extractTextFromDOCX(filePath: string): Promise<string> {
	const result = await mammoth.extractRawText({ path: filePath })
	return addLineNumbers(result.value)
}

async function extractTextFromIPYNB(filePath: string): Promise<string> {
	const data = await fs.readFile(filePath, "utf8")
	const notebook = JSON.parse(data)
	let extractedText = ""

	for (const cell of notebook.cells) {
		if ((cell.cell_type === "markdown" || cell.cell_type === "code") && cell.source) {
			extractedText += cell.source.join("\n") + "\n"
		}
	}

	return addLineNumbers(extractedText)
}

export function addLineNumbers(content: string, startLine: number = 1): string {
	const lines = content.split("\n")
	const maxLineNumberWidth = String(startLine + lines.length - 1).length
	return lines
		.map((line, index) => {
			const lineNumber = String(startLine + index).padStart(maxLineNumberWidth, " ")
			return `${lineNumber} | ${line}`
		})
		.join("\n")
}
// Checks if every line in the content has line numbers prefixed (e.g., "1 | content" or "123 | content")
// Line numbers must be followed by a single pipe character (not double pipes)
export function everyLineHasLineNumbers(content: string): boolean {
	const lines = content.split(/\r?\n/)
	return lines.length > 0 && lines.every((line) => /^\s*\d+\s+\|(?!\|)/.test(line))
}

// Strips line numbers from content while preserving the actual content
// Handles formats like "1 | content", " 12 | content", "123 | content"
// Preserves content that naturally starts with pipe characters
export function stripLineNumbers(content: string): string {
	// Split into lines to handle each line individually
	const lines = content.split(/\r?\n/)

	// Process each line
	const processedLines = lines.map((line) => {
		// Match line number pattern and capture everything after the pipe
		const match = line.match(/^\s*\d+\s+\|(?!\|)\s?(.*)$/)
		return match ? match[1] : line
	})

	// Join back with original line endings
	const lineEnding = content.includes("\r\n") ? "\r\n" : "\n"
	return processedLines.join(lineEnding)
}

/**
 * Truncates multi-line output while preserving context from both the beginning and end.
 * When truncation is needed, it keeps 20% of the lines from the start and 80% from the end,
 * with a clear indicator of how many lines were omitted in between.
 *
 * @param content The multi-line string to truncate
 * @param lineLimit Optional maximum number of lines to keep. If not provided or 0, returns the original content
 * @returns The truncated string with an indicator of omitted lines, or the original content if no truncation needed
 *
 * @example
 * // With 10 line limit on 25 lines of content:
 * // - Keeps first 2 lines (20% of 10)
 * // - Keeps last 8 lines (80% of 10)
 * // - Adds "[...15 lines omitted...]" in between
 */
export function truncateOutput(content: string, lineLimit?: number): string {
	if (!lineLimit) {
		return content
	}

	// Count total lines
	let totalLines = 0
	let pos = -1
	while ((pos = content.indexOf("\n", pos + 1)) !== -1) {
		totalLines++
	}
	totalLines++ // Account for last line without newline

	if (totalLines <= lineLimit) {
		return content
	}

	const beforeLimit = Math.floor(lineLimit * 0.2) // 20% of lines before
	const afterLimit = lineLimit - beforeLimit // remaining 80% after

	// Find start section end position
	let startEndPos = -1
	let lineCount = 0
	pos = 0
	while (lineCount < beforeLimit && (pos = content.indexOf("\n", pos)) !== -1) {
		startEndPos = pos
		lineCount++
		pos++
	}

	// Find end section start position
	let endStartPos = content.length
	lineCount = 0
	pos = content.length
	while (lineCount < afterLimit && (pos = content.lastIndexOf("\n", pos - 1)) !== -1) {
		endStartPos = pos + 1 // Start after the newline
		lineCount++
	}

	const omittedLines = totalLines - lineLimit
	const startSection = content.slice(0, startEndPos + 1)
	const endSection = content.slice(endStartPos)
	return startSection + `\n[...${omittedLines} lines omitted...]\n\n` + endSection
}

/**
 * Applies run-length encoding to compress repeated lines in text.
 * Only compresses when the compression description is shorter than the repeated content.
 *
 * @param content The text content to compress
 * @returns The compressed text with run-length encoding applied
 */
export function applyRunLengthEncoding(content: string): string {
	if (!content) {
		return content
	}

	let result = ""
	let pos = 0
	let repeatCount = 0
	let prevLine = null
	let firstOccurrence = true

	while (pos < content.length) {
		const nextNewlineIdx = content.indexOf("\n", pos)
		const currentLine = nextNewlineIdx === -1 ? content.slice(pos) : content.slice(pos, nextNewlineIdx + 1)

		if (prevLine === null) {
			prevLine = currentLine
		} else if (currentLine === prevLine) {
			repeatCount++
		} else {
			if (repeatCount > 0) {
				const compressionDesc = `<previous line repeated ${repeatCount} additional times>\n`
				if (compressionDesc.length < prevLine.length * (repeatCount + 1)) {
					result += prevLine + compressionDesc
				} else {
					for (let i = 0; i <= repeatCount; i++) {
						result += prevLine
					}
				}
				repeatCount = 0
			} else {
				result += prevLine
			}
			prevLine = currentLine
		}

		pos = nextNewlineIdx === -1 ? content.length : nextNewlineIdx + 1
	}

	if (repeatCount > 0 && prevLine !== null) {
		const compressionDesc = `<previous line repeated ${repeatCount} additional times>\n`
		if (compressionDesc.length < prevLine.length * repeatCount) {
			result += prevLine + compressionDesc
		} else {
			for (let i = 0; i <= repeatCount; i++) {
				result += prevLine
			}
		}
	} else if (prevLine !== null) {
		result += prevLine
	}

	return result
}
