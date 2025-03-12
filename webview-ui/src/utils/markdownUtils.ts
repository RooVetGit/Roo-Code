/**
 * Utility functions for markdown processing
 */

/**
 * Removes trailing code block delimiters from markdown text
 *
 * This function removes trailing code block delimiters like "```tool_code" or "```xml"
 * that might appear at the very end of a markdown string.
 *
 * @param markdown - The markdown text to clean
 * @returns The cleaned markdown text with trailing code delimiters removed
 */
export function cleanTrailingCodeDelimiters(markdown?: string): string | undefined {
	if (!markdown) return markdown

	// Regex to match trailing code block delimiters at the very end of the string
	return markdown.replace(/```[a-zA-Z0-9_-]*\s*$/g, "")
}
