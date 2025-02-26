import * as vscode from "vscode"
import * as path from "path"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"
import { openFile, openImage } from "../../../integrations/misc/open-file"
import { openMention } from "../../mentions"
import { selectImages } from "../../../integrations/misc/process-images"
import { playSound, setSoundEnabled, setSoundVolume } from "../../../utils/sound"
import { searchCommits } from "../../../utils/git"
import { EXPERIMENT_IDS } from "../../../shared/experiments"

/**
 * Handles miscellaneous webview messages
 */
export class MiscCommandHandler implements WebviewCommandHandler {
	async execute(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		switch (message.type) {
			// File and UI interaction messages
			case "selectImages":
				const images = await selectImages()
				await provider.postMessageToWebview({ type: "selectedImages", images })
				break

			case "openImage":
				openImage(message.text!)
				break

			case "openFile":
				openFile(message.text!, message.values as { create?: boolean; content?: string })
				break

			case "openMention":
				openMention(message.text)
				break

			case "openCustomModesSettings": {
				const customModesFilePath = await provider.customModesManager.getCustomModesFilePath()
				if (customModesFilePath) {
					openFile(customModesFilePath)
				}
				break
			}

			// Sound-related messages
			case "playSound":
				if (message.audioType) {
					const soundPath = path.join(provider.context.extensionPath, "audio", `${message.audioType}.wav`)
					playSound(soundPath)
				}
				break

			case "soundEnabled":
				const soundEnabled = message.bool ?? true
				await provider.settingsManager.updateGlobalState("soundEnabled", soundEnabled)
				setSoundEnabled(soundEnabled)
				await provider.postStateToWebview()
				break

			case "soundVolume":
				const soundVolume = message.value ?? 0.5
				await provider.settingsManager.updateGlobalState("soundVolume", soundVolume)
				setSoundVolume(soundVolume)
				await provider.postStateToWebview()
				break

			// Experimental features messages
			case "updateExperimental": {
				if (!message.values) {
					break
				}

				const updatedExperiments = {
					...((await provider.settingsManager.getGlobalState("experiments")) ?? provider.experimentDefault),
					...message.values,
				} as Record<string, boolean>

				await provider.settingsManager.updateGlobalState("experiments", updatedExperiments)

				// Update diffStrategy in current Cline instance if it exists
				if (message.values[EXPERIMENT_IDS.DIFF_STRATEGY] !== undefined && provider.cline) {
					await provider.cline.updateDiffStrategy(updatedExperiments[EXPERIMENT_IDS.DIFF_STRATEGY])
				}

				await provider.postStateToWebview()
				break
			}

			// Miscellaneous messages
			case "resetState":
				await provider.resetState()
				break

			case "searchCommits": {
				const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
				if (cwd) {
					try {
						const commits = await searchCommits(message.query || "", cwd)
						await provider.postMessageToWebview({
							type: "commitSearchResults",
							commits,
						})
					} catch (error) {
						provider.outputChannel.appendLine(
							`Error searching commits: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to search commits")
					}
				}
				break
			}

			case "webviewDidLaunch":
				// Load custom modes first
				const customModes = await provider.customModesManager.getCustomModes()
				await provider.settingsManager.updateGlobalState("customModes", customModes)

				await provider.postStateToWebview()
				provider.workspaceTracker?.initializeFilePaths() // don't await
				const theme = await vscode.commands.executeCommand("vscode.getTheme")
				provider.postMessageToWebview({ type: "theme", text: JSON.stringify(theme) })

				// If MCP Hub is already initialized, update the webview with current server list
				if (provider.getMcpHub()) {
					provider.postMessageToWebview({
						type: "mcpServers",
						mcpServers: provider.getMcpHub()!.getAllServers(),
					})
				}

				// Initialize model data
				await this.initializeModelData(provider)

				// Initialize API configurations
				await this.initializeApiConfigurations(provider)

				provider.isViewLaunched = true
				break
		}
	}

	/**
	 * Initialize model data by loading cached models and refreshing from providers
	 */
	private async initializeModelData(provider: ClineProviderInterface): Promise<void> {
		// Load cached models
		const openRouterModels = await provider.modelManager.readOpenRouterModels()
		if (openRouterModels) {
			provider.postMessageToWebview({ type: "openRouterModels", openRouterModels })
		}

		const glamaModels = await provider.modelManager.readGlamaModels()
		if (glamaModels) {
			provider.postMessageToWebview({ type: "glamaModels", glamaModels })
		}

		const unboundModels = await provider.modelManager.readUnboundModels()
		if (unboundModels) {
			provider.postMessageToWebview({ type: "unboundModels", unboundModels })
		}

		const requestyModels = await provider.modelManager.readRequestyModels()
		if (requestyModels) {
			provider.postMessageToWebview({ type: "requestyModels", requestyModels })
		}

		// Refresh models from providers
		provider.modelManager.refreshOpenRouterModels().then(async (openRouterModels) => {
			if (openRouterModels) {
				const { apiConfiguration } = await provider.getState()
				if (apiConfiguration.openRouterModelId) {
					await provider.settingsManager.updateGlobalState(
						"openRouterModelInfo",
						openRouterModels[apiConfiguration.openRouterModelId],
					)
					await provider.postStateToWebview()
				}
			}
		})

		provider.modelManager.refreshGlamaModels().then(async (glamaModels) => {
			if (glamaModels) {
				const { apiConfiguration } = await provider.getState()
				if (apiConfiguration.glamaModelId) {
					await provider.settingsManager.updateGlobalState(
						"glamaModelInfo",
						glamaModels[apiConfiguration.glamaModelId],
					)
					await provider.postStateToWebview()
				}
			}
		})

		provider.modelManager.refreshUnboundModels().then(async (unboundModels) => {
			if (unboundModels) {
				const { apiConfiguration } = await provider.getState()
				if (apiConfiguration?.unboundModelId) {
					await provider.settingsManager.updateGlobalState(
						"unboundModelInfo",
						unboundModels[apiConfiguration.unboundModelId],
					)
					await provider.postStateToWebview()
				}
			}
		})

		provider.modelManager.refreshRequestyModels().then(async (requestyModels) => {
			if (requestyModels) {
				const { apiConfiguration } = await provider.getState()
				if (apiConfiguration.requestyModelId) {
					await provider.settingsManager.updateGlobalState(
						"requestyModelInfo",
						requestyModels[apiConfiguration.requestyModelId],
					)
					await provider.postStateToWebview()
				}
			}
		})
	}

	/**
	 * Initialize API configurations
	 */
	private async initializeApiConfigurations(provider: ClineProviderInterface): Promise<void> {
		try {
			const listApiConfig = await provider.configManager.listConfig()
			if (!listApiConfig) {
				return
			}

			if (listApiConfig.length === 1) {
				// Check if first time init then sync with exist config
				if (!listApiConfig[0].apiProvider) {
					const { apiConfiguration } = await provider.getState()
					await provider.configManager.saveConfig(listApiConfig[0].name ?? "default", apiConfiguration)
					listApiConfig[0].apiProvider = apiConfiguration.apiProvider
				}
			}

			const currentConfigName = (await provider.settingsManager.getGlobalState("currentApiConfigName")) as string

			if (currentConfigName) {
				if (!(await provider.configManager.hasConfig(currentConfigName))) {
					// Current config name not valid, get first config in list
					await provider.settingsManager.updateGlobalState("currentApiConfigName", listApiConfig?.[0]?.name)
					if (listApiConfig?.[0]?.name) {
						const apiConfig = await provider.configManager.loadConfig(listApiConfig?.[0]?.name)

						await Promise.all([
							provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig),
							provider.postMessageToWebview({ type: "listApiConfig", listApiConfig }),
							provider.updateApiConfiguration(apiConfig),
						])
						await provider.postStateToWebview()
						return
					}
				}
			}

			await Promise.all([
				provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig),
				provider.postMessageToWebview({ type: "listApiConfig", listApiConfig }),
			])
		} catch (error) {
			provider.outputChannel.appendLine(
				`Error list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}
	}
}
