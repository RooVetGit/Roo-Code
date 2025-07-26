import * as path from "path"

/**
 * Get MIME type from either a file path or a data URI
 * @param input - Either a file path or a data URI
 * @returns The MIME type or null if not found
 */
export function getMimeType(input: string): string | null {
	// Check if it's a data URI
	if (input.startsWith("data:")) {
		const match = input.match(/^data:(.*?);/)
		return match ? match[1] : null
	}

	// Otherwise, treat it as a file path
	const ext = path.extname(input).toLowerCase()
	switch (ext) {
		case ".png":
			return "image/png"
		case ".jpeg":
		case ".jpg":
			return "image/jpeg"
		case ".webp":
			return "image/webp"
		case ".mp4":
			return "video/mp4"
		case ".webm":
			return "video/webm"
		case ".ogg":
			return "video/ogg"
		case ".mov":
			return "video/quicktime"
		default:
			return null
	}
}

/**
 * Check if a MIME type represents a video
 * @param mimeType - The MIME type to check
 * @returns True if it's a video MIME type
 */
export function isVideoMimeType(mimeType: string | null): boolean {
	return mimeType?.startsWith("video/") ?? false
}

/**
 * Check if a MIME type represents an image
 * @param mimeType - The MIME type to check
 * @returns True if it's an image MIME type
 */
export function isImageMimeType(mimeType: string | null): boolean {
	return mimeType?.startsWith("image/") ?? false
}
