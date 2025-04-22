import { readFile } from "fs/promises"
import { createHash } from "crypto"
import * as path from "path"
import * as treeSitter from "web-tree-sitter"
import { extensions as treeSitterExtensions } from "../../tree-sitter"
import { LanguageParser, loadRequiredLanguageParsers } from "../../tree-sitter/languageParser"
import { ICodeParser, CodeBlock } from "../interfaces"

const MIN_BLOCK_LINES = 3
const MAX_BLOCK_LINES = 100

/**
 * Implementation of the code parser interface
 */
export class CodeParser implements ICodeParser {
	private loadedParsers: LanguageParser = {}
	private pendingLoads: Map<string, Promise<LanguageParser>> = new Map()
	// Markdown files are excluded because the current parser logic cannot effectively handle
	// potentially large Markdown sections without a tree-sitter-like child node structure for chunking
	private readonly _supportedExtensions = treeSitterExtensions.filter((ext) => ext !== ".md" && ext !== ".markdown")

	/**
	 * Parses a code file into code blocks
	 * @param filePath Path to the file to parse
	 * @param options Optional parsing options
	 * @returns Promise resolving to array of code blocks
	 */
	async parseFile(
		filePath: string,
		options?: {
			minBlockLines?: number
			maxBlockLines?: number
			content?: string
			fileHash?: string
		},
	): Promise<CodeBlock[]> {
		const minBlockLines = options?.minBlockLines ?? MIN_BLOCK_LINES
		const maxBlockLines = options?.maxBlockLines ?? MAX_BLOCK_LINES

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
		return this.parseContent(filePath, content, fileHash, minBlockLines, maxBlockLines)
	}

	/**
	 * Checks if a language is supported
	 * @param extension File extension
	 * @returns Boolean indicating if the language is supported
	 */
	private isSupportedLanguage(extension: string): boolean {
		return this._supportedExtensions.includes(extension)
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
	 * @param minBlockLines Minimum number of lines for a block
	 * @param maxBlockLines Maximum number of lines for a block
	 * @returns Array of code blocks
	 */
	private async parseContent(
		filePath: string,
		content: string,
		fileHash: string,
		minBlockLines: number,
		maxBlockLines: number,
	): Promise<CodeBlock[]> {
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
		const results: CodeBlock[] = []

		// Process captures
		const queue: treeSitter.SyntaxNode[] = captures.map((capture: any) => capture.node)

		while (queue.length > 0) {
			const currentNode = queue.shift()!
			const lineSpan = currentNode.endPosition.row - currentNode.startPosition.row + 1

			if (lineSpan >= minBlockLines && lineSpan <= maxBlockLines) {
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
			} else if (lineSpan > maxBlockLines) {
				queue.push(...currentNode.children)
			}
		}

		return results
	}
}

// Export a singleton instance for convenience
export const codeParser = new CodeParser()
