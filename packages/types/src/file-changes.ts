export type FileChangeType = "create" | "delete" | "edit"

export interface FileChange {
	uri: string
	type: FileChangeType
	// Note: Checkpoint hashes are for backend use, but can be included
	fromCheckpoint: string
	toCheckpoint: string
	// Line count information for display
	linesAdded?: number
	linesRemoved?: number
}

/**
 * Represents the set of file changes for the webview.
 * The `files` property is an array for easy serialization.
 */
export interface FileChangeset {
	baseCheckpoint: string
	files: FileChange[]
}
