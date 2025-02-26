import * as vscode from "vscode"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"
import { singleCompletionHandler } from "../../../utils/single-completion-handler"
import { supportPrompt } from "../../../shared/support-prompt"

/**
 * Handles prompt-related webview messages
 */
export class PromptCommandHandler implements WebviewCommandHandler {
	async execute(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		switch (message.type) {
			case "updateSupportPrompt":
				try {
					if (Object.keys(message?.values ?? {}).length === 0) {
						return
					}

					const existingPrompts =
						(await provider.settingsManager.getGlobalState("customSupportPrompts")) || {}

					const updatedPrompts = {
						...existingPrompts,
						...message.values,
					}

					await provider.settingsManager.updateGlobalState("customSupportPrompts", updatedPrompts)
					await provider.postStateToWebview()
				} catch (error) {
					provider.outputChannel.appendLine(
						`Error update support prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage("Failed to update support prompt")
				}
				break

			case "resetSupportPrompt":
				try {
					if (!message?.text) {
						return
					}

					const existingPrompts = ((await provider.settingsManager.getGlobalState("customSupportPrompts")) ||
						{}) as Record<string, any>

					const updatedPrompts = {
						...existingPrompts,
					}

					updatedPrompts[message.text] = undefined

					await provider.settingsManager.updateGlobalState("customSupportPrompts", updatedPrompts)
					await provider.postStateToWebview()
				} catch (error) {
					provider.outputChannel.appendLine(
						`Error reset support prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage("Failed to reset support prompt")
				}
				break

			case "updatePrompt":
				if (message.promptMode && message.customPrompt !== undefined) {
					const existingPrompts = (await provider.settingsManager.getGlobalState("customModePrompts")) || {}

					const updatedPrompts = {
						...existingPrompts,
						[message.promptMode]: message.customPrompt,
					}

					await provider.settingsManager.updateGlobalState("customModePrompts", updatedPrompts)

					// Get current state and explicitly include customModePrompts
					const currentState = await provider.getState()

					const stateWithPrompts = {
						...currentState,
						customModePrompts: updatedPrompts,
					}

					// Post state with prompts
					provider.view?.webview.postMessage({
						type: "state",
						state: stateWithPrompts,
					})
				}
				break

			case "enhancePrompt":
				if (message.text) {
					try {
						const { apiConfiguration, customSupportPrompts, listApiConfigMeta, enhancementApiConfigId } =
							await provider.getState()

						// Try to get enhancement config first, fall back to current config
						let configToUse = apiConfiguration
						if (enhancementApiConfigId) {
							const config = listApiConfigMeta?.find((c: any) => c.id === enhancementApiConfigId)
							if (config?.name) {
								const loadedConfig = await provider.configManager.loadConfig(config.name)
								if (loadedConfig.apiProvider) {
									configToUse = loadedConfig
								}
							}
						}

						const enhancedPrompt = await singleCompletionHandler(
							configToUse,
							supportPrompt.create(
								"ENHANCE",
								{
									userInput: message.text,
								},
								customSupportPrompts,
							),
						)

						await provider.postMessageToWebview({
							type: "enhancedPrompt",
							text: enhancedPrompt,
						})
					} catch (error) {
						provider.outputChannel.appendLine(
							`Error enhancing prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to enhance prompt")
						await provider.postMessageToWebview({
							type: "enhancedPrompt",
						})
					}
				}
				break

			case "getSystemPrompt":
				try {
					const systemPrompt = await this.generateSystemPrompt(message, provider)

					await provider.postMessageToWebview({
						type: "systemPrompt",
						text: systemPrompt,
						mode: message.mode,
					})
				} catch (error) {
					provider.outputChannel.appendLine(
						`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage("Failed to get system prompt")
				}
				break

			case "copySystemPrompt":
				try {
					const systemPrompt = await this.generateSystemPrompt(message, provider)

					await vscode.env.clipboard.writeText(systemPrompt)
					await vscode.window.showInformationMessage("System prompt successfully copied to clipboard")
				} catch (error) {
					provider.outputChannel.appendLine(
						`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage("Failed to get system prompt")
				}
				break
		}
	}

	/**
	 * Generate system prompt for the given message
	 */
	private async generateSystemPrompt(message: WebviewMessage, provider: ClineProviderInterface): Promise<string> {
		const {
			apiConfiguration,
			customModePrompts,
			customInstructions,
			preferredLanguage,
			browserViewportSize,
			diffEnabled,
			mcpEnabled,
			fuzzyMatchThreshold,
			experiments,
			enableMcpServerCreation,
		} = await provider.getState()

		// Create diffStrategy based on current model and settings
		const diffStrategy = provider.getDiffStrategy(
			apiConfiguration.apiModelId || apiConfiguration.openRouterModelId || "",
			fuzzyMatchThreshold,
			experiments.DIFF_STRATEGY,
		)

		const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) || ""

		const mode = message.mode ?? "default"
		const customModes = await provider.customModesManager.getCustomModes()

		const systemPrompt = await provider.getSystemPrompt(
			cwd,
			apiConfiguration.openRouterModelInfo?.supportsComputerUse ?? false,
			mcpEnabled ? provider.getMcpHub() : undefined,
			diffStrategy,
			browserViewportSize ?? "900x600",
			mode,
			customModePrompts,
			customModes,
			customInstructions,
			preferredLanguage,
			diffEnabled,
			experiments,
			enableMcpServerCreation,
		)

		return systemPrompt
	}
}
