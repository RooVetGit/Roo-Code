import { distance } from "fastest-levenshtein"

import { ToolProgressStatus } from "@roo-code/types"

import { addLineNumbers, everyLineHasLineNumbers, stripLineNumbers } from "../../../integrations/misc/extract-text"
import { ToolUse, DiffStrategy, DiffResult } from "../../../shared/tools"
import { normalizeString } from "../../../utils/text-normalization"

const BUFFER_LINES = 40 // Number of extra context lines to show before and after matches

function getSimilarity(original: string, search: string): number {
	// Empty searches are no longer supported
	if (search === "") {
		return 0
	}

	// Use the normalizeString utility to handle smart quotes and other special characters
	const normalizedOriginal = normalizeString(original)
	const normalizedSearch = normalizeString(search)

	if (normalizedOriginal === normalizedSearch) {
		return 1
	}

	// Calculate Levenshtein distance using fastest-levenshtein's distance function
	const dist = distance(normalizedOriginal, normalizedSearch)

	// Calculate similarity ratio (0 to 1, where 1 is an exact match)
	const maxLength = Math.max(normalizedOriginal.length, normalizedSearch.length)
	return 1 - dist / maxLength
}

/**
 * Performs a "middle-out" search of `lines` (between [startIndex, endIndex]) to find
 * the slice that is most similar to `searchChunk`. Returns the best score, index, and matched text.
 */
function fuzzySearch(lines: string[], searchChunk: string, startIndex: number, endIndex: number) {
	let bestScore = 0
	let bestMatchIndex = -1
	let bestMatchContent = ""
	const searchLen = searchChunk.split(/\r?\n/).length

	// Middle-out from the midpoint
	const midPoint = Math.floor((startIndex + endIndex) / 2)
	let leftIndex = midPoint
	let rightIndex = midPoint + 1

	while (leftIndex >= startIndex || rightIndex <= endIndex - searchLen) {
		if (leftIndex >= startIndex) {
			const originalChunk = lines.slice(leftIndex, leftIndex + searchLen).join("\n")
			const similarity = getSimilarity(originalChunk, searchChunk)
			if (similarity > bestScore) {
				bestScore = similarity
				bestMatchIndex = leftIndex
				bestMatchContent = originalChunk
			}
			leftIndex--
		}

		if (rightIndex <= endIndex - searchLen) {
			const originalChunk = lines.slice(rightIndex, rightIndex + searchLen).join("\n")
			const similarity = getSimilarity(originalChunk, searchChunk)
			if (similarity > bestScore) {
				bestScore = similarity
				bestMatchIndex = rightIndex
				bestMatchContent = originalChunk
			}
			rightIndex++
		}
	}

	return { bestScore, bestMatchIndex, bestMatchContent }
}

/**
 * A simplified diff strategy that uses a more straightforward format
 * that's easier for non-Claude models to understand and generate.
 */
export class SimpleSearchReplaceDiffStrategy implements DiffStrategy {
	private fuzzyThreshold: number
	private bufferLines: number

	getName(): string {
		return "SimpleSearchReplace"
	}

	constructor(fuzzyThreshold?: number, bufferLines?: number) {
		// Use provided threshold or default to exact matching (1.0)
		// Note: fuzzyThreshold is inverted in UI (0% = 1.0, 10% = 0.9)
		// so we use it directly here
		this.fuzzyThreshold = fuzzyThreshold ?? 1.0
		this.bufferLines = bufferLines ?? BUFFER_LINES
	}

	getToolDescription(args: { cwd: string; toolOptions?: { [key: string]: string } }): string {
		return `## apply_diff
Description: Apply targeted modifications to an existing file by searching for specific content and replacing it.
This tool performs precise edits by finding exact matches of content and replacing them with new content.
You can perform multiple search and replace operations in a single call by providing multiple blocks.

Parameters:
- path: (required) The path of the file to modify (relative to ${args.cwd})
- diff: (required) The search/replace operations to perform

Format:
Each search/replace operation should be formatted as:

SEARCH:
[exact content to find]
REPLACE:
[new content to replace with]

You can include multiple SEARCH/REPLACE blocks in a single diff.

Example:

Original file:
\`\`\`
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
\`\`\`

To change the function name and implementation:
\`\`\`
SEARCH:
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
REPLACE:
def calculate_sum(items):
    """Calculate sum with 10% markup"""
    return sum(item * 1.1 for item in items)
\`\`\`

Multiple edits example:
\`\`\`
SEARCH:
def calculate_total(items):
REPLACE:
def calculate_sum(items):

SEARCH:
    total = 0
REPLACE:
    sum_value = 0

SEARCH:
        total += item
    return total
REPLACE:
        sum_value += item
    return sum_value
\`\`\`

Usage:
<apply_diff>
<path>path/to/file.py</path>
<diff>
SEARCH:
content to find
REPLACE:
content to replace with
</diff>
</apply_diff>`
	}

	async applyDiff(
		originalContent: string,
		diffContent: string,
		_paramStartLine?: number,
		_paramEndLine?: number,
	): Promise<DiffResult> {
		// Parse the simplified format
		const operations = this.parseDiffContent(diffContent)

		if (operations.length === 0) {
			return {
				success: false,
				error: "No valid SEARCH/REPLACE operations found in diff content",
			}
		}

		// Detect line ending from original content
		const lineEnding = originalContent.includes("\r\n") ? "\r\n" : "\n"
		let resultLines = originalContent.split(/\r?\n/)
		let diffResults: DiffResult[] = []
		let appliedCount = 0

		for (const operation of operations) {
			let { searchContent, replaceContent } = operation

			// Strip line numbers from search and replace content if every line starts with a line number
			const hasAllLineNumbers =
				(everyLineHasLineNumbers(searchContent) && everyLineHasLineNumbers(replaceContent)) ||
				(everyLineHasLineNumbers(searchContent) && replaceContent.trim() === "")

			if (hasAllLineNumbers) {
				searchContent = stripLineNumbers(searchContent)
				replaceContent = stripLineNumbers(replaceContent)
			}

			// Validate that search and replace content are not identical
			if (searchContent === replaceContent) {
				diffResults.push({
					success: false,
					error:
						`Search and replace content are identical - no changes would be made\n\n` +
						`Debug Info:\n` +
						`- Search and replace must be different to make changes\n` +
						`- Use read_file to verify the content you want to change`,
				})
				continue
			}

			// Split content into lines, handling both \n and \r\n
			let searchLines = searchContent === "" ? [] : searchContent.split(/\r?\n/)
			let replaceLines = replaceContent === "" ? [] : replaceContent.split(/\r?\n/)

			// Validate that search content is not empty
			if (searchLines.length === 0) {
				diffResults.push({
					success: false,
					error: `Empty search content is not allowed\n\nDebug Info:\n- Search content cannot be empty\n- Provide specific content to search for`,
				})
				continue
			}

			// Initialize search variables
			let matchIndex = -1
			let bestMatchScore = 0
			let bestMatchContent = ""
			let searchChunk = searchLines.join("\n")

			// Perform fuzzy search
			const {
				bestScore,
				bestMatchIndex,
				bestMatchContent: midContent,
			} = fuzzySearch(resultLines, searchChunk, 0, resultLines.length)
			matchIndex = bestMatchIndex
			bestMatchScore = bestScore
			bestMatchContent = midContent

			// Try aggressive line number stripping as a fallback if regular matching fails
			if (matchIndex === -1 || bestMatchScore < this.fuzzyThreshold) {
				// Strip both search and replace content once (simultaneously)
				const aggressiveSearchContent = stripLineNumbers(searchContent, true)
				const aggressiveReplaceContent = stripLineNumbers(replaceContent, true)

				const aggressiveSearchLines = aggressiveSearchContent ? aggressiveSearchContent.split(/\r?\n/) : []
				const aggressiveSearchChunk = aggressiveSearchLines.join("\n")

				// Try fuzzy search again with aggressive stripped content
				const {
					bestScore,
					bestMatchIndex,
					bestMatchContent: aggContent,
				} = fuzzySearch(resultLines, aggressiveSearchChunk, 0, resultLines.length)
				if (bestMatchIndex !== -1 && bestScore >= this.fuzzyThreshold) {
					matchIndex = bestMatchIndex
					bestMatchScore = bestScore
					bestMatchContent = aggContent
					// Replace the original search/replace with their stripped versions
					searchContent = aggressiveSearchContent
					replaceContent = aggressiveReplaceContent
					searchLines = aggressiveSearchLines
					replaceLines = replaceContent ? replaceContent.split(/\r?\n/) : []
				} else {
					// No match found with either method
					const originalContentSection = `\n\nOriginal Content:\n${addLineNumbers(resultLines.join("\n"))}`

					const bestMatchSection = bestMatchContent
						? `\n\nBest Match Found:\n${addLineNumbers(bestMatchContent, matchIndex + 1)}`
						: `\n\nBest Match Found:\n(no match)`

					diffResults.push({
						success: false,
						error: `No sufficiently similar match found (${Math.floor(bestMatchScore * 100)}% similar, needs ${Math.floor(this.fuzzyThreshold * 100)}%)\n\nDebug Info:\n- Similarity Score: ${Math.floor(bestMatchScore * 100)}%\n- Required Threshold: ${Math.floor(this.fuzzyThreshold * 100)}%\n- Tip: Use the read_file tool to get the latest content of the file before attempting to use the apply_diff tool again\n\nSearch Content:\n${searchChunk}${bestMatchSection}${originalContentSection}`,
					})
					continue
				}
			}

			// Get the matched lines from the original content
			const matchedLines = resultLines.slice(matchIndex, matchIndex + searchLines.length)

			// Get the exact indentation (preserving tabs/spaces) of each line
			const originalIndents = matchedLines.map((line) => {
				const match = line.match(/^[\t ]*/)
				return match ? match[0] : ""
			})

			// Get the exact indentation of each line in the search block
			const searchIndents = searchLines.map((line) => {
				const match = line.match(/^[\t ]*/)
				return match ? match[0] : ""
			})

			// Apply the replacement while preserving exact indentation
			const indentedReplaceLines = replaceLines.map((line, lineIndex) => {
				// If the line is empty, return it as is
				if (line.trim() === "") {
					return ""
				}

				// Get the base indentation from the matched content
				const baseIndent = originalIndents[0] || ""

				// Get the current line's indentation from the replacement content
				const currentIndentMatch = line.match(/^[\t ]*/)
				const currentIndent = currentIndentMatch ? currentIndentMatch[0] : ""

				// Get the base indentation from the replacement content (first line)
				const replaceBaseIndentMatch = replaceLines[0].match(/^[\t ]*/)
				const replaceBaseIndent = replaceBaseIndentMatch ? replaceBaseIndentMatch[0] : ""

				// Calculate the relative indentation
				// If the current line has more indentation than the replacement base,
				// add the extra indentation to the base indent
				if (currentIndent.length > replaceBaseIndent.length) {
					const extraIndent = currentIndent.slice(replaceBaseIndent.length)
					return baseIndent + extraIndent + line.trim()
				} else {
					// Otherwise, just use the base indentation
					return baseIndent + line.trim()
				}
			})

			// Construct the final content
			const beforeMatch = resultLines.slice(0, matchIndex)
			const afterMatch = resultLines.slice(matchIndex + searchLines.length)
			resultLines = [...beforeMatch, ...indentedReplaceLines, ...afterMatch]
			appliedCount++
		}

		const finalContent = resultLines.join(lineEnding)
		if (appliedCount === 0) {
			return {
				success: false,
				failParts: diffResults,
			}
		}
		return {
			success: true,
			content: finalContent,
			failParts: diffResults,
		}
	}

	private parseDiffContent(diffContent: string): Array<{ searchContent: string; replaceContent: string }> {
		const operations: Array<{ searchContent: string; replaceContent: string }> = []

		// Split by SEARCH: markers
		const parts = diffContent.split(/^SEARCH:\s*$/m)

		for (const part of parts) {
			if (!part.trim()) continue

			// Split by REPLACE: marker
			const replaceParts = part.split(/^REPLACE:\s*$/m)

			if (replaceParts.length === 2) {
				const searchContent = replaceParts[0].trim()
				const replaceContent = replaceParts[1].trim()

				operations.push({ searchContent, replaceContent })
			}
		}

		return operations
	}

	getProgressStatus(toolUse: ToolUse, result?: DiffResult): ToolProgressStatus {
		const diffContent = toolUse.params.diff
		if (diffContent) {
			const icon = "diff-multiple"
			if (toolUse.partial) {
				if (Math.floor(diffContent.length / 10) % 10 === 0) {
					const searchBlockCount = (diffContent.match(/SEARCH:/g) || []).length
					return { icon, text: `${searchBlockCount}` }
				}
			} else if (result) {
				const searchBlockCount = (diffContent.match(/SEARCH:/g) || []).length
				if (result.failParts?.length) {
					return {
						icon,
						text: `${searchBlockCount - result.failParts.length}/${searchBlockCount}`,
					}
				} else {
					return { icon, text: `${searchBlockCount}` }
				}
			}
		}
		return {}
	}
}
