import { readFile } from "fs/promises"
import { createHash } from "crypto"
import * as path from "path"
import { SyntaxNode } from "web-tree-sitter"
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

const MIN_BLOCK_LINES = 2
const MAX_BLOCK_LINES = 100

export async function parseCodeFileBySize(
	filePath: string,
	options?: { minBlockLines?: number; maxBlockLines?: number },
): Promise<CodeBlock[]> {
	try {
		const content = await readFile(filePath, "utf-8")
		const fileHash = createHash("sha256").update(content).digest("hex")
		const languageParsers = await loadRequiredLanguageParsers([filePath])
		const ext = path.extname(filePath).slice(1)
		const parserInfo = languageParsers[ext]

		if (!parserInfo || !parserInfo.parser) {
			throw new Error(`No parser available for file extension: ${ext}`)
		}

		const parser = parserInfo.parser
		const tree = parser.parse(content)
		const results: CodeBlock[] = []
		const queue: SyntaxNode[] = [...tree.rootNode.children]
		const minBlockLines = options?.minBlockLines ?? MIN_BLOCK_LINES
		const maxBlockLines = options?.maxBlockLines ?? MAX_BLOCK_LINES

		while (queue.length > 0) {
			const node = queue.shift()!
			const lineSpan = node.endPosition.row - node.startPosition.row + 1

			if (lineSpan >= minBlockLines && lineSpan <= maxBlockLines) {
				const identifier =
					node.childForFieldName("name")?.text ||
					node.children.find((c) => c.type === "identifier")?.text ||
					null
				const type = node.type
				const start_line = node.startPosition.row + 1
				const end_line = node.endPosition.row + 1
				const content = node.text
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
				queue.push(...node.children)
			}
		}
		return results
	} catch (error) {
		console.error(`Error parsing file ${filePath}:`, error)
		throw error
	}
}

export type { CodeBlock }
