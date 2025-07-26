/**
 * Configuration for accepted media file types by model
 */

export interface MediaConfig {
	images: string[]
	videos: string[]
}

// Base image formats supported by most models
export const BASE_IMAGE_FORMATS = ["png", "jpeg", "webp", "heic", "heif"]

// Video formats supported by Gemini models
export const VIDEO_FORMATS = ["mp4", "mov", "avi", "wmv", "flv", "webm"]

// Configuration for different model types
export const MEDIA_CONFIG: Record<string, MediaConfig> = {
	// Gemini Pro and Flash models support both images and videos
	gemini_full: {
		images: BASE_IMAGE_FORMATS,
		videos: VIDEO_FORMATS,
	},
	// Default configuration for models that only support images
	default: {
		images: BASE_IMAGE_FORMATS,
		videos: [],
	},
	// Configuration for models that don't support any media
	none: {
		images: [],
		videos: [],
	},
}

/**
 * Get accepted file types for a given model
 * @param modelId - The model ID
 * @param supportsImages - Whether the model supports images
 * @returns Array of accepted file extensions
 */
export function getAcceptedFileTypes(modelId: string | undefined, supportsImages: boolean | undefined): string[] {
	if (!supportsImages) {
		return []
	}

	// Check if it's a Gemini model that supports video
	const isGeminiWithVideo =
		modelId?.includes("gemini-2.5-pro") ||
		modelId?.includes("gemini-1.5-flash") ||
		modelId?.includes("gemini-2.0-flash-001") ||
		modelId?.includes("gemini-2.5-flash-preview-05-20") ||
		modelId?.includes("gemini-2.5-flash") ||
		modelId?.includes("gemini-2.0-flash-lite-preview-02-05") ||
		modelId?.includes("gemini-2.0-flash-thinking-exp-01-21") ||
		modelId?.includes("gemini-2.0-flash-thinking-exp-1219") ||
		modelId?.includes("gemini-2.0-flash-exp") ||
		modelId?.includes("gemini-2.5-flash-lite-preview-06-17")

	if (isGeminiWithVideo) {
		const config = MEDIA_CONFIG.gemini_full
		return [...config.images, ...config.videos]
	}

	// Default to image-only support
	return MEDIA_CONFIG.default.images
}

/**
 * Check if a file type is an image
 * @param fileType - The file extension (without dot)
 * @returns true if the file type is an image
 */
export function isImageFileType(fileType: string): boolean {
	return BASE_IMAGE_FORMATS.includes(fileType.toLowerCase())
}

/**
 * Check if a file type is a video
 * @param fileType - The file extension (without dot)
 * @returns true if the file type is a video
 */
export function isVideoFileType(fileType: string): boolean {
	return VIDEO_FORMATS.includes(fileType.toLowerCase())
}
