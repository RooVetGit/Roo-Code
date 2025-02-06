import * as vscode from "vscode"
import delay from "delay"

import { getRepo, getStagedDiff, getStagedStatus } from "../utils/vsCodeGit"
import { ClineProvider } from "../core/webview/ClineProvider"
import { supportPrompt } from "../shared/support-prompt"
import { singleCompletionHandler } from "../utils/single-completion-handler"
import { ApiConfiguration } from "../shared/api"
import { truncateOutput } from "../integrations/misc/extract-text"

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: ClineProvider
}

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context, outputChannel } = options

	for (const [command, callback] of Object.entries(getCommandsMap(options))) {
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

const getCommandsMap = ({ context, outputChannel, provider }: RegisterCommandOptions) => {
	return {
		"roo-cline.plusButtonClicked": async () => {
			await provider.clearTask()
			await provider.postStateToWebview()
			await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		},
		"roo-cline.mcpButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
		},
		"roo-cline.promptsButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
		},
		"roo-cline.popoutButtonClicked": () => openClineInNewTab({ context, outputChannel }),
		"roo-cline.openInNewTab": () => openClineInNewTab({ context, outputChannel }),
		"roo-cline.settingsButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		},
		"roo-cline.historyButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
		},
		"roo-cline.commitSuggestion": (() => {
			let isExecuting = false // Flag to prevent multiple executions

			return async () => {
				if (isExecuting) {
					return // Prevent multiple executions
				}

				try {
					isExecuting = true
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: "Generating commit suggestion...",
							cancellable: false,
						},
						async () => {
							await generateCommitSuggestion(provider)
						},
					)
				} catch (error) {
					console.error("Error generating commit suggestion:", error)
				} finally {
					isExecuting = false // Reset the flag
				}
			}
		})(),
	}
}

const openClineInNewTab = async ({ context, outputChannel }: Omit<RegisterCommandOptions, "provider">) => {
	outputChannel.appendLine("Opening Roo Code in new tab")

	// (This example uses webviewProvider activation event which is necessary to
	// deserialize cached webview, but since we use retainContextWhenHidden, we
	// don't need to use that event).
	// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	const tabProvider = new ClineProvider(context, outputChannel)
	// const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined
	const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))

	// Check if there are any visible text editors, otherwise open a new group
	// to the right.
	const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0

	if (!hasVisibleEditors) {
		await vscode.commands.executeCommand("workbench.action.newGroupRight")
	}

	const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

	const panel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "Roo Code", targetCol, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [context.extensionUri],
	})

	// TODO: use better svg icon with light and dark variants (see
	// https://stackoverflow.com/questions/58365687/vscode-extension-iconpath).
	panel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "rocket.png"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "rocket.png"),
	}

	await tabProvider.resolveWebviewView(panel)

	// Lock the editor group so clicking on files doesn't open them over the panel
	await delay(100)
	await vscode.commands.executeCommand("workbench.action.lockEditorGroup")
}

async function generateCommitSuggestion(provider: ClineProvider): Promise<void> {
	const repo = getRepo()
	if (!repo) {
		vscode.window.showErrorMessage("No Git repository found")
		return
	}

	if (repo.state.indexChanges.length === 0) {
		vscode.window.showErrorMessage("No staged changes to generate commit message")
		return
	}

	try {
		const [status, diffs] = await Promise.all([getStagedStatus(repo), getStagedDiff(repo)])

		try {
			const { apiConfiguration, customSupportPrompts, listApiConfigMeta, enhancementApiConfigId } =
				await provider.getState()

			// Try to get enhancement config first, fall back to current config
			let configToUse: ApiConfiguration = apiConfiguration
			if (enhancementApiConfigId) {
				const config = listApiConfigMeta?.find((c) => c.id === enhancementApiConfigId)
				if (config?.name) {
					const loadedConfig = await provider.configManager.loadConfig(config.name)
					if (loadedConfig.apiProvider) {
						configToUse = loadedConfig
					}
				}
			}

			const commit = await singleCompletionHandler(
				configToUse,
				supportPrompt.create(
					"COMMIT",
					{
						stagedDiffs: truncateOutput(diffs, 300),
						stagedFilesStatus: status,
						inputUser: repo.inputBox.value,
					},
					customSupportPrompts,
				),
			)

			repo.inputBox.value = commit.replace(/<think>[\s\S]*?<\/think>/g, "").replace("```", "")
		} catch (error) {
			vscode.window.showErrorMessage("Failed to generate Commit ")
		}
	} catch (error) {
		vscode.window.showErrorMessage("Failed to staged changes")
	}
}
