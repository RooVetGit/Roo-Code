/**
 * Utilities for handling path-related operations in mentions
 */

/**
 * Converts an absolute path to a mention-friendly path
 * If the provided path starts with the current working directory,
 * it's converted to a relative path prefixed with @
 *
 * @param path The path to convert
 * @param cwd The current working directory
 * @returns A mention-friendly path
 */
export function convertToMentionPath(path: string, cwd?: string): string {
	// First, detect and temporarily replace already escaped spaces
	// We need to be careful with Windows paths that use backslashes
	const detectedPath = path.replace(/\\/g, "/")
	// Temporarily replace escaped spaces
	let processedPath = detectedPath.replace(/\\ /g, "\\ESCAPED_SPACE")

	let normalizedCwd = cwd ? cwd.replace(/\\/g, "/") : ""

	if (!normalizedCwd) {
		// If no CWD, just escape spaces in the original path and restore escaped spaces
		return processedPath.replace(/ /g, "\\ ").replace(/\\ESCAPED_SPACE/g, "\\\\ ")
	}

	// Remove trailing slash from cwd if it exists
	if (normalizedCwd.endsWith("/")) {
		normalizedCwd = normalizedCwd.slice(0, -1)
	}

	// Always use case-insensitive comparison for path matching
	const lowerPath = processedPath.toLowerCase()
	const lowerCwd = normalizedCwd.toLowerCase()

	if (lowerPath.startsWith(lowerCwd)) {
		const relativePath = processedPath.substring(normalizedCwd.length)
		// Ensure there's a slash after the @ symbol when we create the mention path
		let mentionPath = "@" + (relativePath.startsWith("/") ? relativePath : "/" + relativePath)

		/**
		 * Space escaping logic for file paths
		 *
		 * This is the first step in our multi-level escaping strategy.
		 * When a path contains spaces, we escape them with backslashes to ensure proper parsing.
		 *
		 * THE ESCAPING PIPELINE:
		 * =====================
		 * 1. We replace any already escaped spaces with a temporary marker.
		 * 2. We escape regular spaces with a single backslash.
		 * 3. We replace our markers with double backslashes.
		 *
		 * This produces paths like: "@/path/with\ spaces/file.txt"
		 *
		 * NOTE: Later, when this path is used with insertMention(), those escaped spaces
		 * will undergo a second round of escaping, resulting in double backslashes.
		 * This is necessary to preserve the escapes through the entire text processing pipeline.
		 */
		// Escape regular spaces and restore already escaped spaces
		return mentionPath.replace(/ /g, "\\ ").replace(/\\ESCAPED_SPACE/g, "\\\\ ")
	}

	// If path doesn't start with CWD, escape spaces in the processed path
	return processedPath.replace(/ /g, "\\ ").replace(/\\ESCAPED_SPACE/g, "\\\\ ")
}
