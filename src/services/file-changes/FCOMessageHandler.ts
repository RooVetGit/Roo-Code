import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { WebviewMessage } from "../../shared/WebviewMessage"
import type { FileChangeType } from "@roo-code/types"
import { FileChangeManager } from "./FileChangeManager"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { getCheckpointService } from "../../core/checkpoints"

/**
 * Handles FCO-specific webview messages that were previously scattered throughout ClineProvider
 */
export class FCOMessageHandler {
	constructor(private provider: ClineProvider) {}

	/**
	 * Check if a message should be handled by FCO
	 */
	public shouldHandleMessage(message: WebviewMessage): boolean {
		const fcoMessageTypes = [
			"webviewReady",
			"viewDiff",
			"acceptFileChange",
			"rejectFileChange",
			"acceptAllFileChanges",
			"rejectAllFileChanges",
			"filesChangedRequest",
			"filesChangedBaselineUpdate",
		]

		return fcoMessageTypes.includes(message.type)
	}

	/**
	 * Handle FCO-specific messages
	 */
	public async handleMessage(message: WebviewMessage): Promise<void> {
		const task = this.provider.getCurrentCline()

		switch (message.type) {
			case "webviewReady": {
				// Ensure FileChangeManager is initialized when webview is ready
				let fileChangeManager = this.provider.getFileChangeManager()
				if (!fileChangeManager) {
					fileChangeManager = await this.provider.ensureFileChangeManager()
				}
				if (fileChangeManager) {
					this.provider.postMessageToWebview({
						type: "filesChanged",
						filesChanged: fileChangeManager.getChanges(),
					})
				}
				break
			}

			case "viewDiff": {
				await this.handleViewDiff(message, task)
				break
			}

			case "acceptFileChange": {
				await this.handleAcceptFileChange(message)
				break
			}

			case "rejectFileChange": {
				await this.handleRejectFileChange(message)
				break
			}

			case "acceptAllFileChanges": {
				await this.handleAcceptAllFileChanges()
				break
			}

			case "rejectAllFileChanges": {
				await this.handleRejectAllFileChanges(message)
				break
			}

			case "filesChangedRequest": {
				await this.handleFilesChangedRequest(message, task)
				break
			}

			case "filesChangedBaselineUpdate": {
				await this.handleFilesChangedBaselineUpdate(message, task)
				break
			}
		}
	}

	private async handleViewDiff(message: WebviewMessage, task: any): Promise<void> {
		const diffFileChangeManager = this.provider.getFileChangeManager()
		if (message.uri && diffFileChangeManager && task?.checkpointService) {
			// Get the file change information
			const changeset = diffFileChangeManager.getChanges()
			const fileChange = changeset.files.find((f) => f.uri === message.uri)

			if (fileChange) {
				try {
					// Get the specific file content from both checkpoints
					const changes = await task.checkpointService.getDiff({
						from: fileChange.fromCheckpoint,
						to: fileChange.toCheckpoint,
					})

					// Find the specific file in the changes
					const fileChangeData = changes.find((change: any) => change.paths.relative === message.uri)

					if (fileChangeData) {
						await this.showFileDiff(message.uri, fileChangeData)
					} else {
						console.warn(`FCOMessageHandler: No file change data found for URI: ${message.uri}`)
						vscode.window.showInformationMessage(`No changes found for ${message.uri}`)
					}
				} catch (error) {
					console.error(`FCOMessageHandler: Failed to open diff for ${message.uri}:`, error)
					vscode.window.showErrorMessage(`Failed to open diff for ${message.uri}: ${error.message}`)
				}
			} else {
				console.warn(`FCOMessageHandler: File change not found in changeset for URI: ${message.uri}`)
				vscode.window.showInformationMessage(`File change not found for ${message.uri}`)
			}
		} else {
			console.warn(`FCOMessageHandler: Missing dependencies for viewDiff. URI: ${message.uri}`)
			vscode.window.showErrorMessage("Unable to view diff - missing required dependencies")
		}
	}

	private async showFileDiff(uri: string, fileChangeData: any): Promise<void> {
		const beforeContent = fileChangeData.content.before || ""
		const afterContent = fileChangeData.content.after || ""

		// Create temporary files for the diff view
		const tempDir = require("os").tmpdir()
		const path = require("path")
		const fs = require("fs/promises")

		const fileName = path.basename(uri)
		const beforeTempPath = path.join(tempDir, `${fileName}.before.tmp`)
		const afterTempPath = path.join(tempDir, `${fileName}.after.tmp`)

		try {
			// Write temporary files
			await fs.writeFile(beforeTempPath, beforeContent, "utf8")
			await fs.writeFile(afterTempPath, afterContent, "utf8")

			// Create URIs for the temporary files
			const beforeUri = vscode.Uri.file(beforeTempPath)
			const afterUri = vscode.Uri.file(afterTempPath)

			// Open the diff view for this specific file
			await vscode.commands.executeCommand("vscode.diff", beforeUri, afterUri, `${uri}: Before ↔ After`, {
				preview: false,
			})

			// Clean up temporary files after a delay
			setTimeout(async () => {
				try {
					await fs.unlink(beforeTempPath)
					await fs.unlink(afterTempPath)
				} catch (cleanupError) {
					console.warn(`Failed to clean up temp files: ${cleanupError.message}`)
				}
			}, 30000) // Clean up after 30 seconds
		} catch (fileError) {
			console.error(`Failed to create temporary files: ${fileError.message}`)
			vscode.window.showErrorMessage(`Failed to create diff view: ${fileError.message}`)
		}
	}

	private async handleAcceptFileChange(message: WebviewMessage): Promise<void> {
		let acceptFileChangeManager = this.provider.getFileChangeManager()
		if (!acceptFileChangeManager) {
			acceptFileChangeManager = await this.provider.ensureFileChangeManager()
		}
		if (message.uri && acceptFileChangeManager) {
			await acceptFileChangeManager.acceptChange(message.uri)

			// Send updated state
			const updatedChangeset = acceptFileChangeManager.getChanges()
			this.provider.postMessageToWebview({
				type: "filesChanged",
				filesChanged: updatedChangeset.files.length > 0 ? updatedChangeset : undefined,
			})
		}
	}

	private async handleRejectFileChange(message: WebviewMessage): Promise<void> {
		console.log(`[FCO] handleRejectFileChange called for URI: ${message.uri}`)
		let rejectFileChangeManager = this.provider.getFileChangeManager()
		if (!rejectFileChangeManager) {
			rejectFileChangeManager = await this.provider.ensureFileChangeManager()
		}
		if (!message.uri || !rejectFileChangeManager) {
			return
		}

		try {
			// Get the file change details to know which checkpoint to restore from
			const fileChange = rejectFileChangeManager.getFileChange(message.uri)
			if (!fileChange) {
				console.error(`[FCO] File change not found for URI: ${message.uri}`)
				return
			}

			// Get the current task and checkpoint service
			const currentTask = this.provider.getCurrentCline()
			if (!currentTask) {
				console.error(`[FCO] No current task found for file reversion`)
				return
			}

			const checkpointService = getCheckpointService(currentTask)
			if (!checkpointService) {
				console.error(`[FCO] No checkpoint service available for file reversion`)
				return
			}

			// Revert the file to its previous state
			await this.revertFileToCheckpoint(message.uri, fileChange.fromCheckpoint, checkpointService)
			console.log(`[FCO] File ${message.uri} successfully reverted`)

			// Remove from tracking since the file has been reverted
			await rejectFileChangeManager.rejectChange(message.uri)

			// Send updated state
			const updatedChangeset = rejectFileChangeManager.getChanges()
			console.log(`[FCO] After rejection, sending ${updatedChangeset.files.length} files to webview`)
			this.provider.postMessageToWebview({
				type: "filesChanged",
				filesChanged: updatedChangeset.files.length > 0 ? updatedChangeset : undefined,
			})
		} catch (error) {
			console.error(`[FCO] Error reverting file ${message.uri}:`, error)
			// Fall back to old behavior (just remove from display) if reversion fails
			await rejectFileChangeManager.rejectChange(message.uri)

			const updatedChangeset = rejectFileChangeManager.getChanges()
			this.provider.postMessageToWebview({
				type: "filesChanged",
				filesChanged: updatedChangeset.files.length > 0 ? updatedChangeset : undefined,
			})
		}
	}

	private async handleAcceptAllFileChanges(): Promise<void> {
		let acceptAllFileChangeManager = this.provider.getFileChangeManager()
		if (!acceptAllFileChangeManager) {
			acceptAllFileChangeManager = await this.provider.ensureFileChangeManager()
		}
		await acceptAllFileChangeManager?.acceptAll()

		// Clear state
		this.provider.postMessageToWebview({
			type: "filesChanged",
			filesChanged: undefined,
		})
	}

	private async handleRejectAllFileChanges(message: WebviewMessage): Promise<void> {
		let rejectAllFileChangeManager = this.provider.getFileChangeManager()
		if (!rejectAllFileChangeManager) {
			rejectAllFileChangeManager = await this.provider.ensureFileChangeManager()
		}
		if (!rejectAllFileChangeManager) {
			return
		}

		try {
			// Get all current file changes
			const changeset = rejectAllFileChangeManager.getChanges()

			// Filter files if specific URIs provided, otherwise use all files
			const filesToReject = message.uris
				? changeset.files.filter((file) => message.uris!.includes(file.uri))
				: changeset.files

			// Get the current task and checkpoint service
			const currentTask = this.provider.getCurrentCline()
			if (!currentTask) {
				console.error(`[FCO] No current task found for file reversion`)
				return
			}

			const checkpointService = getCheckpointService(currentTask)
			if (!checkpointService) {
				console.error(`[FCO] No checkpoint service available for file reversion`)
				return
			}

			// Revert filtered files to their previous states
			for (const fileChange of filesToReject) {
				try {
					await this.revertFileToCheckpoint(fileChange.uri, fileChange.fromCheckpoint, checkpointService)
				} catch (error) {
					console.error(`[FCO] Failed to revert file ${fileChange.uri}:`, error)
					// Continue with other files even if one fails
				}
			}

			// Clear all tracking after reverting files
			await rejectAllFileChangeManager.rejectAll()

			// Clear state
			this.provider.postMessageToWebview({
				type: "filesChanged",
				filesChanged: undefined,
			})
		} catch (error) {
			console.error(`[FCO] Error reverting all files:`, error)
			// Fall back to old behavior if reversion fails
			await rejectAllFileChangeManager.rejectAll()
			this.provider.postMessageToWebview({
				type: "filesChanged",
				filesChanged: undefined,
			})
		}
	}

	private async handleFilesChangedRequest(message: WebviewMessage, task: any): Promise<void> {
		try {
			let fileChangeManager = this.provider.getFileChangeManager()
			if (!fileChangeManager) {
				fileChangeManager = await this.provider.ensureFileChangeManager()
			}

			if (fileChangeManager && task?.checkpointService) {
				const changeset = fileChangeManager.getChanges()

				// Handle message file changes if provided
				if (message.fileChanges) {
					const fileChanges = message.fileChanges.map((fc: any) => ({
						uri: fc.uri,
						type: fc.type,
						fromCheckpoint: task.checkpointService?.baseHash || "base",
						toCheckpoint: "current",
					}))

					fileChangeManager.setFiles(fileChanges)
				}

				// Get filtered changeset and send to webview
				const filteredChangeset = fileChangeManager.getChanges()
				this.provider.postMessageToWebview({
					type: "filesChanged",
					filesChanged: filteredChangeset.files.length > 0 ? filteredChangeset : undefined,
				})
			} else {
				this.provider.postMessageToWebview({
					type: "filesChanged",
					filesChanged: undefined,
				})
			}
		} catch (error) {
			console.error("FCOMessageHandler: Error handling filesChangedRequest:", error)
			// Send empty response to prevent FCO from hanging
			this.provider.postMessageToWebview({
				type: "filesChanged",
				filesChanged: undefined,
			})
		}
	}

	private async handleFilesChangedBaselineUpdate(message: WebviewMessage, task: any): Promise<void> {
		try {
			let fileChangeManager = this.provider.getFileChangeManager()
			if (!fileChangeManager) {
				fileChangeManager = await this.provider.ensureFileChangeManager()
			}

			if (fileChangeManager && task && message.baseline) {
				// Update baseline to the specified checkpoint
				await fileChangeManager.updateBaseline(message.baseline)

				// Send updated state
				const updatedChangeset = fileChangeManager.getChanges()
				this.provider.postMessageToWebview({
					type: "filesChanged",
					filesChanged: updatedChangeset.files.length > 0 ? updatedChangeset : undefined,
				})
			} else {
				this.provider.postMessageToWebview({
					type: "filesChanged",
					filesChanged: undefined,
				})
			}
		} catch (error) {
			console.error("FCOMessageHandler: Failed to update baseline:", error)
			this.provider.postMessageToWebview({
				type: "filesChanged",
				filesChanged: undefined,
			})
		}
	}

	/**
	 * Revert a specific file to its content at a specific checkpoint
	 */
	private async revertFileToCheckpoint(
		relativeFilePath: string,
		fromCheckpoint: string,
		checkpointService: any,
	): Promise<void> {
		try {
			// Get the workspace path
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
			if (!workspaceFolder) {
				throw new Error("No workspace folder found")
			}

			const absoluteFilePath = path.join(workspaceFolder.uri.fsPath, relativeFilePath)

			// Get the file content from the checkpoint
			if (!checkpointService.getContent) {
				throw new Error("Checkpoint service does not support getContent method")
			}

			let previousContent: string | null = null
			try {
				previousContent = await checkpointService.getContent(fromCheckpoint, absoluteFilePath)
			} catch (error) {
				// If file doesn't exist in checkpoint, it's a newly created file
				const errorMessage = error instanceof Error ? error.message : String(error)
				if (errorMessage.includes("exists on disk, but not in") || errorMessage.includes("does not exist")) {
					console.log(
						`[FCO] File ${relativeFilePath} didn't exist in checkpoint ${fromCheckpoint}, treating as new file`,
					)
					previousContent = null
				} else {
					throw error
				}
			}

			// Check if the file was newly created (didn't exist in the fromCheckpoint)
			if (!previousContent) {
				// File was newly created, so delete it
				console.log(`[FCO] Deleting newly created file: ${relativeFilePath}`)
				try {
					await fs.unlink(absoluteFilePath)
				} catch (error) {
					if ((error as any).code !== "ENOENT") {
						throw error
					}
					// File already doesn't exist, that's fine
				}
			} else {
				// File existed before, restore its previous content
				console.log(`[FCO] Restoring file content: ${relativeFilePath}`)
				await fs.writeFile(absoluteFilePath, previousContent, "utf8")
			}
		} catch (error) {
			console.error(`[FCO] Failed to revert file ${relativeFilePath}:`, error)
			throw error
		}
	}
}
