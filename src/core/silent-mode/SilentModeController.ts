import type { Task } from "../task/Task"
import type { FileOperation, SilentResult, FileChange, ChangeSummary, SilentModeSettings, ReviewResult } from "./types"
import { SilentModeDetector } from "./SilentModeDetector"
import { ChangeTracker } from "./ChangeTracker"
import { BufferManager } from "./BufferManager"
import { NotificationService } from "./NotificationService"

/**
 * Main controller that orchestrates silent mode operations
 *
 * This class is responsible for:
 * - Determining when operations should run in silent mode
 * - Coordinating between different silent mode components
 * - Managing the lifecycle of silent mode operations
 * - Providing the interface for task completion and review
 */
export class SilentModeController {
	private detector: SilentModeDetector
	private changeTracker: ChangeTracker
	private bufferManager: BufferManager
	private notificationService: NotificationService
	private isActive: boolean = false

	constructor(
		private task: Task,
		private settings: SilentModeSettings,
		private postMessageToWebview?: (message: any) => Promise<void>,
	) {
		this.detector = new SilentModeDetector()
		this.changeTracker = new ChangeTracker()
		this.bufferManager = new BufferManager()
		this.notificationService = new NotificationService(this.postMessageToWebview)
	}

	/**
	 * Determines if an operation should run in silent mode
	 *
	 * @param operation - The file operation to check
	 * @returns true if the operation should be executed silently
	 */
	public shouldOperateInSilentMode(operation: FileOperation): boolean {
		// Check if silent mode is globally enabled
		if (!this.settings.silentMode) {
			return false
		}

		// Use the detector to determine if the specific file should be handled silently
		return this.detector.shouldActivateSilentMode(operation.filePath, this.settings.silentMode)
	}

	/**
	 * Executes a file operation in silent mode
	 *
	 * @param operation - The file operation to execute
	 * @returns Result of the silent operation
	 */
	public async executeInSilentMode(operation: FileOperation): Promise<SilentResult> {
		try {
			this.isActive = true

			// Buffer the operation instead of executing it immediately
			const result = await this.bufferManager.bufferFileOperation(operation.filePath, operation)

			// Track the change for later review
			const change: FileChange = {
				filePath: operation.filePath,
				operation: operation.type as "create" | "modify" | "delete",
				originalContent: operation.originalContent,
				newContent: operation.content,
				timestamp: Date.now(),
			}

			this.changeTracker.trackChange(this.task.taskId, change)

			return {
				success: result.success,
				filePath: operation.filePath,
				buffered: true,
				message: result.success ? "Operation buffered for review" : result.error,
			}
		} catch (error) {
			return {
				success: false,
				filePath: operation.filePath,
				buffered: false,
				message: error instanceof Error ? error.message : "Unknown error occurred",
			}
		}
	}

	/**
	 * Shows completion notification and diff review interface
	 *
	 * @returns Result of the review process
	 */
	public async showCompletionReview(): Promise<ReviewResult> {
		if (!this.isActive || !this.changeTracker.hasChanges(this.task.taskId)) {
			return { approved: [], rejected: [], cancelled: false }
		}

		const changes = this.changeTracker.getChangesForTask(this.task.taskId)
		const summary = this.changeTracker.generateSummary(this.task.taskId)

		// Show notification to the user
		await this.notificationService.showTaskCompletion(summary)

		// The actual review interface will be handled by the webview components
		// This method prepares the data and triggers the review process
		return new Promise((resolve) => {
			// This will be implemented to communicate with the webview
			// For now, return a placeholder
			resolve({ approved: [], rejected: [], cancelled: false })
		})
	}

	/**
	 * Applies approved changes to the file system
	 *
	 * @param approvedChanges - Array of file changes that have been approved
	 */
	public async applyChanges(approvedChanges: FileChange[]): Promise<void> {
		const filePaths = approvedChanges.map((change) => change.filePath)

		try {
			// Apply the buffered changes to the actual file system
			const result = await this.bufferManager.flushBuffers(filePaths)

			if (result.failed.length > 0) {
				console.warn("Some changes failed to apply:", result.failed)
			}

			// Clean up the tracking data for applied changes
			this.changeTracker.clearChangesForTask(this.task.taskId)
			this.bufferManager.cleanup(this.task.taskId)

			this.isActive = false
		} catch (error) {
			console.error("Failed to apply changes:", error)
			throw error
		}
	}

	/**
	 * Checks if silent mode is currently active
	 */
	public get active(): boolean {
		return this.isActive
	}

	/**
	 * Gets the current change summary for the task
	 */
	public getCurrentSummary(): ChangeSummary | null {
		if (!this.changeTracker.hasChanges(this.task.taskId)) {
			return null
		}
		return this.changeTracker.generateSummary(this.task.taskId)
	}

	/**
	 * Cancels silent mode and discards all buffered changes
	 */
	public cancel(): void {
		this.changeTracker.clearChangesForTask(this.task.taskId)
		this.bufferManager.cleanup(this.task.taskId)
		this.isActive = false
	}
}
