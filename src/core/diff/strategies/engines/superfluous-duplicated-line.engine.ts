import { SearchReplaceContext } from "../multi-search-replace"

export class SuperfluousDuplicatedLineEngine {
	/**
	 * Processes a search/replace context to detect superfluous duplicated lines.
	 *
	 * @param originalContent The complete original content being modified
	 * @param context The search/replace context containing startLine, searchContent, and replaceContent
	 * @returns The number of additional lines from the original content that should be consumed
	 *          to prevent duplication. Returns 0 if no additional lines should be consumed.
	 */
	public static process(originalContent: string, context: SearchReplaceContext): number {
		const { startLine, searchContent, replaceContent } = context

		// Early detection of superfluous duplicated line pattern
		// Check if replace content has more lines than search content
		const searchLines = searchContent.split(/\r?\n/)
		const replaceLines = replaceContent.split(/\r?\n/)
		const originalLines = originalContent.split(/\r?\n/)

		if (searchLines.length > 0 && replaceLines.length > searchLines.length && startLine > 0) {
			// Check if the first part of replace content is similar to search content
			const firstPartOfReplace = replaceLines.slice(0, searchLines.length).join("\n")

			// Simple similarity check (we can make this more sophisticated later)
			const isFirstPartSimilar = firstPartOfReplace === searchContent

			if (isFirstPartSimilar && replaceLines.length > searchLines.length) {
				// Check for any number of consecutive matching lines after the search block
				let matchingLinesCount = 0
				const searchEndIndex = startLine - 1 + searchLines.length
				const maxPossibleMatches = Math.min(
					replaceLines.length - searchLines.length, // Available lines in replace content
					originalLines.length - searchEndIndex, // Available lines in original content after search
				)

				for (let i = 0; i < maxPossibleMatches; i++) {
					const replaceLineIndex = searchLines.length + i
					const originalLineIndex = searchEndIndex + i

					const lineInReplace = replaceLines[replaceLineIndex]
					const lineInOriginal = originalLines[originalLineIndex]

					// Check if lines match (trimmed comparison to handle whitespace differences)
					if (lineInReplace && lineInOriginal && lineInReplace.trim() === lineInOriginal.trim()) {
						matchingLinesCount++
					} else {
						// Stop at the first non-matching line
						break
					}
				}

				// If we found any matching lines, return the count
				if (matchingLinesCount > 0) {
					return matchingLinesCount
				}
			}
		}

		// No additional lines to consume
		return 0
	}
}
