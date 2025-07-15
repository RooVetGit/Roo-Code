/**
 * Types and interfaces for Silent Mode functionality
 */

export interface FileOperation {
	type: "create" | "modify" | "delete"
	filePath: string
	content?: string
	originalContent?: string
}

export interface SilentResult {
	success: boolean
	filePath: string
	buffered: boolean
	message?: string
	error?: string
}

export interface FileChange {
	filePath: string
	operation: "create" | "modify" | "delete"
	originalContent?: string
	newContent?: string
	diff?: string
	timestamp: number
}

export interface ChangeSummary {
	filesChanged: number
	linesAdded: number
	linesRemoved: number
	changes: FileChange[]
}

export interface DiffSummary {
	filesChanged: number
	linesAdded: number
	linesRemoved: number
	changes: FileChange[]
}

export interface FileChangeSet {
	filePath: string
	changes: FileChange[]
	currentContent: string
	originalContent: string

	addChange(change: FileChange): void
	generateDiff(): string
	canApply(): boolean
}

export interface BufferedFileChange {
	originalContent: string
	newContent: string
	filePath: string
	editType: "create" | "modify"
	timestamp: number
}

export interface BufferResult {
	success: boolean
	error?: string
}

export interface FlushResult {
	success: string[]
	failed: Array<{ filePath: string; error: any }>
}

export interface FileBuffer {
	content: string
	filePath: string
	taskId: string
	operations: FileOperation[]

	applyOperation(operation: FileOperation): Promise<BufferResult>
	flush(): Promise<void>
	size(): number
}

export interface SilentModeSettings {
	silentMode: boolean
	maxBufferSize?: number
	maxBufferedFiles?: number
	autoShowReview?: boolean
	playSound?: boolean
	showDesktopNotification?: boolean
}

export interface ReviewResult {
	approved: FileChange[]
	rejected: FileChange[]
	cancelled: boolean
}
