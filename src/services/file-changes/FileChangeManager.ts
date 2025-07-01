import { FileChange, FileChangeset, FileChangeType } from "@roo-code/types"
import * as crypto from "crypto"
import * as fs from "fs/promises"
import * as path from "path"
import { EventEmitter } from "vscode"

// Error types for better error handling
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

// Callback interface for error notifications
export interface FileChangeErrorHandler {
	onError(error: FileChangeError): void
}

export class FileChangeManager {
	private readonly _onDidChange = new EventEmitter<void>()
	public readonly onDidChange = this._onDidChange.event

	private changeset: Omit<FileChangeset, "files"> & { files: Map<string, FileChange> }
	private taskId: string
	private globalStoragePath: string
	private readonly instanceId: string
	private persistenceInProgress = false
	private pendingPersistence = false
	private errorHandler?: FileChangeErrorHandler

	constructor(baseCheckpoint: string, taskId?: string, globalStoragePath?: string) {
		this.instanceId = crypto.randomUUID()
		this.changeset = {
			baseCheckpoint,
			files: new Map<string, FileChange>(),
		}
		this.taskId = taskId || ""
		this.globalStoragePath = globalStoragePath || ""

		console.log(`[DEBUG] FileChangeManager created for task ${this.taskId}. Instance ID: ${this.instanceId}`)

		// Load persisted changes if available
		if (this.taskId && this.globalStoragePath) {
			this.loadPersistedChanges().catch((error) => {
				const fileChangeError = this.createError(FileChangeErrorType.PERSISTENCE_FAILED, undefined, error)
				this.handleError(fileChangeError, false) // Don't notify user for initialization errors
			})
		}
	}

	/**
	 * Set error handler for user notifications
	 */
	public setErrorHandler(handler: FileChangeErrorHandler): void {
		this.errorHandler = handler
	}

	/**
	 * Create a FileChangeError from a generic error
	 */
	private createError(type: FileChangeErrorType, uri?: string, originalError?: Error): FileChangeError {
		let message = originalError?.message || ""

		// Categorize errors based on common patterns
		if (message.includes("ENOENT") || message.includes("no such file")) {
			type = FileChangeErrorType.FILE_NOT_FOUND
		} else if (message.includes("EACCES") || message.includes("permission denied")) {
			type = FileChangeErrorType.PERMISSION_DENIED
		} else if (message.includes("ENOSPC") || message.includes("no space left")) {
			type = FileChangeErrorType.DISK_FULL
		}

		return new FileChangeError(type, uri, message, originalError)
	}

	/**
	 * Handle errors with optional user notification
	 */
	private handleError(error: FileChangeError, notifyUser: boolean = true): void {
		// Always log to console for debugging
		console.warn(`FileChangeManager error (${error.type}):`, error.message, error.originalError)

		// Notify user if handler is set and notification is requested
		if (notifyUser && this.errorHandler) {
			this.errorHandler.onError(error)
		}
	}

	public recordChange(
		uri: string,
		type: FileChangeType,
		fromCheckpoint: string,
		toCheckpoint: string,
		linesAdded?: number,
		linesRemoved?: number,
	): void {
		console.log(
			`FileChangeManager: Recording change for URI: ${uri}, Type: ${type}, From: ${fromCheckpoint}, To: ${toCheckpoint}`,
		)
		const existingChange = this.changeset.files.get(uri)

		if (existingChange) {
			// If a file is created and then edited, it's still a 'create'
			// If it's deleted, all previous changes are moot.
			const newType = existingChange.type === "create" && type === "edit" ? "create" : type

			// Only update toCheckpoint if it's not "pending" or if the new one is not "pending"
			const newToCheckpoint = toCheckpoint === "pending" ? existingChange.toCheckpoint : toCheckpoint

			this.changeset.files.set(uri, {
				...existingChange,
				type: newType,
				toCheckpoint: newToCheckpoint,
				linesAdded:
					toCheckpoint === "pending"
						? existingChange.linesAdded
						: (existingChange.linesAdded || 0) + (linesAdded || 0),
				linesRemoved:
					toCheckpoint === "pending"
						? existingChange.linesRemoved
						: (existingChange.linesRemoved || 0) + (linesRemoved || 0),
			})
		} else {
			this.changeset.files.set(uri, {
				uri,
				type,
				fromCheckpoint,
				toCheckpoint,
				linesAdded,
				linesRemoved,
			})
		}

		// Always persist changes after recording (for both new and updated changes)
		this.persistChanges().catch((error) => {
			const fileChangeError = this.createError(FileChangeErrorType.PERSISTENCE_FAILED, uri, error)
			this.handleError(fileChangeError, false) // Don't notify user for automatic persistence failures
		})

		this._onDidChange.fire()
	}

	public async acceptChange(uri: string): Promise<void> {
		// Store the original file change in case we need to restore it
		const originalChange = this.changeset.files.get(uri)
		if (!originalChange) {
			// Silently return if file is not tracked (already accepted/rejected)
			return
		}

		try {
			// Remove from tracking - the changes are already applied
			this.changeset.files.delete(uri)
			await this.persistChanges()
			this._onDidChange.fire()
		} catch (error) {
			// Re-add file to tracking if persistence failed
			this.changeset.files.set(uri, originalChange)
			const fileChangeError = this.createError(FileChangeErrorType.PERSISTENCE_FAILED, uri, error as Error)
			this.handleError(fileChangeError)
			throw fileChangeError
		}
	}

	public async rejectChange(uri: string): Promise<void> {
		// Store the original file change in case we need to restore it
		const originalChange = this.changeset.files.get(uri)
		if (!originalChange) {
			// Silently return if file is not tracked (already accepted/rejected)
			return
		}

		try {
			// Remove from tracking - the actual revert will be handled by the caller
			this.changeset.files.delete(uri)
			await this.persistChanges()
			this._onDidChange.fire()
		} catch (error) {
			// Re-add file to tracking if persistence failed
			this.changeset.files.set(uri, originalChange)
			const fileChangeError = this.createError(FileChangeErrorType.PERSISTENCE_FAILED, uri, error as Error)
			this.handleError(fileChangeError)
			throw fileChangeError
		}
	}

	public async acceptAll(): Promise<void> {
		// Store all file changes in case we need to restore them
		const originalChanges = new Map(this.changeset.files)

		try {
			// Accept all changes - they're already applied
			this.changeset.files.clear()
			await this.clearPersistedChanges()
			this._onDidChange.fire()
		} catch (error) {
			// Restore all changes if persistence failed
			this.changeset.files = originalChanges
			const fileChangeError = this.createError(FileChangeErrorType.PERSISTENCE_FAILED, undefined, error as Error)
			this.handleError(fileChangeError)
			throw fileChangeError
		}
	}

	public async rejectAll(): Promise<void> {
		// Store all file changes in case we need to restore them
		const originalChanges = new Map(this.changeset.files)

		try {
			// Remove all from tracking - the actual revert will be handled by the caller
			this.changeset.files.clear()
			await this.clearPersistedChanges()
			this._onDidChange.fire()
		} catch (error) {
			// Restore all changes if persistence failed
			this.changeset.files = originalChanges
			const fileChangeError = this.createError(FileChangeErrorType.PERSISTENCE_FAILED, undefined, error as Error)
			this.handleError(fileChangeError)
			throw fileChangeError
		}
	}

	public getFileChange(uri: string): FileChange | undefined {
		return this.changeset.files.get(uri)
	}

	public getChanges(): FileChangeset {
		return {
			...this.changeset,
			files: Array.from(this.changeset.files.values()),
		}
	}

	public async updateBaseline(
		newBaseCheckpoint: string,
		getDiff: (from: string, to: string) => Promise<any[]>,
	): Promise<void> {
		this.changeset.baseCheckpoint = newBaseCheckpoint

		for (const [uri, change] of this.changeset.files.entries()) {
			const diffs = await getDiff(newBaseCheckpoint, change.toCheckpoint)
			const fileDiff = diffs.find((d) => d.paths.relative === uri)

			if (fileDiff) {
				const lineDiff = FileChangeManager.calculateLineDifferences(
					fileDiff.content.before || "",
					fileDiff.content.after || "",
				)
				change.linesAdded = lineDiff.linesAdded
				change.linesRemoved = lineDiff.linesRemoved
			}
		}

		await this.persistChanges()
		this._onDidChange.fire()
	}

	/**
	 * Calculate line differences for a file change using simple line counting
	 */
	public static calculateLineDifferences(
		beforeContent: string,
		afterContent: string,
	): { linesAdded: number; linesRemoved: number } {
		const beforeLines = beforeContent.split("\n")
		const afterLines = afterContent.split("\n")

		// Simple approach: count total lines difference
		// For a more accurate diff, we'd need a proper diff algorithm
		const lineDiff = afterLines.length - beforeLines.length

		if (lineDiff > 0) {
			// More lines in after, so lines were added
			return { linesAdded: lineDiff, linesRemoved: 0 }
		} else if (lineDiff < 0) {
			// Fewer lines in after, so lines were removed
			return { linesAdded: 0, linesRemoved: Math.abs(lineDiff) }
		} else {
			// Same number of lines, but content might have changed
			// Count changed lines as both added and removed
			let changedLines = 0
			const minLength = Math.min(beforeLines.length, afterLines.length)

			for (let i = 0; i < minLength; i++) {
				if (beforeLines[i] !== afterLines[i]) {
					changedLines++
				}
			}

			return { linesAdded: changedLines, linesRemoved: changedLines }
		}
	}

	/**
	 * Get the file path for persisting file changes
	 */
	private getFileChangesFilePath(): string {
		if (!this.taskId || !this.globalStoragePath) {
			throw new Error("Task ID and global storage path required for persistence")
		}
		return path.join(this.globalStoragePath, "tasks", this.taskId, "file-changes.json")
	}

	/**
	 * Persist file changes to disk with race condition prevention
	 */
	private async persistChanges(): Promise<void> {
		if (!this.taskId || !this.globalStoragePath) {
			return // No persistence if not configured
		}

		// Prevent concurrent persistence operations
		if (this.persistenceInProgress) {
			this.pendingPersistence = true
			return
		}

		this.persistenceInProgress = true
		this.pendingPersistence = false

		try {
			const filePath = this.getFileChangesFilePath()
			const dir = path.dirname(filePath)

			// Ensure directory exists
			await fs.mkdir(dir, { recursive: true })

			// Convert Map to Array for serialization
			const serializableChangeset = {
				...this.changeset,
				files: Array.from(this.changeset.files.values()),
			}

			// Write atomically using a temporary file
			const tempFile = `${filePath}.tmp`
			await fs.writeFile(tempFile, JSON.stringify(serializableChangeset, null, 2), "utf8")
			await fs.rename(tempFile, filePath)
		} catch (error) {
			console.error(`Failed to persist file changes for task ${this.taskId}:`, error)
			throw error
		} finally {
			this.persistenceInProgress = false

			// Handle any pending persistence requests
			if (this.pendingPersistence) {
				setImmediate(() => this.persistChanges())
			}
		}
	}

	/**
	 * Load persisted file changes from disk
	 */
	private async loadPersistedChanges(): Promise<void> {
		if (!this.taskId || !this.globalStoragePath) {
			return // No persistence if not configured
		}

		try {
			const filePath = this.getFileChangesFilePath()

			// Check if file exists
			try {
				await fs.access(filePath)
			} catch {
				return // File doesn't exist, nothing to load
			}

			const content = await fs.readFile(filePath, "utf8")
			const persistedChangeset = JSON.parse(content)

			// Restore the changeset
			this.changeset.baseCheckpoint = persistedChangeset.baseCheckpoint
			this.changeset.files = new Map()

			// Convert Array back to Map
			if (persistedChangeset.files && Array.isArray(persistedChangeset.files)) {
				for (const fileChange of persistedChangeset.files) {
					this.changeset.files.set(fileChange.uri, fileChange)
				}
			}
		} catch (error) {
			console.error(`Failed to load persisted file changes for task ${this.taskId}:`, error)
		}
	}

	/**
	 * Clear persisted file changes from disk
	 */
	public async clearPersistedChanges(): Promise<void> {
		if (!this.taskId || !this.globalStoragePath) {
			return // No persistence if not configured
		}

		try {
			const filePath = this.getFileChangesFilePath()
			await fs.unlink(filePath)
		} catch (error) {
			// File might not exist, which is fine
			console.debug(`Could not delete persisted file changes for task ${this.taskId}:`, error.message)
		}
	}

	/**
	 * Get the count of files changed
	 */
	public getFileChangeCount(): number {
		return this.changeset.files.size
	}

	/**
	 * Dispose of the manager and clean up resources
	 */
	public dispose(): void {
		this._onDidChange.dispose()
	}
}
