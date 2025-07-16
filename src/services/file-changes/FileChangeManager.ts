import { FileChange, FileChangeset } from "@roo-code/types"
import type { FileContextTracker } from "../../core/context-tracking/FileContextTracker"

/**
 * Simplified FileChangeManager - Pure diff calculation service
 * No complex persistence, events, or tool integration
 */
export class FileChangeManager {
	private changeset: FileChangeset
	private acceptedFiles: Set<string>
	private rejectedFiles: Set<string>

	constructor(baseCheckpoint: string) {
		this.changeset = {
			baseCheckpoint,
			files: [],
		}
		this.acceptedFiles = new Set()
		this.rejectedFiles = new Set()
	}

	/**
	 * Get current changeset with accepted/rejected files filtered out
	 */
	public getChanges(): FileChangeset {
		const filteredFiles = this.changeset.files.filter(
			(file) => !this.acceptedFiles.has(file.uri) && !this.rejectedFiles.has(file.uri),
		)

		return {
			...this.changeset,
			files: filteredFiles,
		}
	}

	/**
	 * Get changeset filtered to only show LLM-modified files
	 */
	public async getLLMOnlyChanges(taskId: string, fileContextTracker: FileContextTracker): Promise<FileChangeset> {
		// Get task metadata to determine which files were modified by LLM
		const taskMetadata = await fileContextTracker.getTaskMetadata(taskId)

		// Get files that were modified by LLM (record_source: "roo_edited")
		const llmModifiedFiles = new Set(
			taskMetadata.files_in_context
				.filter((entry) => entry.record_source === "roo_edited")
				.map((entry) => entry.path),
		)

		// Filter changeset to only include LLM-modified files
		const filteredFiles = this.changeset.files.filter(
			(file) =>
				llmModifiedFiles.has(file.uri) &&
				!this.acceptedFiles.has(file.uri) &&
				!this.rejectedFiles.has(file.uri),
		)

		return {
			...this.changeset,
			files: filteredFiles,
		}
	}

	/**
	 * Get a specific file change
	 */
	public getFileChange(uri: string): FileChange | undefined {
		return this.changeset.files.find((file) => file.uri === uri)
	}

	/**
	 * Accept a specific file change
	 */
	public async acceptChange(uri: string): Promise<void> {
		this.acceptedFiles.add(uri)
		this.rejectedFiles.delete(uri)
	}

	/**
	 * Reject a specific file change
	 */
	public async rejectChange(uri: string): Promise<void> {
		this.rejectedFiles.add(uri)
		this.acceptedFiles.delete(uri)
	}

	/**
	 * Accept all file changes
	 */
	public async acceptAll(): Promise<void> {
		this.changeset.files.forEach((file) => {
			this.acceptedFiles.add(file.uri)
		})
		this.rejectedFiles.clear()
	}

	/**
	 * Reject all file changes
	 */
	public async rejectAll(): Promise<void> {
		this.changeset.files.forEach((file) => {
			this.rejectedFiles.add(file.uri)
		})
		this.acceptedFiles.clear()
	}

	/**
	 * Update the baseline checkpoint and recalculate changes
	 */
	public async updateBaseline(
		newBaselineCheckpoint: string,
		_getDiff?: (from: string, to: string) => Promise<{ filePath: string; content: string }[]>,
		_checkpointService?: {
			checkpoints: string[]
			baseHash?: string
		},
	): Promise<void> {
		this.changeset.baseCheckpoint = newBaselineCheckpoint

		// Simple approach: request fresh calculation from backend
		// The actual diff calculation should be handled by the checkpoint service
		this.changeset.files = []

		// Clear accepted/rejected state - baseline change means we're starting fresh
		// This happens during checkpoint restore (time travel) where we want a clean slate
		this.acceptedFiles.clear()
		this.rejectedFiles.clear()
	}

	/**
	 * Set the files for the changeset (called by backend when files change)
	 * Preserves existing accept/reject state for files with the same URI
	 */
	public setFiles(files: FileChange[]): void {
		this.changeset.files = files
	}

	/**
	 * Clear accepted/rejected state (called when new checkpoint created)
	 */
	public clearAcceptedRejectedState(): void {
		this.acceptedFiles.clear()
		this.rejectedFiles.clear()
	}

	/**
	 * Calculate line differences between two file contents
	 * Uses a simple line-by-line comparison to count actual changes
	 */
	public static calculateLineDifferences(
		originalContent: string,
		newContent: string,
	): { linesAdded: number; linesRemoved: number } {
		const originalLines = originalContent === "" ? [] : originalContent.split("\n")
		const newLines = newContent === "" ? [] : newContent.split("\n")

		// For proper diff calculation, we need to compare line by line
		// This is a simplified approach that works well for most cases

		const maxLines = Math.max(originalLines.length, newLines.length)
		let linesAdded = 0
		let linesRemoved = 0

		// Compare each line position
		for (let i = 0; i < maxLines; i++) {
			const originalLine = i < originalLines.length ? originalLines[i] : undefined
			const newLine = i < newLines.length ? newLines[i] : undefined

			if (originalLine === undefined && newLine !== undefined) {
				// Line was added
				linesAdded++
			} else if (originalLine !== undefined && newLine === undefined) {
				// Line was removed
				linesRemoved++
			} else if (originalLine !== newLine) {
				// Line was modified (count as both removed and added)
				linesRemoved++
				linesAdded++
			}
			// If lines are identical, no change
		}

		return { linesAdded, linesRemoved }
	}

	/**
	 * Dispose of the manager (for compatibility)
	 */
	public dispose(): void {
		this.changeset.files = []
		this.acceptedFiles.clear()
		this.rejectedFiles.clear()
	}
}

// Export the error types for backward compatibility
export enum FileChangeErrorType {
	PERSISTENCE_FAILED = "PERSISTENCE_FAILED",
	FILE_NOT_FOUND = "FILE_NOT_FOUND",
	PERMISSION_DENIED = "PERMISSION_DENIED",
	DISK_FULL = "DISK_FULL",
	GENERIC_ERROR = "GENERIC_ERROR",
}

export class FileChangeError extends Error {
	constructor(
		public type: FileChangeErrorType,
		public uri?: string,
		message?: string,
		public originalError?: Error,
	) {
		super(message || originalError?.message || "File change operation failed")
		this.name = "FileChangeError"
	}
}
