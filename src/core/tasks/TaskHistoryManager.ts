import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { Anthropic } from "@anthropic-ai/sdk"
import simpleGit from "simple-git"

import { SettingsManager } from "../settings/SettingsManager"
import { HistoryItem } from "../../shared/HistoryItem"
import { fileExistsAtPath } from "../../utils/fs"
import { downloadTask } from "../../integrations/misc/export-markdown"
import { logger } from "../../utils/logging"

/**
 * File names for task history files
 */
export const GlobalFileNames = {
	apiConversationHistory: "api_conversation_history.json",
	uiMessages: "ui_messages.json",
}

/**
 * TaskHistoryManager is responsible for managing task history, including
 * retrieving, updating, deleting, and exporting tasks.
 */
export class TaskHistoryManager {
	/**
	 * Creates a new instance of TaskHistoryManager
	 *
	 * @param context The extension context
	 * @param settingsManager The settings manager instance
	 * @param outputChannel Optional output channel for logging
	 */
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly settingsManager: SettingsManager,
		private readonly outputChannel?: vscode.OutputChannel,
	) {
		logger.debug("TaskHistoryManager initialized")
	}

	/**
	 * Gets a task with the specified ID
	 *
	 * @param id The ID of the task to get
	 * @returns The task information
	 * @throws Error if the task is not found
	 */
	async getTaskWithId(id: string): Promise<{
		historyItem: HistoryItem
		taskDirPath: string
		apiConversationHistoryFilePath: string
		uiMessagesFilePath: string
		apiConversationHistory: Anthropic.MessageParam[]
	}> {
		const history = ((await this.settingsManager.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const historyItem = history.find((item) => item.id === id)

		if (historyItem) {
			const taskDirPath = path.join(this.context.globalStorageUri.fsPath, "tasks", id)
			const apiConversationHistoryFilePath = path.join(taskDirPath, GlobalFileNames.apiConversationHistory)
			const uiMessagesFilePath = path.join(taskDirPath, GlobalFileNames.uiMessages)
			const fileExists = await fileExistsAtPath(apiConversationHistoryFilePath)

			if (fileExists) {
				const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))
				return {
					historyItem,
					taskDirPath,
					apiConversationHistoryFilePath,
					uiMessagesFilePath,
					apiConversationHistory,
				}
			}
		}

		// If we tried to get a task that doesn't exist, remove it from state
		await this.deleteTaskFromState(id)
		throw new Error("Task not found")
	}

	/**
	 * Shows a task with the specified ID
	 * This method is meant to be called by ClineProvider, which will handle the UI updates
	 *
	 * @param id The ID of the task to show
	 * @returns The task information needed to initialize a Cline instance
	 * @throws Error if the task is not found
	 */
	async showTaskWithId(id: string): Promise<HistoryItem> {
		const { historyItem } = await this.getTaskWithId(id)
		return historyItem
	}

	/**
	 * Exports a task with the specified ID
	 *
	 * @param id The ID of the task to export
	 * @throws Error if the task is not found
	 */
	async exportTaskWithId(id: string): Promise<void> {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id)
		await downloadTask(historyItem.ts, apiConversationHistory)
	}

	/**
	 * Deletes a task with the specified ID
	 *
	 * @param id The ID of the task to delete
	 * @throws Error if the task is not found
	 */
	async deleteTaskWithId(id: string): Promise<void> {
		const { taskDirPath, apiConversationHistoryFilePath, uiMessagesFilePath } = await this.getTaskWithId(id)

		await this.deleteTaskFromState(id)

		// Delete the task files.
		const apiConversationHistoryFileExists = await fileExistsAtPath(apiConversationHistoryFilePath)

		if (apiConversationHistoryFileExists) {
			await fs.unlink(apiConversationHistoryFilePath)
		}

		const uiMessagesFileExists = await fileExistsAtPath(uiMessagesFilePath)

		if (uiMessagesFileExists) {
			await fs.unlink(uiMessagesFilePath)
		}

		const legacyMessagesFilePath = path.join(taskDirPath, "claude_messages.json")

		if (await fileExistsAtPath(legacyMessagesFilePath)) {
			await fs.unlink(legacyMessagesFilePath)
		}

		// Check if checkpoints are enabled
		const checkpointsEnabled = await this.settingsManager.getGlobalState("checkpointsEnabled")
		const baseDir = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)

		// Delete checkpoints branch.
		if (checkpointsEnabled && baseDir) {
			const branchSummary = await simpleGit(baseDir)
				.branch(["-D", `roo-code-checkpoints-${id}`])
				.catch(() => undefined)

			if (branchSummary) {
				logger.debug(`[deleteTaskWithId${id}] deleted checkpoints branch`)
			}
		}

		// Delete checkpoints directory
		const checkpointsDir = path.join(taskDirPath, "checkpoints")

		if (await fileExistsAtPath(checkpointsDir)) {
			try {
				await fs.rm(checkpointsDir, { recursive: true, force: true })
				logger.debug(`[deleteTaskWithId${id}] removed checkpoints repo`)
			} catch (error) {
				logger.error(
					`[deleteTaskWithId${id}] failed to remove checkpoints repo: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		// Succeeds if the dir is empty.
		await fs.rmdir(taskDirPath)
	}

	/**
	 * Deletes a task from the state
	 *
	 * @param id The ID of the task to delete from state
	 */
	async deleteTaskFromState(id: string): Promise<void> {
		// Remove the task from history
		const taskHistory = ((await this.settingsManager.getGlobalState("taskHistory")) as HistoryItem[]) || []
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id)
		await this.settingsManager.updateGlobalState("taskHistory", updatedTaskHistory)
	}

	/**
	 * Updates the task history with a new or updated item
	 *
	 * @param historyItem The history item to update or add
	 * @returns The updated history
	 */
	async updateTaskHistory(historyItem: HistoryItem): Promise<HistoryItem[]> {
		return this.settingsManager.updateTaskHistory(historyItem)
	}

	/**
	 * Logs a message to the output channel if available
	 *
	 * @param message The message to log
	 */
	private log(message: string): void {
		if (this.outputChannel) {
			this.outputChannel.appendLine(message)
		}
		logger.debug(message)
	}
}
