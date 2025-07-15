import * as vscode from "vscode"
import type { ChangeSummary } from "./types"

/**
 * Service for handling user notifications during silent mode operations
 */
export class NotificationService {
	constructor(private postMessageToWebview?: (message: any) => Promise<void>) {}

	/**
	 * Shows a task completion notification to the user
	 */
	public async showTaskCompletion(summary: ChangeSummary): Promise<void> {
		const filesChangedText = summary.filesChanged === 1 ? "file" : "files"
		const changesText = `${summary.linesAdded + summary.linesRemoved} changes`

		// Show VS Code notification with action buttons
		const action = await vscode.window.showInformationMessage(
			`🎉 Roo completed silently: ${summary.filesChanged} ${filesChangedText} modified with ${changesText}`,
			"Review Changes",
			"Apply All",
			"Dismiss",
		)

		// Handle user action
		if (action === "Review Changes") {
			// Send message to webview to show review interface
			await this.postMessageToWebview?.({
				type: "showSilentModeReview",
				summary: summary,
			})
		} else if (action === "Apply All") {
			// Send message to webview to apply all changes
			await this.postMessageToWebview?.({
				type: "applySilentModeChanges",
				applyAll: true,
				summary: summary,
			})
		}

		// Send notification to webview for UI updates
		await this.postMessageToWebview?.({
			type: "silentModeTaskCompleted",
			summary: summary,
		})

		// Play completion sound if enabled
		await this.postMessageToWebview?.({
			type: "playSilentModeCompletionSound",
		})
	}

	/**
	 * Shows a notification for when silent mode is activated
	 */
	public async showSilentModeActivated(): Promise<void> {
		// Show subtle VS Code notification
		vscode.window.setStatusBarMessage(
			"$(loading~spin) Roo is working silently...",
			5000, // Auto-hide after 5 seconds
		)

		// Send message to webview for UI updates
		await this.postMessageToWebview?.({
			type: "silentModeActivated",
		})
	}

	/**
	 * Shows a notification when silent mode is deactivated
	 */
	public async showSilentModeDeactivated(): Promise<void> {
		vscode.window.setStatusBarMessage("$(check) Silent Mode deactivated", 3000)

		await this.postMessageToWebview?.({
			type: "silentModeDeactivated",
		})
	}

	/**
	 * Shows an error notification
	 */
	public async showError(message: string): Promise<void> {
		vscode.window.showErrorMessage(`Silent Mode Error: ${message}`)

		await this.postMessageToWebview?.({
			type: "silentModeError",
			error: message,
		})
	}

	/**
	 * Shows a warning notification
	 */
	public async showWarning(message: string): Promise<void> {
		vscode.window.showWarningMessage(`Silent Mode Warning: ${message}`)

		await this.postMessageToWebview?.({
			type: "silentModeWarning",
			warning: message,
		})
	}

	/**
	 * Shows progress notification for long-running silent operations
	 */
	public async showProgress(message: string): Promise<void> {
		vscode.window.setStatusBarMessage(`$(loading~spin) ${message}`, 2000)

		await this.postMessageToWebview?.({
			type: "silentModeProgress",
			message: message,
		})
	}

	/**
	 * Shows notification when changes are ready for review
	 */
	public async showChangesReady(fileCount: number): Promise<void> {
		const filesText = fileCount === 1 ? "file" : "files"
		const action = await vscode.window.showInformationMessage(
			`🔍 Silent Mode changes ready: ${fileCount} ${filesText} to review`,
			"Review Now",
			"Later",
		)

		if (action === "Review Now") {
			await this.postMessageToWebview?.({
				type: "showSilentModeReview",
				fileCount: fileCount,
			})
		}
	}
}
