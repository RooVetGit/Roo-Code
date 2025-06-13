import * as vscode from "vscode"

// Maximum safe URI length to avoid crashes in language servers
// Most systems have limits between 2KB-32KB, using conservative 8KB limit
export const MAX_SAFE_URI_LENGTH = 8192

/**
 * Safely creates a URI with content encoded in the query parameter.
 * If the resulting URI would be too long, truncates the content to avoid LSP crashes.
 *
 * @param scheme - The URI scheme (e.g., "cline-diff")
 * @param path - The URI path/identifier
 * @param content - Content to encode as base64 in the query parameter
 * @returns A safe URI that won't exceed system limits
 */
export function createSafeContentUri(scheme: string, path: string, content: string): vscode.Uri {
	try {
		const base64Content = Buffer.from(content).toString("base64")
		const baseUri = `${scheme}:${path}`
		const uri = vscode.Uri.parse(baseUri).with({ query: base64Content })

		if (uri.toString().length <= MAX_SAFE_URI_LENGTH) {
			return uri
		}

		// Calculate available space for content after accounting for URI overhead
		const overhead = baseUri.length + 100 // Extra buffer for URI encoding and VS Code overhead
		const maxBase64Length = Math.max(0, MAX_SAFE_URI_LENGTH - overhead)

		// Truncate content to fit within safe URI length
		const maxContentLength = Math.floor((maxBase64Length * 3) / 4) // Base64 is ~4/3 the size
		const truncatedContent =
			content.length > maxContentLength
				? content.substring(0, maxContentLength) + "\n... [Content truncated to prevent LSP crashes]"
				: content

		const truncatedBase64 = Buffer.from(truncatedContent).toString("base64")
		return vscode.Uri.parse(baseUri).with({ query: truncatedBase64 })
	} catch (error) {
		console.error(`Failed to create safe content URI for ${path}:`, error)
		// Fallback to empty content if all else fails
		return vscode.Uri.parse(`${scheme}:${path}`).with({
			query: Buffer.from("").toString("base64"),
		})
	}
}
