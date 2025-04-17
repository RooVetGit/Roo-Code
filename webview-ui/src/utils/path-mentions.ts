/**
 * Utilities for handling path-related operations in mentions
 */

/**
 * Escapes spaces in a path with backslashes
 *
 * @param path The path to escape
 * @returns A path with spaces escaped
 */
export function escapeSpaces(path: string): string {
	return path.replace(/ /g, "\\ ")
}

/**
 * Converts an absolute path to a mention-friendly path
 * If the provided path starts with the current working directory,
 * it's converted to a relative path prefixed with @
 * Spaces in the path are escaped with backslashes
 *
 * @param path The path to convert
 * @param cwd The current working directory
 * @returns A mention-friendly path
 */
export function convertToMentionPath(path: string, cwd?: string): string {
	// Normalize paths by replacing all backslashes with forward slashes
	const normalizedPath = path.replace(/\\/g, "/")
	let normalizedCwd = cwd ? cwd.replace(/\\/g, "/") : ""

	if (!normalizedCwd) {
		return path
	}

	// Remove trailing slash from cwd if it exists
	if (normalizedCwd.endsWith("/")) {
		normalizedCwd = normalizedCwd.slice(0, -1)
	}

	// Always use case-insensitive comparison for path matching
	const lowerPath = normalizedPath.toLowerCase()
	const lowerCwd = normalizedCwd.toLowerCase()

	if (lowerPath.startsWith(lowerCwd)) {
		let relativePath = normalizedPath.substring(normalizedCwd.length)
		// Ensure there's a slash after the @ symbol when we create the mention path
		relativePath = relativePath.startsWith("/") ? relativePath : "/" + relativePath

		// Escape any spaces in the path with backslashes
		const escapedRelativePath = escapeSpaces(relativePath)

		return "@" + escapedRelativePath
	}

	return path
}
