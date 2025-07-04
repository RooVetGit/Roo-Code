import { readFile } from "fs/promises"
import { createHash } from "crypto"
import * as path from "path"
import { Node } from "web-tree-sitter"
import { LanguageParser, loadRequiredLanguageParsers } from "../../tree-sitter/languageParser"
import { ICodeParser, CodeBlock } from "../interfaces"
import { scannerExtensions } from "../shared/supported-extensions"
import { MAX_BLOCK_CHARS, MIN_BLOCK_CHARS, MIN_CHUNK_REMAINDER_CHARS, MAX_CHARS_TOLERANCE_FACTOR } from "../constants"

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
		const seenSegmentHashes = new Set<string>()

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
		const captures = tree ? language.query.captures(tree.rootNode) : []

		const results: CodeBlock[] = []

		// Process captures to find function/class definitions
		if (captures.length > 0) {
			// Group captures by their definition nodes to avoid duplicates
			const processedNodes = new Set<Node>()

			for (const capture of captures) {
				const { node, name } = capture

				// Find the definition node - this is the node that contains the full function/class
				let definitionNode: Node | null = null

				if (name.includes("definition.")) {
					// This capture represents a definition (function, class, method, etc.)
					definitionNode = node
				} else if (name.includes("name.definition.")) {
					// This capture represents the name of a definition, get the parent definition
					definitionNode = node.parent
				}

				// Skip if we couldn't find a definition node or already processed it
				if (!definitionNode || processedNodes.has(definitionNode)) {
					continue
				}

				// Check if the definition meets the minimum character requirement
				if (definitionNode.text.length >= MIN_BLOCK_CHARS) {
					// If it exceeds the maximum character limit, chunk it by lines
					if (definitionNode.text.length > MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR) {
						const chunkedBlocks = this._chunkLeafNodeByLines(
							definitionNode,
							filePath,
							fileHash,
							seenSegmentHashes,
						)
						results.push(...chunkedBlocks)
					} else {
						// Create a block for the entire definition
						const identifier =
							definitionNode.childForFieldName("name")?.text ||
							definitionNode.children.find((c) => c?.type === "identifier")?.text ||
							definitionNode.children.find((c) => c?.type === "property_identifier")?.text ||
							definitionNode.children.find((c) => c?.type === "type_identifier")?.text ||
							null

						const type = definitionNode.type
						const start_line = definitionNode.startPosition.row + 1
						const end_line = definitionNode.endPosition.row + 1
						const content = definitionNode.text
						const segmentHash = createHash("sha256")
							.update(`${filePath}-${start_line}-${end_line}-${content}`)
							.digest("hex")

						if (!seenSegmentHashes.has(segmentHash)) {
							seenSegmentHashes.add(segmentHash)
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

					processedNodes.add(definitionNode)
				}
			}
		}

		// If no valid definitions were found, fall back to chunking
		if (results.length === 0 && content.length >= MIN_BLOCK_CHARS) {
			const blocks = this._performFallbackChunking(filePath, content, fileHash, seenSegmentHashes)
			return blocks
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

		chunkType: string,
		seenSegmentHashes: Set<string>,
		baseStartLine: number = 1, // 1-based start line of the *first* line in the `lines` array
	): CodeBlock[] {
		const chunks: CodeBlock[] = []
		let currentChunkLines: string[] = []
		let currentChunkLength = 0
		let chunkStartLineIndex = 0 // 0-based index within the `lines` array
		const effectiveMaxChars = MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR

		const finalizeChunk = (endLineIndex: number) => {
			if (currentChunkLength >= MIN_BLOCK_CHARS && currentChunkLines.length > 0) {
				const chunkContent = currentChunkLines.join("\n")
				const startLine = baseStartLine + chunkStartLineIndex
				const endLine = baseStartLine + endLineIndex
				const segmentHash = createHash("sha256")
					.update(`${filePath}-${startLine}-${endLine}-${chunkContent}`)
					.digest("hex")

				if (!seenSegmentHashes.has(segmentHash)) {
					seenSegmentHashes.add(segmentHash)
					chunks.push({
						file_path: filePath,
						identifier: null,
						type: chunkType,
						start_line: startLine,
						end_line: endLine,
						content: chunkContent,
						segmentHash,
						fileHash,
					})
				}
			}
			currentChunkLines = []
			currentChunkLength = 0
			chunkStartLineIndex = endLineIndex + 1
		}

		const createSegmentBlock = (segment: string, originalLineNumber: number, startCharIndex: number) => {
			const segmentHash = createHash("sha256")
				.update(`${filePath}-${originalLineNumber}-${originalLineNumber}-${startCharIndex}-${segment}`)
				.digest("hex")

			if (!seenSegmentHashes.has(segmentHash)) {
				seenSegmentHashes.add(segmentHash)
				chunks.push({
					file_path: filePath,
					identifier: null,
					type: `${chunkType}_segment`,
					start_line: originalLineNumber,
					end_line: originalLineNumber,
					content: segment,
					segmentHash,
					fileHash,
				})
			}
		}

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const lineLength = line.length + (i < lines.length - 1 ? 1 : 0) // +1 for newline, except last line
			const originalLineNumber = baseStartLine + i

			// Handle oversized lines (longer than effectiveMaxChars)
			if (lineLength > effectiveMaxChars) {
				// Finalize any existing normal chunk before processing the oversized line
				if (currentChunkLines.length > 0) {
					finalizeChunk(i - 1)
				}

				// Split the oversized line into segments
				let remainingLineContent = line
				let currentSegmentStartChar = 0
				while (remainingLineContent.length > 0) {
					const segment = remainingLineContent.substring(0, MAX_BLOCK_CHARS)
					remainingLineContent = remainingLineContent.substring(MAX_BLOCK_CHARS)
					createSegmentBlock(segment, originalLineNumber, currentSegmentStartChar)
					currentSegmentStartChar += MAX_BLOCK_CHARS
				}
				continue
			}

			// Handle normally sized lines
			if (currentChunkLength > 0 && currentChunkLength + lineLength > effectiveMaxChars) {
				// Re-balancing Logic
				let splitIndex = i - 1
				let remainderLength = 0
				for (let j = i; j < lines.length; j++) {
					remainderLength += lines[j].length + (j < lines.length - 1 ? 1 : 0)
				}

				if (
					currentChunkLength >= MIN_BLOCK_CHARS &&
					remainderLength < MIN_CHUNK_REMAINDER_CHARS &&
					currentChunkLines.length > 1
				) {
					for (let k = i - 2; k >= chunkStartLineIndex; k--) {
						const potentialChunkLines = lines.slice(chunkStartLineIndex, k + 1)
						const potentialChunkLength = potentialChunkLines.join("\n").length + 1
						const potentialNextChunkLines = lines.slice(k + 1)
						const potentialNextChunkLength = potentialNextChunkLines.join("\n").length + 1

						if (
							potentialChunkLength >= MIN_BLOCK_CHARS &&
							potentialNextChunkLength >= MIN_CHUNK_REMAINDER_CHARS
						) {
							splitIndex = k
							break
						}
					}
				}

				finalizeChunk(splitIndex)

				if (i >= chunkStartLineIndex) {
					currentChunkLines.push(line)
					currentChunkLength += lineLength
				} else {
					i = chunkStartLineIndex - 1
					continue
				}
			} else {
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
		seenSegmentHashes: Set<string>,
	): CodeBlock[] {
		const lines = content.split("\n")
		return this._chunkTextByLines(lines, filePath, fileHash, "fallback_chunk", seenSegmentHashes)
	}

	private _chunkLeafNodeByLines(
		node: Node,
		filePath: string,
		fileHash: string,
		seenSegmentHashes: Set<string>,
	): CodeBlock[] {
		const lines = node.text.split("\n")
		const baseStartLine = node.startPosition.row + 1
		return this._chunkTextByLines(
			lines,
			filePath,
			fileHash,
			node.type, // Use the node's type
			seenSegmentHashes,
			baseStartLine,
		)
	}
}

// Export a singleton instance for convenience
export const codeParser = new CodeParser()
