import * as vscode from "vscode"
import { getStagedDiff, getStagedStatus } from "./git"
import { supportPrompt } from "../shared/support-prompt"
import { singleCompletionHandler } from "./single-completion-handler"
import { ApiConfiguration } from "../shared/api"
import { truncateOutput } from "../integrations/misc/extract-text"
import { ClineProvider } from "../core/webview/ClineProvider"

/**
 * Generates a commit suggestion based on staged changes
 * @param provider The ClineProvider instance
 * @param cwd The current working directory
 * @returns A Promise that resolves when the commit suggestion is generated
 */
export async function generateCommitSuggestion(provider: ClineProvider, cwd: string): Promise<void> {
	// Check if there's a git repository
	try {
		// Get staged changes
		const [status, diffs] = await Promise.all([getStagedStatus(cwd), getStagedDiff(cwd)])

		if (!status) {
			vscode.window.showErrorMessage("No staged changes to generate commit message")
			return
		}

		try {
			const { apiConfiguration, customSupportPrompts, listApiConfigMeta, enhancementApiConfigId } =
				await provider.getState()

			// Try to get enhancement config first, fall back to current config
			let configToUse: ApiConfiguration = apiConfiguration
			if (enhancementApiConfigId) {
				const config = listApiConfigMeta?.find((c) => c.id === enhancementApiConfigId)
				if (config?.name) {
					const loadedConfig = await provider.providerSettingsManager.loadConfig(config.name)
					if (loadedConfig.apiProvider) {
						configToUse = loadedConfig
					}
				}
			}

			// Get the current input from the git commit message editor
			const inputUser = await getCommitInputValue(cwd)

			const commit = await singleCompletionHandler(
				configToUse,
				supportPrompt.create(
					"COMMIT",
					{
						stagedDiffs: truncateOutput(diffs, 300),
						stagedFilesStatus: status,
						inputUser: inputUser,
					},
					customSupportPrompts,
				),
			)

			// Set the commit message in the git commit message editor
			await setCommitInputValue(cwd, commit.replace(/<think>[\s\S]*?<\/think>/g, "").replace("```", ""))
		} catch (error) {
			vscode.window.showErrorMessage("Failed to generate commit message")
		}
	} catch (error) {
		vscode.window.showErrorMessage("Failed to get staged changes")
	}
}

/**
 * Gets the current value from the git commit message editor
 * @param cwd The current working directory
 * @returns The current commit message
 */
async function getCommitInputValue(cwd: string): Promise<string> {
	try {
		// Read the commit message from the COMMIT_EDITMSG file
		const { exec } = require("child_process")
		const { promisify } = require("util")
		const execAsync = promisify(exec)

		// Try to get the commit message from the COMMIT_EDITMSG file
		try {
			const { stdout } = await execAsync("git rev-parse --git-dir", { cwd })
			const gitDir = stdout.trim()
			const fs = require("fs")
			const path = require("path")
			const commitMsgPath = path.join(cwd, gitDir, "COMMIT_EDITMSG")

			if (fs.existsSync(commitMsgPath)) {
				return fs.readFileSync(commitMsgPath, "utf8")
			}
		} catch (error) {
			// Ignore errors, return empty string
		}

		return ""
	} catch (error) {
		console.error("Error getting commit input value:", error)
		return ""
	}
}

/**
 * Sets the value in the git commit message editor
 * @param cwd The current working directory
 * @param message The commit message to set
 */
async function setCommitInputValue(cwd: string, message: string): Promise<void> {
	try {
		await vscode.env.clipboard.writeText(message)
		vscode.window.showInformationMessage("Commit message copied to clipboard")
	} catch (error) {
		console.error("Error setting commit input value:", error)
		vscode.window.showErrorMessage("Failed to set commit message")
	}
}
