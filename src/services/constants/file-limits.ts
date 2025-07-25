/**
 * File size limits for various file types across Roo-Code services
 * These constants help prevent memory exhaustion and performance issues
 */

// General file size limit (1MB) - used for code files and general file operations
export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 // 1MB

// Configuration files should be smaller (100KB)
export const MAX_CONFIG_FILE_SIZE_BYTES = 100 * 1024 // 100KB

// .gitignore files should be even smaller (50KB)
export const MAX_GITIGNORE_FILE_SIZE_BYTES = 50 * 1024 // 50KB

// Checkpoint files can be larger but still need a reasonable limit (5MB)
export const MAX_CHECKPOINT_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Error class for file size limit violations
 */
export class FileSizeLimitError extends Error {
	constructor(filePath: string, size: number, limit: number) {
		const sizeInKB = Math.round(size / 1024)
		const limitInKB = Math.round(limit / 1024)
		super(`File ${filePath} exceeds size limit (${sizeInKB}KB > ${limitInKB}KB)`)
		this.name = "FileSizeLimitError"
	}
}
