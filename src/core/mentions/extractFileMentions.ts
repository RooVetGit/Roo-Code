import { mentionRegexGlobal } from "../../shared/context-mentions"

export interface FileMention {
	mention: string
	path: string
}

/**
 * Extracts file mentions from text content.
 * Only extracts mentions that start with "/" (file paths).
 *
 * @param text The text to extract mentions from
 * @returns Array of file mentions found in the text
 */
export function extractFileMentions(text: string): FileMention[] {
	const mentions: FileMention[] = []
	const matches = text.matchAll(mentionRegexGlobal)

	for (const match of matches) {
		const mention = match[1]
		if (mention.startsWith("/") && !mention.endsWith("/")) {
			// This is a file mention (not a folder)
			mentions.push({
				mention: `@${mention}`,
				path: mention.slice(1), // Remove leading slash
			})
		}
	}

	return mentions
}

/**
 * Checks if the given content blocks contain any file mentions
 *
 * @param content The content blocks to check
 * @returns true if any file mentions are found
 */
export function hasFileMentions(content: Array<{ type: string; text?: string }>): boolean {
	for (const block of content) {
		if (block.type === "text" && block.text) {
			const mentions = extractFileMentions(block.text)
			if (mentions.length > 0) {
				return true
			}
		}
	}
	return false
}
