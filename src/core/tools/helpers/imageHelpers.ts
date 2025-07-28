import path from "path"
import * as fs from "fs/promises"

/**
 * Default maximum allowed image file size in bytes (5MB)
 */
export const DEFAULT_MAX_IMAGE_FILE_SIZE_MB = 5

/**
 * Default maximum total memory usage for all images in a single read operation (20MB)
 * This is a cumulative limit - as each image is processed, its size is added to the total.
 * If including another image would exceed this limit, it will be skipped with a notice.
 * Example: With a 20MB limit, reading 3 images of 8MB, 7MB, and 10MB would process
 * the first two (15MB total) but skip the third to stay under the limit.
 */
export const DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB = 20

/**
 * Supported image formats that can be displayed
 */
export const SUPPORTED_IMAGE_FORMATS = [
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
	".bmp",
	".ico",
	".tiff",
	".tif",
	".avif",
] as const

export const IMAGE_MIME_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".bmp": "image/bmp",
	".ico": "image/x-icon",
	".tiff": "image/tiff",
	".tif": "image/tiff",
	".avif": "image/avif",
}

/**
 * Reads an image file and returns both the data URL and buffer
 */
export async function readImageAsDataUrlWithBuffer(filePath: string): Promise<{ dataUrl: string; buffer: Buffer }> {
	const fileBuffer = await fs.readFile(filePath)
	const base64 = fileBuffer.toString("base64")
	const ext = path.extname(filePath).toLowerCase()

	const mimeType = IMAGE_MIME_TYPES[ext] || "image/png"
	const dataUrl = `data:${mimeType};base64,${base64}`

	return { dataUrl, buffer: fileBuffer }
}

/**
 * Checks if a file extension is a supported image format
 */
export function isSupportedImageFormat(extension: string): boolean {
	return SUPPORTED_IMAGE_FORMATS.includes(extension.toLowerCase() as (typeof SUPPORTED_IMAGE_FORMATS)[number])
}
