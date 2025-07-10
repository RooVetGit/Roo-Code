/**
 * Type definitions for file attachments
 */

/**
 * Represents a file attachment with its content
 */
export interface FileAttachment {
	/** File name or path */
	path: string
	/** File content as string */
	content: string
	/** File type/extension without dot */
	type: string
}

/**
 * Represents a file reference for memory-efficient handling
 */
export interface FileReference {
	/** File name or path */
	path: string
	/** VSCode URI for the file */
	uri: string
	/** File size in bytes */
	size: number
	/** MIME type of the file */
	mimeType: string
}

/**
 * Result of file selection/processing
 */
export interface ProcessedFiles {
	/** Image file references */
	images: FileReference[]
	/** Text file attachments with content */
	files: FileAttachment[]
}
