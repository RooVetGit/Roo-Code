import * as vscode from "vscode"
import * as path from "path"
import fs from "fs/promises"

import { GlobalContentIds } from "../../shared/globalContentIds"
import { GlobalFileNames } from "../../shared/globalFileNames"
import { openFile } from "../../integrations/misc/open-file"
import { safeReadFile } from "../../utils/fs"
import { getSettingsDirectoryPath } from "../../utils/storage" // Need to confirm this import path
import { ExtensionMessage } from "../../shared/ExtensionMessage" // Assuming this type is needed for postMessageToWebview

// Define an interface for the dependencies ContentManager needs from ClineProvider
interface ContentManagerDependencies {
	log: (message: string) => void
	postMessageToWebview: (message: ExtensionMessage) => Promise<void>
	postStateToWebview: () => Promise<void>
	globalStorageUriFsPath: string // To replace contextProxy.globalStorageUri.fsPath
}

export class ContentManager {
	private readonly log: (message: string) => void
	private readonly postMessageToWebview: (message: ExtensionMessage) => Promise<void>
	private readonly postStateToWebview: () => Promise<void>
	private readonly globalStorageUriFsPath: string

	constructor(dependencies: ContentManagerDependencies) {
		this.log = dependencies.log
		this.postMessageToWebview = dependencies.postMessageToWebview
		this.postStateToWebview = dependencies.postStateToWebview
		this.globalStorageUriFsPath = dependencies.globalStorageUriFsPath
	}

	private async ensureSettingsDirectoryExists(): Promise<string> {
		const globalStoragePath = this.globalStorageUriFsPath
		return getSettingsDirectoryPath(globalStoragePath)
	}

	private async getContentPath(contentId: string): Promise<string | undefined> {
		const settingsDir = await this.ensureSettingsDirectoryExists()
		switch (contentId) {
			case GlobalContentIds.customInstructions:
				return path.join(settingsDir, GlobalFileNames.customInstructions)
			default:
				this.log(`Unknown contentId: ${contentId}`)
				return undefined
		}
	}

	async openContent(contentId: string): Promise<void> {
		const filePath = await this.getContentPath(contentId)

		if (!filePath) {
			this.log(`File path could not be determined for contentId: ${contentId}`)
			return
		}

		await openFile(filePath, { create: true })
		await vscode.commands.executeCommand("workbench.action.files.revert")
	}

	async refreshContent(contentId: string): Promise<void> {
		const content = await this.readContent(contentId)
		await this.updateContent(contentId, content)
		this.postMessageToWebview({
			type: "contentRefreshed",
			contentId: contentId,
			success: true, // Assuming success for now
		})
	}

	async updateContent(contentId: string, content?: string) {
		const filePath = await this.getContentPath(contentId)

		if (!filePath) {
			this.log(`File path could not be determined for contentId: ${contentId}`)
			return
		}

		if (content && content.trim()) {
			await fs.writeFile(filePath, content.trim(), "utf-8")
			this.log(`Updated content file: ${filePath}`)
		} else {
			try {
				await fs.unlink(filePath)
				this.log(`Deleted content file: ${filePath}`)
			} catch (error: any) {
				if (error.code !== "ENOENT") {
					this.log(`Error deleting content file: ${error.message}`)
					throw error
				}
			}
		}
		// Update the webview state
		await this.postStateToWebview()
	}

	async readContent(contentId: string): Promise<string> {
		const filePath = await this.getContentPath(contentId)

		return filePath ? ((await safeReadFile(filePath)) ?? "") : ""
	}
}
