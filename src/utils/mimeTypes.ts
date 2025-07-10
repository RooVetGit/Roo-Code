/**
 * Shared utility for MIME type detection
 */

import * as path from "path"

/**
 * Get MIME type for a file based on its extension
 * @param filePath - The file path or extension
 * @returns The MIME type string
 * @throws Error if the file type is not supported
 */
export function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()

	switch (ext) {
		// Images
		case ".png":
			return "image/png"
		case ".jpg":
		case ".jpeg":
			return "image/jpeg"
		case ".gif":
			return "image/gif"
		case ".webp":
			return "image/webp"
		case ".bmp":
			return "image/bmp"
		case ".svg":
			return "image/svg+xml"
		case ".ico":
			return "image/x-icon"

		// Text files
		case ".txt":
			return "text/plain"
		case ".json":
			return "application/json"
		case ".xml":
			return "application/xml"
		case ".yaml":
		case ".yml":
			return "text/yaml"
		case ".csv":
			return "text/csv"
		case ".tsv":
			return "text/tab-separated-values"
		case ".md":
			return "text/markdown"
		case ".log":
			return "text/plain"
		case ".ini":
		case ".cfg":
		case ".conf":
			return "text/plain"

		// Code files
		case ".js":
			return "text/javascript"
		case ".ts":
			return "text/typescript"
		case ".jsx":
			return "text/jsx"
		case ".tsx":
			return "text/tsx"
		case ".py":
			return "text/x-python"
		case ".java":
			return "text/x-java"
		case ".c":
			return "text/x-c"
		case ".cpp":
		case ".cc":
		case ".cxx":
			return "text/x-c++src"
		case ".cs":
			return "text/x-csharp"
		case ".go":
			return "text/x-go"
		case ".rs":
			return "text/x-rust"
		case ".php":
			return "text/x-php"
		case ".rb":
			return "text/x-ruby"
		case ".swift":
			return "text/x-swift"
		case ".kt":
			return "text/x-kotlin"
		case ".scala":
			return "text/x-scala"
		case ".r":
			return "text/x-r"
		case ".m":
			return "text/x-objc"
		case ".mm":
			return "text/x-objc++src"
		case ".h":
		case ".hpp":
			return "text/x-c++hdr"
		case ".sh":
		case ".bash":
			return "text/x-shellscript"
		case ".ps1":
			return "text/x-powershell"
		case ".bat":
		case ".cmd":
			return "text/x-bat"

		// Web files
		case ".html":
		case ".htm":
			return "text/html"
		case ".css":
			return "text/css"
		case ".scss":
		case ".sass":
			return "text/x-scss"
		case ".less":
			return "text/x-less"

		// Documents
		case ".pdf":
			return "application/pdf"
		case ".doc":
			return "application/msword"
		case ".docx":
			return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		case ".xls":
			return "application/vnd.ms-excel"
		case ".xlsx":
			return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		case ".ppt":
			return "application/vnd.ms-powerpoint"
		case ".pptx":
			return "application/vnd.openxmlformats-officedocument.presentationml.presentation"

		default:
			// For unknown extensions, return a generic binary type
			return "application/octet-stream"
	}
}

/**
 * Check if a file extension represents an image
 * @param extension - The file extension (with or without dot)
 * @returns true if the extension is for an image file
 */
export function isImageExtension(extension: string): boolean {
	const ext = extension.startsWith(".") ? extension.substring(1) : extension
	const imageExtensions = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "ico"]
	return imageExtensions.includes(ext.toLowerCase())
}

/**
 * Check if a MIME type represents an image
 * @param mimeType - The MIME type to check
 * @returns true if the MIME type is for an image
 */
export function isImageMimeType(mimeType: string): boolean {
	return mimeType.startsWith("image/")
}
