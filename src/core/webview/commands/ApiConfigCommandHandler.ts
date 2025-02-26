import * as vscode from "vscode"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"

/**
 * Handles API configuration-related webview messages
 */
export class ApiConfigCommandHandler implements WebviewCommandHandler {
	async execute(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		switch (message.type) {
			case "apiConfiguration":
				if (message.apiConfiguration) {
					await provider.updateApiConfiguration(message.apiConfiguration)
				}
				await provider.postStateToWebview()
				break

			case "saveApiConfiguration":
				if (message.text && message.apiConfiguration) {
					try {
						await provider.configManager.saveConfig(message.text, message.apiConfiguration)
						const listApiConfig = await provider.configManager.listConfig()
						await provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig)
					} catch (error) {
						provider.outputChannel.appendLine(
							`Error save api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to save api configuration")
					}
				}
				break

			case "upsertApiConfiguration":
				if (message.text && message.apiConfiguration) {
					try {
						await provider.configManager.saveConfig(message.text, message.apiConfiguration)
						const listApiConfig = await provider.configManager.listConfig()

						await Promise.all([
							provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig),
							provider.updateApiConfiguration(message.apiConfiguration),
							provider.settingsManager.updateGlobalState("currentApiConfigName", message.text),
						])

						await provider.postStateToWebview()
					} catch (error) {
						provider.outputChannel.appendLine(
							`Error create new api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to create api configuration")
					}
				}
				break

			case "renameApiConfiguration":
				if (message.values && message.apiConfiguration) {
					try {
						const { oldName, newName } = message.values

						if (oldName === newName) {
							break
						}

						await provider.configManager.saveConfig(newName, message.apiConfiguration)
						await provider.configManager.deleteConfig(oldName)

						const listApiConfig = await provider.configManager.listConfig()

						// Update listApiConfigMeta first to ensure UI has latest data
						await provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig)
						await provider.settingsManager.updateGlobalState("currentApiConfigName", newName)
						await provider.postStateToWebview()
					} catch (error) {
						provider.outputChannel.appendLine(
							`Error rename api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to rename api configuration")
					}
				}
				break

			case "loadApiConfiguration":
				if (message.text) {
					try {
						const apiConfig = await provider.configManager.loadConfig(message.text)
						const listApiConfig = await provider.configManager.listConfig()

						await Promise.all([
							provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig),
							provider.settingsManager.updateGlobalState("currentApiConfigName", message.text),
							provider.updateApiConfiguration(apiConfig),
						])

						await provider.postStateToWebview()
					} catch (error) {
						provider.outputChannel.appendLine(
							`Error load api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to load api configuration")
					}
				}
				break

			case "deleteApiConfiguration":
				if (message.text) {
					const answer = await vscode.window.showInformationMessage(
						"Are you sure you want to delete this configuration profile?",
						{ modal: true },
						"Yes",
					)

					if (answer !== "Yes") {
						break
					}

					try {
						await provider.configManager.deleteConfig(message.text)
						const listApiConfig = await provider.configManager.listConfig()

						// Update listApiConfigMeta first to ensure UI has latest data
						await provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig)

						// If this was the current config, switch to first available
						const currentApiConfigName =
							await provider.settingsManager.getGlobalState("currentApiConfigName")
						if (message.text === currentApiConfigName && listApiConfig?.[0]?.name) {
							const apiConfig = await provider.configManager.loadConfig(listApiConfig[0].name)
							await Promise.all([
								provider.settingsManager.updateGlobalState(
									"currentApiConfigName",
									listApiConfig[0].name,
								),
								provider.updateApiConfiguration(apiConfig),
							])
						}

						await provider.postStateToWebview()
					} catch (error) {
						provider.outputChannel.appendLine(
							`Error delete api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to delete api configuration")
					}
				}
				break

			case "getListApiConfiguration":
				try {
					const listApiConfig = await provider.configManager.listConfig()
					await provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig)
					provider.postMessageToWebview({ type: "listApiConfig", listApiConfig })
				} catch (error) {
					provider.outputChannel.appendLine(
						`Error get list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage("Failed to get list api configuration")
				}
				break
		}
	}
}
