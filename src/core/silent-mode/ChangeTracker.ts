import type { FileChange, ChangeSummary, FileChangeSet } from "./types"

/**
 * Tracks and manages file changes during silent mode operations
 */
export class ChangeTracker {
	private changes = new Map<string, FileChangeSet>()
	private taskChanges = new Map<string, string[]>() // taskId -> fileIds

	/**
	 * Records a file change during silent mode
	 */
	public trackChange(taskId: string, change: FileChange): void {
		const changeSet = this.getOrCreateChangeSet(change.filePath)
		changeSet.addChange(change)

		this.addToTaskChanges(taskId, change.filePath)
	}

	/**
	 * Gets all changes for a specific task
	 */
	public getChangesForTask(taskId: string): FileChange[] {
		const filePaths = this.taskChanges.get(taskId) || []
		return filePaths.flatMap((path) => this.getChangesForFile(path))
	}

	/**
	 * Checks if there are any changes for a specific task
	 */
	public hasChanges(taskId: string): boolean {
		const filePaths = this.taskChanges.get(taskId) || []
		return filePaths.length > 0
	}

	/**
	 * Gets changes for a specific file
	 */
	public getChangesForFile(filePath: string): FileChange[] {
		const changeSet = this.changes.get(filePath)
		return changeSet ? changeSet.changes : []
	}

	/**
	 * Generates a summary of changes for review
	 */
	public generateSummary(taskId: string): ChangeSummary {
		const changes = this.getChangesForTask(taskId)

		const linesAdded = changes.reduce((total, change) => {
			if (change.newContent && change.originalContent) {
				const addedLines = change.newContent.split("\n").length - change.originalContent.split("\n").length
				return total + Math.max(0, addedLines)
			} else if (change.newContent && change.operation === "create") {
				return total + change.newContent.split("\n").length
			}
			return total
		}, 0)

		const linesRemoved = changes.reduce((total, change) => {
			if (change.newContent && change.originalContent) {
				const removedLines = change.originalContent.split("\n").length - change.newContent.split("\n").length
				return total + Math.max(0, removedLines)
			} else if (change.originalContent && change.operation === "delete") {
				return total + change.originalContent.split("\n").length
			}
			return total
		}, 0)

		return {
			filesChanged: new Set(changes.map((c) => c.filePath)).size,
			linesAdded,
			linesRemoved,
			changes: changes,
		}
	}

	/**
	 * Clears all changes for a specific task
	 */
	public clearChangesForTask(taskId: string): void {
		const filePaths = this.taskChanges.get(taskId) || []

		// Remove file changes
		filePaths.forEach((filePath) => {
			this.changes.delete(filePath)
		})

		// Remove task mapping
		this.taskChanges.delete(taskId)
	}

	/**
	 * Gets or creates a change set for a file
	 */
	private getOrCreateChangeSet(filePath: string): FileChangeSet {
		let changeSet = this.changes.get(filePath)
		if (!changeSet) {
			changeSet = new FileChangeSetImpl(filePath)
			this.changes.set(filePath, changeSet)
		}
		return changeSet
	}

	/**
	 * Adds a file to the task changes mapping
	 */
	private addToTaskChanges(taskId: string, filePath: string): void {
		const filePaths = this.taskChanges.get(taskId) || []
		if (!filePaths.includes(filePath)) {
			filePaths.push(filePath)
			this.taskChanges.set(taskId, filePaths)
		}
	}
}

/**
 * Implementation of FileChangeSet
 */
class FileChangeSetImpl implements FileChangeSet {
	public changes: FileChange[] = []
	public currentContent: string = ""
	public originalContent: string = ""

	constructor(public filePath: string) {}

	public addChange(change: FileChange): void {
		this.changes.push(change)
		if (change.newContent !== undefined) {
			this.currentContent = change.newContent
		}
		if (change.originalContent !== undefined && this.originalContent === "") {
			this.originalContent = change.originalContent
		}
	}

	public generateDiff(): string {
		if (!this.originalContent || !this.currentContent) {
			return "No diff available"
		}

		// Simple diff implementation - could be enhanced with a proper diff library
		const originalLines = this.originalContent.split("\n")
		const currentLines = this.currentContent.split("\n")

		let diff = `--- a/${this.filePath}\n+++ b/${this.filePath}\n`

		// Basic line-by-line diff
		const maxLines = Math.max(originalLines.length, currentLines.length)
		for (let i = 0; i < maxLines; i++) {
			const originalLine = originalLines[i] || ""
			const currentLine = currentLines[i] || ""

			if (originalLine !== currentLine) {
				if (originalLine) diff += `-${originalLine}\n`
				if (currentLine) diff += `+${currentLine}\n`
			}
		}

		return diff
	}

	public canApply(): boolean {
		return this.changes.length > 0 && this.currentContent !== undefined
	}
}
