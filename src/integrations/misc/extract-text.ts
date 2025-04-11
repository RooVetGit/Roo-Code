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
 * Internal implementation that reads the content of a file with options
 * and returns detailed metadata along with the content.
 */
async function _readFileContentInternal(
	filePath: string,
	options?: {
		maxReadFileLine?: number
		startLine?: number
		endLine?: number
		rooIgnoreController?: any // TODO: Add proper type when available
	},
): Promise<{
	content: string
	totalLines: number
	isFileTruncated: boolean
	sourceCodeDef?: string
}> {
	const { maxReadFileLine, startLine, endLine, rooIgnoreController } = options || {}

	// Check if file exists
	try {
		await fs.access(filePath)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		throw new Error(`File not found: ${filePath} (${errorMessage})`)
	}

	// Initialize return values
	let content = ""
	let totalLines = 0
	let isFileTruncated = false
	let sourceCodeDef: string | undefined = undefined

	// Check if it's a special file type that needs custom extraction
	const fileExtension = path.extname(filePath).toLowerCase()
	const fileTypeInfo = {
		".pdf": { supported: true },
		".docx": { supported: true },
		".docm": { supported: true },
		".ipynb": { supported: true },
	}[fileExtension]

	// Count total lines for truncation check
	try {
		totalLines = await countFileLines(filePath)
	} catch (error) {
		console.error(`Error counting lines in file ${filePath}:`, error)
	}

	// Check if it's a binary file
	const isBinary = await isBinaryFile(filePath).catch((error) => {
		console.error(`Error checking if file is binary: ${filePath}`, error)
		return false
	})

	try {
		if (isBinary && !fileTypeInfo) {
			throw new Error(`Cannot read text for binary file at ${filePath}`)
		}

		// Handle known file types
		if (fileTypeInfo) {
			if (!fileTypeInfo.supported) {
				throw new Error(`File type (${fileExtension}) is not supported for text extraction`)
			}

			switch (fileExtension) {
				case ".pdf":
					content = await extractTextFromPDF(filePath)
					return { content, totalLines, isFileTruncated }
				case ".docx":
				case ".docm": // Also handle macro-enabled Word documents
					content = await extractTextFromDOCX(filePath)
					return { content, totalLines, isFileTruncated }
				case ".ipynb":
					content = await extractTextFromIPYNB(filePath)
					return { content, totalLines, isFileTruncated }
			}
		}

		// Handle range reading
		const isRangeRead = startLine !== undefined || endLine !== undefined
		if (isRangeRead) {
			const effectiveStartLine = startLine ?? 0
			const effectiveEndLine = endLine ?? totalLines - 1

			// readLines expects (filePath, endLine, startLine)
			const lineContent = await readLines(filePath, effectiveEndLine, effectiveStartLine)
			content = addLineNumbers(lineContent, effectiveStartLine + 1)
			return { content, totalLines, isFileTruncated }
		}

		// Handle auto-truncation for large files
		if (maxReadFileLine !== undefined && totalLines > maxReadFileLine) {
			try {
				// If file is too large, only read the first maxReadFileLine lines
				isFileTruncated = true

				const res = await Promise.all([
					maxReadFileLine > 0 ? readLines(filePath, maxReadFileLine - 1, 0) : "",
					parseSourceCodeDefinitionsForFile(filePath, rooIgnoreController),
				])

				content = res[0].length > 0 ? addLineNumbers(res[0]) : ""
				const result = res[1]
				if (result) {
					sourceCodeDef = `${result}`
				}

				return { content, totalLines, isFileTruncated, sourceCodeDef }
			} catch (error) {
				console.error(`Error during auto-truncation: ${filePath}`, error)
				// Fall back to reading the entire file if truncation fails
				content = addLineNumbers(await fs.readFile(filePath, "utf8"))
				return { content, totalLines, isFileTruncated: false }
			}
		}

		// Read entire file
		try {
			const fileContent = await fs.readFile(filePath, "utf8")
			content = addLineNumbers(fileContent)
			return { content, totalLines, isFileTruncated }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			throw new Error(`Error reading file: ${filePath} (${errorMessage})`)
		}
	} catch (error) {
		// For special file types, propagate their specific errors
		if (fileTypeInfo) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			throw new Error(`Failed to extract text from ${fileExtension} file: ${filePath} (${errorMessage})`)
		}
		// Re-throw other errors
		throw error
	}
}

/**
 * Read the content of a file with options for line ranges and truncation.
 * Always returns content with line numbers.
 * @param relPath Optional - when provided, returns an XML formatted output
 */
export async function readFileContent(
	filePath: string,
	options?: {
		maxReadFileLine?: number
		startLine?: number
		endLine?: number
		rooIgnoreController?: any
		relPath?: string
	},
): Promise<string> {
	const { relPath } = options || {}

	try {
		// Get the raw content and metadata
		const { content, isFileTruncated, totalLines, sourceCodeDef } = await _readFileContentInternal(
			filePath,
			options,
		)

		// If we have relPath, return XML formatted output
		if (relPath) {
			return formatReadFileOutput(relPath, content, {
				startLine: options?.startLine,
				endLine: options?.endLine,
				totalLines,
				maxReadFileLine: options?.maxReadFileLine,
				sourceCodeDef,
				isFileTruncated,
			})
		}

		// Otherwise return plain content with line numbers
		return content
	} catch (error) {
		// If relPath is provided, return error in XML format
		if (relPath) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			return `<file><path>${relPath}</path><error>Error reading file: ${errorMsg}</error></file>`
		}
		// Otherwise re-throw
		throw error
	}
}
/**
 * Function that uses the readFileContent function to get file content with line numbers.
 */
export async function extractTextFromFile(
	filePath: string,
	maxReadFileLine?: number,
	relPath?: string,
): Promise<string> {
	return readFileContent(filePath, {
		maxReadFileLine,
		relPath,
	})
}

/**
 * Formats file content into XML structure for read_file tool output
 */
export function formatReadFileOutput(
	relPath: string,
	content: string,
	options?: {
		startLine?: number
		endLine?: number
		totalLines?: number
		maxReadFileLine?: number
		sourceCodeDef?: string
		isFileTruncated?: boolean
	},
): string {
	const { startLine, endLine, totalLines = 0, maxReadFileLine, sourceCodeDef, isFileTruncated } = options || {}

	// Create variables to store XML components
	let xmlInfo = ""
	let contentTag = ""

	// Check if we're doing a line range read
	const isRangeRead = startLine !== undefined || endLine !== undefined

	// Add truncation notice if applicable
	if (isFileTruncated && maxReadFileLine !== undefined) {
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
		// Maintain exact format expected by tests
		contentTag = `<content${lineRangeAttr}>\n${content}</content>\n`
	}
	// maxReadFileLine=0 for non-range reads
	else if (maxReadFileLine === 0) {
		// Skip content tag for maxReadFileLine=0 (definitions only mode)
		contentTag = ""
	}
	// Normal case: non-empty files with content (non-range reads)
	else {
		// For non-range reads, always show line range
		let lines = totalLines
		if (maxReadFileLine !== undefined && maxReadFileLine >= 0 && totalLines > maxReadFileLine) {
			lines = maxReadFileLine
		}
		const lineRangeAttr = ` lines="1-${lines}"`
		// Maintain exact format expected by tests
		contentTag = `<content${lineRangeAttr}>\n${content}</content>\n`
	}

	// Format the result into the required XML structure
	return `<file><path>${relPath}</path>\n${contentTag}${xmlInfo}</file>`
}

/**
 * Process and format file content according to read_file tool requirements.
 * This is a wrapper around readFileContent for clarity and backward compatibility.
 */
export async function processFileForReadTool(
	filePath: string,
	relPath: string,
	options?: {
		maxReadFileLine?: number
		startLine?: number
		endLine?: number
		rooIgnoreController?: any
	},
): Promise<string> {
	return readFileContent(filePath, {
		...options,
		relPath,
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
	// If content is empty, return empty string - empty files should not have line numbers
	// If content is empty but startLine > 1, return "startLine | " because we know the file is not empty
	// but the content is empty at that line offset
	if (content === "") {
		return startLine === 1 ? "" : `${startLine} | \n`
	}

	// Split into lines and handle trailing newlines
	const lines = content.split("\n")
	const lastLineEmpty = lines[lines.length - 1] === ""
	if (lastLineEmpty) {
		lines.pop()
	}

	const maxLineNumberWidth = String(startLine + lines.length - 1).length
	const numberedContent = lines
		.map((line, index) => {
			const lineNumber = String(startLine + index).padStart(maxLineNumberWidth, " ")
			return `${lineNumber} | ${line}`
		})
		.join("\n")

	return numberedContent + "\n"
}
// Checks if every line in the content has line numbers prefixed (e.g., "1 | content" or "123 | content")
// Line numbers must be followed by a single pipe character (not double pipes)
export function everyLineHasLineNumbers(content: string): boolean {
	const lines = content.split(/\r?\n/)
	return lines.length > 0 && lines.every((line) => /^\s*\d+\s+\|(?!\|)/.test(line))
}

/**
 * Strips line numbers from content while preserving the actual content.
 *
 * @param content The content to process
 * @param aggressive When false (default): Only strips lines with clear number patterns like "123 | content"
 *                   When true: Uses a more lenient pattern that also matches lines with just a pipe character,
 *                   which can be useful when LLMs don't perfectly format the line numbers in diffs
 * @returns The content with line numbers removed
 */
export function stripLineNumbers(content: string, aggressive: boolean = false): string {
	// Split into lines to handle each line individually
	const lines = content.split(/\r?\n/)

	// Process each line
	const processedLines = lines.map((line) => {
		// Match line number pattern and capture everything after the pipe
		const match = aggressive ? line.match(/^\s*(?:\d+\s)?\|\s(.*)$/) : line.match(/^\s*\d+\s+\|(?!\|)\s?(.*)$/)
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
