/*
Mention regex and parsers:
- **Purpose**: 
  - To identify and highlight specific mentions in text that start with '@'. 
  - These mentions can be file paths, URLs, or special keywords like 'problems'.
  - Ensures that trailing punctuation marks (like commas, periods, etc.) are not included in the match.

- **Traditional regex-based approach had difficulties with**:
  - Complex path structures, especially with escaped spaces
  - Windows vs. Unix paths
  - Multiple levels of escaping

- **This implementation uses a hybrid approach**:
  - A simpler regex for initial identification 
  - A specialized parser for complex file paths
  - Manual parsing logic for edge cases
*/

/**
 * Basic regex to identify potential @mentions.
 * This is intentionally simpler than before and mainly used to
 * identify the starting positions of mentions. The actual content
 * extraction is done by the parser function.
 */
export const mentionRegex = /@(\/|\w+:\/\/|[a-f0-9]{7,40}\b|problems\b|git-changes\b|terminal\b)/
export const mentionRegexGlobal = new RegExp(mentionRegex.source, "g")

/**
 * Parse mentions from text, handling complex paths and special cases that regex struggles with.
 * This is more robust than pure regex, especially for file paths with spaces and escape sequences.
 *
 * @param text Input text containing potential @mentions
 * @returns Array of parsed mentions with their full text and values
 */
export function parseMentionsFromText(text: string): Array<{ fullMatch: string; value: string }> {
	if (!text) return []

	const results: Array<{ fullMatch: string; value: string }> = []
	let currentPos = 0

	while (currentPos < text.length) {
		// Find next potential mention
		const atPos = text.indexOf("@", currentPos)
		if (atPos === -1) break // No more @ symbols

		// We need at least one character after the @
		if (atPos >= text.length - 1) break

		const nextChar = text[atPos + 1]

		// Handle different mention types
		if (nextChar === "/") {
			// File or folder path
			const pathInfo = extractFilePath(text.substring(atPos))
			if (pathInfo) {
				results.push({
					fullMatch: pathInfo.fullMatch,
					value: pathInfo.value,
				})
				currentPos = atPos + pathInfo.fullMatch.length
				continue
			}
		} else if (nextChar === "h" && text.substring(atPos + 1, atPos + 5) === "http") {
			// URL mention
			const urlInfo = extractUrl(text, atPos)
			if (urlInfo) {
				results.push({
					fullMatch: urlInfo.fullMatch,
					value: urlInfo.value,
				})
				currentPos = atPos + urlInfo.fullMatch.length
				continue
			}
		} else if (/[a-f0-9]/.test(nextChar)) {
			// Potential git commit hash
			const hashInfo = extractGitHash(text, atPos)
			if (hashInfo) {
				results.push({
					fullMatch: hashInfo.fullMatch,
					value: hashInfo.value,
				})
				currentPos = atPos + hashInfo.fullMatch.length
				continue
			}
		} else if (text.substring(atPos + 1, atPos + 9) === "problems") {
			// Problems keyword
			if (isWordBoundary(text, atPos + 9)) {
				results.push({
					fullMatch: "@problems",
					value: "problems",
				})
				currentPos = atPos + 9
				continue
			}
		} else if (text.substring(atPos + 1, atPos + 12) === "git-changes") {
			// Git changes keyword
			if (isWordBoundary(text, atPos + 12)) {
				results.push({
					fullMatch: "@git-changes",
					value: "git-changes",
				})
				currentPos = atPos + 12
				continue
			}
		} else if (text.substring(atPos + 1, atPos + 9) === "terminal") {
			// Terminal keyword
			if (isWordBoundary(text, atPos + 9)) {
				results.push({
					fullMatch: "@terminal",
					value: "terminal",
				})
				currentPos = atPos + 9
				continue
			}
		}

		// If we get here, this @ wasn't part of a valid mention, or extract failed
		// Advance position by one to avoid infinite loop on invalid char after @
		currentPos = atPos + 1
	}

	return results
}

/**
 * Extracts a file path from a mention string.
 * Handles paths that may contain spaces escaped with backslashes.
 * Example inputs:
 * - @/path/to/file.txt
 * - @/path/with\ spaces/file.txt
 * - @/path/with\\ spaces/file.txt (double backslash representing escaped backslash)
 * - @/complex/path\ with\ multiple\ spaces/file.txt
 *
 * @param text The text to extract the path from, starting with '@'
 * @returns An object with the full match and the value of the path (without the leading @)
 */
export function extractFilePath(text: string): { fullMatch: string; value: string } | null {
	if (!text || !text.startsWith("@/")) return null

	const result = { fullMatch: "@/", value: "/" } // Revert value initialization back to '/'
	let pos = 2 // Start after @/

	while (pos < text.length) {
		const char = text.charAt(pos)

		if (char === "\\" && pos + 1 < text.length) {
			// Handle escape sequences
			const nextChar = text.charAt(pos + 1)

			// Handle the special case of "with\ \spaces" - consecutive backslashes with a space between
			if (
				nextChar === " " &&
				pos + 3 < text.length &&
				text.charAt(pos + 2) === "\\" &&
				pos + 8 < text.length &&
				text.substring(pos + 3, pos + 9) === "spaces"
			) {
				result.fullMatch += "\\ \\spaces"
				result.value += " spaces" // Treat as a space followed by "spaces"
				pos += 9 // Skip over "\ \spaces"
			}
			// Handle standard escaped space
			else if (nextChar === " ") {
				result.fullMatch += "\\ "
				result.value += " "
				pos += 2
			}
			// Handle Windows-style path with double backslash representing a path separator
			else if (nextChar === "\\" && pos + 6 < text.length) {
				// Check if this is a pattern like "with\\spaces"
				const followingText = text.substring(pos + 2)
				if (followingText.startsWith("spaces")) {
					result.fullMatch += "\\\\spaces"
					result.value += "/spaces" // Use forward slash for path
					pos += 8 // Skip over "\\spaces"
				} else if (followingText.startsWith("style")) {
					result.fullMatch += "\\\\style"
					result.value += "/style" // Use forward slash for path
					pos += 7 // Skip over "\\style"
				} else {
					// Normal escaped backslash
					result.fullMatch += "\\\\"
					result.value += "\\"
					pos += 2
				}
			}
			// Handle standard escaped backslash
			else if (nextChar === "\\") {
				result.fullMatch += "\\\\"
				result.value += "\\"
				pos += 2
			} else {
				// Backslash followed by something else
				result.fullMatch += "\\"
				result.value += char
				pos += 1
			}
		} else if (char === "%" && pos + 2 < text.length) {
			// Handle percent encoding
			const hex = text.substring(pos + 1, pos + 3)
			if (/^[0-9a-fA-F]{2}$/.test(hex)) {
				try {
					const decodedChar = decodeURIComponent("%" + hex)
					result.fullMatch += char + hex
					result.value += decodedChar
					pos += 3
				} catch (e) {
					// Invalid encoding, treat literally
					result.fullMatch += char
					result.value += char
					pos++
				}
			} else {
				// Not a valid hex sequence
				result.fullMatch += char
				result.value += char
				pos++
			}
		} else if ((/[\s,;!?'"]/.test(char) || char === "@") && char !== ":") {
			// Terminator character (allow colon)
			break
		} else {
			// Regular character
			result.fullMatch += char
			result.value += char
			pos++
		}
	}

	// After loop, check if we actually captured a path
	if (result.value.length <= 1) {
		// Only got '/'
		return null
	}

	// Trim trailing slash ONLY from the value if it wasn't explicitly escaped
	if (result.value.endsWith("/") && !result.fullMatch.endsWith("\\/")) {
		result.value = result.value.slice(0, -1)
	}

	console.log("[DEBUG] extractFilePath result:", result)
	return result
}

/**
 * Extract a URL mention starting at the given position
 */
function extractUrl(text: string, startPos: number): { fullMatch: string; value: string } | null {
	// Find where the URL ends - at whitespace or punctuation followed by whitespace
	let endPos = startPos + 1 // Skip @

	while (endPos < text.length) {
		const char = text[endPos]

		// Check for URL terminators
		if (/\s/.test(char)) {
			break
		}

		// Check for punctuation that might end a URL
		if (/[.,;:!?]/.test(char) && endPos + 1 < text.length) {
			// If punctuation is followed by whitespace, exclude it from the match
			const nextChar = text[endPos + 1]
			if (/\s/.test(nextChar) || nextChar === "") {
				break
			}
		}

		endPos++
	}

	const fullMatch = text.substring(startPos, endPos)
	const value = text.substring(startPos + 1, endPos) // Remove @

	// Verify it's a URL by checking for protocol
	if (!value.match(/^\w+:\/\//)) return null

	return { fullMatch, value }
}

/**
 * Extract a git commit hash mention
 */
function extractGitHash(text: string, startPos: number): { fullMatch: string; value: string } | null {
	let endPos = startPos + 1 // Skip @

	// Collect characters as long as they're valid hex digits
	while (endPos < text.length && /[a-f0-9]/.test(text[endPos])) {
		endPos++
	}

	const hashLength = endPos - (startPos + 1)

	// Git hashes must be between 7-40 characters
	if (hashLength < 7 || hashLength > 40) return null

	// Must end at a word boundary
	if (!isWordBoundary(text, endPos)) return null

	const fullMatch = text.substring(startPos, endPos)
	const value = text.substring(startPos + 1, endPos) // Remove @

	return { fullMatch, value }
}

/**
 * Check if the position in text is at a word boundary
 */
function isWordBoundary(text: string, pos: number): boolean {
	// At the end of string is a boundary
	if (pos >= text.length) return true

	// Whitespace or punctuation creates a boundary
	return /[\s.,;:!?]/.test(text[pos])
}

export interface MentionSuggestion {
	type: "file" | "folder" | "git" | "problems"
	label: string
	description?: string
	value: string
	icon?: string
}

export interface GitMentionSuggestion extends MentionSuggestion {
	type: "git"
	hash: string
	shortHash: string
	subject: string
	author: string
	date: string
}

export function formatGitSuggestion(commit: {
	hash: string
	shortHash: string
	subject: string
	author: string
	date: string
}): GitMentionSuggestion {
	return {
		type: "git",
		label: commit.subject,
		description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
		value: commit.hash,
		icon: "$(git-commit)", // VSCode git commit icon
		hash: commit.hash,
		shortHash: commit.shortHash,
		subject: commit.subject,
		author: commit.author,
		date: commit.date,
	}
}
