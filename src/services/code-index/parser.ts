import { readFile } from "fs/promises"
import { createHash } from "crypto"
import * as path from "path"
import { SyntaxNode, Query } from "web-tree-sitter"
import * as languageQueries from "../tree-sitter/queries"
import { loadRequiredLanguageParsers } from "../tree-sitter/languageParser"

interface CodeBlock {
	file_path: string
	identifier: string | null
	type: string
	start_line: number
	end_line: number
	content: string
	fileHash: string
	segmentHash: string
}

const MIN_BLOCK_LINES = 3
const MAX_BLOCK_LINES = 100

interface ParseOptions {
	minBlockLines?: number
	maxBlockLines?: number
	content?: string
	fileHash?: string
}

export function parseNodeBySizeRecursive(
	node: SyntaxNode,
	filePath: string,
	fileHash: string,
	minBlockLines: number,
	maxBlockLines: number,
): CodeBlock[] {
	const results: CodeBlock[] = []
	const queue: SyntaxNode[] = [...node.children]

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

export async function parseCodeFileByQueries(filePath: string, options?: ParseOptions): Promise<CodeBlock[]> {
	try {
		const content = options?.content ?? (await readFile(filePath, "utf-8"))
		const fileHash = options?.fileHash ?? createHash("sha256").update(content).digest("hex")
		const languageParsers = await loadRequiredLanguageParsers([filePath])
		const ext = path.extname(filePath).slice(1)
		const parserInfo = languageParsers[ext]

		if (!parserInfo || !parserInfo.parser) {
			throw new Error(`No parser available for file extension: ${ext}`)
		}

		let queryObj: Query | null = null
		if (parserInfo.query) {
			queryObj = parserInfo.query as Query
		} else {
			const queryString = (languageQueries as any)[`${ext}Query`]
			if (!queryString) {
				throw new Error(`No query string found for file extension: ${ext}`)
			}
			try {
				queryObj = parserInfo.parser.getLanguage().query(queryString)
			} catch (e) {
				throw new Error(`Failed to compile query for ${ext}: ${e}`)
			}
		}

		const parser = parserInfo.parser
		const tree = parser.parse(content)
		const matches = queryObj.matches(tree.rootNode)
		const results: CodeBlock[] = []
		const minBlockLines = options?.minBlockLines ?? MIN_BLOCK_LINES
		const maxBlockLines = options?.maxBlockLines ?? MAX_BLOCK_LINES

		for (const match of matches) {
			const defCapture = match.captures.find((c) => c.name.startsWith("definition."))
			if (!defCapture) continue

			const definitionNode = defCapture.node
			const lineSpan = definitionNode.endPosition.row - definitionNode.startPosition.row + 1

			if (lineSpan >= minBlockLines && lineSpan <= maxBlockLines) {
				const defType = defCapture.name.substring("definition.".length)
				const nameCapture = match.captures.find(
					(c) => c.name.startsWith("name.") && c.name.substring(5) === defType,
				)
				const identifier = nameCapture ? nameCapture.node.text : null
				const start_line = definitionNode.startPosition.row + 1
				const end_line = definitionNode.endPosition.row + 1
				const content = definitionNode.text
				const segmentHash = createHash("sha256")
					.update(`${filePath}-${start_line}-${end_line}-${content}`)
					.digest("hex")

				results.push({
					file_path: filePath,
					identifier,
					type: defType,
					start_line,
					end_line,
					content,
					segmentHash,
					fileHash,
				})
			} else if (lineSpan > maxBlockLines) {
				const subBlocks = parseNodeBySizeRecursive(
					definitionNode,
					filePath,
					fileHash,
					minBlockLines,
					maxBlockLines,
				)
				results.push(...subBlocks)
			}
		}

		return results
	} catch (error) {
		console.error(`Error parsing file ${filePath}:`, error)
		throw error
	}
}

export type { CodeBlock }
