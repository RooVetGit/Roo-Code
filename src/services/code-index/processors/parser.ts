import { readFile } from "fs/promises"
import { createHash } from "crypto"
import * as path from "path"
import * as treeSitter from "web-tree-sitter"
import { LanguageParser, loadRequiredLanguageParsers } from "../../tree-sitter/languageParser"
import { ICodeParser, CodeBlock } from "../interfaces"
import { scannerExtensions } from "../shared/supported-extensions"

const MAX_BLOCK_CHARS = 1000
const MIN_BLOCK_CHARS = 100
const MIN_CHUNK_REMAINDER_CHARS = 200 // Minimum characters for the *next* chunk after a split
const MAX_CHARS_TOLERANCE_FACTOR = 1.15 // 15% tolerance for max chars

/**
 * Implementation of the code parser interface
 */
export class CodeParser implements ICodeParser {
	private loadedParsers: LanguageParser = {}
	private pendingLoads: Map<string, Promise<LanguageParser>> = new Map()
	// Markdown files are excluded because the current parser logic cannot effectively handle
	// potentially large Markdown sections without a tree-sitter-like child node structure for chunking

	/**
	 * Parses a code file into code blocks
	 * @param filePath Path to the file to parse
	 * @param options Optional parsing options
	 * @returns Promise resolving to array of code blocks
	 */
	async parseFile(
		filePath: string,
		options?: {
			content?: string
			fileHash?: string
		},
	): Promise<CodeBlock[]> {
		// Get file extension
		const ext = path.extname(filePath).toLowerCase()

		// Skip if not a supported language
		if (!this.isSupportedLanguage(ext)) {
			return []
		}

		// Get file content
		let content: string
		let fileHash: string

		if (options?.content) {
			content = options.content
			fileHash = options.fileHash || this.createFileHash(content)
		} else {
			try {
				content = await readFile(filePath, "utf8")
				fileHash = this.createFileHash(content)
			} catch (error) {
				console.error(`Error reading file ${filePath}:`, error)
				return []
			}
		}

		// Parse the file
		return this.parseContent(filePath, content, fileHash)
	}

	/**
	 * Checks if a language is supported
	 * @param extension File extension
	 * @returns Boolean indicating if the language is supported
	 */
	private isSupportedLanguage(extension: string): boolean {
		return scannerExtensions.includes(extension)
	}

	/**
	 * Creates a hash for a file
	 * @param content File content
	 * @returns Hash string
	 */
	private createFileHash(content: string): string {
		return createHash("sha256").update(content).digest("hex")
	}

	/**
	 * Parses file content into code blocks
	 * @param filePath Path to the file
	 * @param content File content
	 * @param fileHash File hash
	 * @returns Array of code blocks
	 */
	private async parseContent(filePath: string, content: string, fileHash: string): Promise<CodeBlock[]> {
		const ext = path.extname(filePath).slice(1).toLowerCase()

		// Check if we already have the parser loaded
		if (!this.loadedParsers[ext]) {
			const pendingLoad = this.pendingLoads.get(ext)
			if (pendingLoad) {
				try {
					await pendingLoad
				} catch (error) {
					console.error(`Error in pending parser load for ${filePath}:`, error)
					return []
				}
			} else {
				const loadPromise = loadRequiredLanguageParsers([filePath])
				this.pendingLoads.set(ext, loadPromise)
				try {
					const newParsers = await loadPromise
					if (newParsers) {
						this.loadedParsers = { ...this.loadedParsers, ...newParsers }
					}
				} catch (error) {
					console.error(`Error loading language parser for ${filePath}:`, error)
					return []
				} finally {
					this.pendingLoads.delete(ext)
				}
			}
		}

		const language = this.loadedParsers[ext]
		if (!language) {
			console.warn(`No parser available for file extension: ${ext}`)
			return []
		}

		const tree = language.parser.parse(content)

		// We don't need to get the query string from languageQueries since it's already loaded
		// in the language object
		const captures = language.query.captures(tree.rootNode)
		// Check if captures are empty
		if (captures.length === 0) {
			if (content.length >= MIN_BLOCK_CHARS) {
				// Perform fallback chunking if content is large enough
				return this._performFallbackChunking(filePath, content, fileHash, MIN_BLOCK_CHARS, MAX_BLOCK_CHARS)
			} else {
				// Return empty if content is too small for fallback
				return []
			}
		}

		const results: CodeBlock[] = []

		// Process captures if not empty
		const queue: treeSitter.SyntaxNode[] = captures.map((capture: any) => capture.node)

		while (queue.length > 0) {
			const currentNode = queue.shift()!
			// const lineSpan = currentNode.endPosition.row - currentNode.startPosition.row + 1 // Removed as per lint error

			// Check if the node meets the minimum character requirement
			if (currentNode.text.length >= MIN_BLOCK_CHARS) {
				// If it also exceeds the maximum character limit, try to break it down
				if (currentNode.text.length > MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR) {
					if (currentNode.children.length > 0) {
						// If it has children, process them instead
						queue.push(...currentNode.children)
					} else {
						// If it's a leaf node, chunk it (passing MIN_BLOCK_CHARS as per Task 1 Step 5)
						// Note: _chunkLeafNodeByLines logic might need further adjustment later
						const chunkedBlocks = this._chunkLeafNodeByLines(
							currentNode,
							filePath,
							fileHash,
							MIN_BLOCK_CHARS, // Pass minChars as requested
						)
						results.push(...chunkedBlocks)
					}
				} else {
					// Node meets min chars and is within max chars, create a block
					const identifier =
						currentNode.childForFieldName("name")?.text ||
						currentNode.children.find((c) => c.type === "identifier")?.text ||
						null
					const type = currentNode.type
					const start_line = currentNode.startPosition.row + 1
					const end_line = currentNode.endPosition.row + 1
					const content = currentNode.text
					const segmentHash = createHash("sha256")
						.update(`${filePath}-${start_line}-${end_line}-${content}`)
						.digest("hex")

					results.push({
						file_path: filePath,
						identifier,
						type,
						start_line,
						end_line,
						content,
						segmentHash,
						fileHash,
					})
				}
			}
			// Nodes smaller than MIN_BLOCK_CHARS are ignored
		}

		return results
	}

	/**
	 * Common helper function to chunk text by lines, avoiding tiny remainders.
	 */
	private _chunkTextByLines(
		lines: string[],
		filePath: string,
		fileHash: string,
		baseStartLine: number, // 1-based start line of the *first* line in the `lines` array
		chunkType: string,
		minChars: number,
		maxChars: number,
		minRemainderChars: number,
	): CodeBlock[] {
		const chunks: CodeBlock[] = []
		let currentChunkLines: string[] = []
		let currentChunkLength = 0
		let chunkStartLineIndex = 0 // 0-based index within the `lines` array

		const finalizeChunk = (endLineIndex: number) => {
			if (currentChunkLength >= minChars && currentChunkLines.length > 0) {
				const chunkContent = currentChunkLines.join("\n")
				const startLine = baseStartLine + chunkStartLineIndex
				const endLine = baseStartLine + endLineIndex
				const segmentHash = createHash("sha256")
					.update(`${filePath}-${startLine}-${endLine}-${chunkContent}`)
					.digest("hex")

				chunks.push({
					file_path: filePath,
					identifier: null, // Identifier is handled at a higher level if available
					type: chunkType,
					start_line: startLine,
					end_line: endLine,
					content: chunkContent,
					segmentHash,
					fileHash,
				})
			}
			// Reset for the next chunk
			currentChunkLines = []
			currentChunkLength = 0
			chunkStartLineIndex = endLineIndex + 1
		}

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const lineLength = line.length + (i < lines.length - 1 ? 1 : 0) // +1 for newline, except last line

			// Check if adding this line exceeds the max limit
			if (currentChunkLength > 0 && currentChunkLength + lineLength > maxChars) {
				// --- Re-balancing Logic ---
				let splitIndex = i - 1 // Default split is *before* the current line

				// Estimate remaining text length
				let remainderLength = 0
				for (let j = i; j < lines.length; j++) {
					remainderLength += lines[j].length + (j < lines.length - 1 ? 1 : 0)
				}

				// Check if remainder is too small and we have a valid current chunk
				if (
					currentChunkLength >= minChars &&
					remainderLength < minRemainderChars &&
					currentChunkLines.length > 1
				) {
					// Try to find a better split point by looking backwards
					for (let k = i - 2; k >= chunkStartLineIndex; k--) {
						const potentialChunkLines = lines.slice(chunkStartLineIndex, k + 1)
						const potentialChunkLength = potentialChunkLines.join("\n").length + 1 // Approx. length

						const potentialNextChunkLines = lines.slice(k + 1) // All remaining lines
						const potentialNextChunkLength = potentialNextChunkLines.join("\n").length + 1 // Approx. length

						// Found a split leaving enough in current and next?
						if (potentialChunkLength >= minChars && potentialNextChunkLength >= minRemainderChars) {
							splitIndex = k // Found a better split point
							break
						}
					}
					// If no better split found, splitIndex remains i - 1
				}
				// --- End Re-balancing ---

				// Finalize the chunk up to the determined split index
				finalizeChunk(splitIndex)

				// Add the current line to start the *new* chunk (if it wasn't part of the finalized chunk)
				if (i >= chunkStartLineIndex) {
					currentChunkLines.push(line)
					currentChunkLength += lineLength
				} else {
					// This case should ideally not happen with the current logic, but as a safeguard:
					// If the split somehow went *past* the current line index 'i',
					// we need to reset 'i' to start processing from the beginning of the new chunk.
					i = chunkStartLineIndex - 1 // Loop increment will make it chunkStartLineIndex
					continue // Re-process the line that starts the new chunk
				}
			} else {
				// Add the current line to the chunk
				currentChunkLines.push(line)
				currentChunkLength += lineLength
			}
		}

		// Process the last remaining chunk
		if (currentChunkLines.length > 0) {
			finalizeChunk(lines.length - 1)
		}

		return chunks
	}

	private _performFallbackChunking(
		filePath: string,
		content: string,
		fileHash: string,
		minChars: number,
		maxChars: number,
	): CodeBlock[] {
		const lines = content.split("\n")
		return this._chunkTextByLines(
			lines,
			filePath,
			fileHash,
			1, // Fallback starts from line 1
			"fallback_chunk",
			minChars,
			maxChars,
			MIN_CHUNK_REMAINDER_CHARS,
		)
	}

	private _chunkLeafNodeByLines(
		node: treeSitter.SyntaxNode,
		filePath: string,
		fileHash: string,
		minChars: number, // Note: This was previously used as max, now correctly used as min
	): CodeBlock[] {
		const lines = node.text.split("\n")
		const baseStartLine = node.startPosition.row + 1
		return this._chunkTextByLines(
			lines,
			filePath,
			fileHash,
			baseStartLine,
			node.type, // Use the node's type
			minChars,
			MAX_BLOCK_CHARS, // Use the global max
			MIN_CHUNK_REMAINDER_CHARS,
		)
	}
}

// Export a singleton instance for convenience
export const codeParser = new CodeParser()
