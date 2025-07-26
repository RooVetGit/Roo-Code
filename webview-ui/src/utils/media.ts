/**
 * Get MIME type from a data URI
 * @param dataUri - A data URI string
 * @returns The MIME type or null if not found
 */
export function getMimeType(dataUri: string): string | null {
	const match = dataUri.match(/^data:(.*?);/)
	return match ? match[1] : null
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
