import * as vscode from "vscode"
import * as path from "path"
import pWaitFor from "p-wait-for"

import { WebviewMessage, checkoutDiffPayloadSchema, checkoutRestorePayloadSchema } from "../../shared/WebviewMessage"
import { Mode } from "../../shared/modes"
import { ApiConfiguration } from "../../shared/api"
import { getTheme } from "../../integrations/theme/getTheme"
import { openFile, openImage } from "../../integrations/misc/open-file"
import { openMention } from "../mentions"
import { selectImages } from "../../integrations/misc/process-images"
import { playSound, setSoundEnabled, setSoundVolume } from "../../utils/sound"
import { checkExistKey } from "../../shared/checkExistApiConfig"
import { singleCompletionHandler } from "../../utils/single-completion-handler"
import { supportPrompt } from "../../shared/support-prompt"
import { searchCommits } from "../../utils/git"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"
import { ClineProviderInterface } from "./ClineProviderInterface"

/**
 * Handles webview messages for ClineProvider, organized by category
 */
export class WebviewMessageHandlers {
	constructor(private provider: ClineProviderInterface) {}

	/**
	 * Handle webview initialization messages
	 */
	async handleWebviewInitialization(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "webviewDidLaunch":
				// Load custom modes first
				const customModes = await this.provider.customModesManager.getCustomModes()
				await this.provider.settingsManager.updateGlobalState("customModes", customModes)

				await this.provider.postStateToWebview()
				this.provider.workspaceTracker?.initializeFilePaths() // don't await
				getTheme().then((theme) =>
					this.provider.postMessageToWebview({ type: "theme", text: JSON.stringify(theme) }),
				)

				// post last cached models in case the call to endpoint fails
				this.provider.modelManager.readOpenRouterModels().then((openRouterModels) => {
					if (openRouterModels) {
						this.provider.postMessageToWebview({ type: "openRouterModels", openRouterModels })
					}
				})

				// If MCP Hub is already initialized, update the webview with current server list
				if (this.provider.getMcpHub()) {
					this.provider.postMessageToWebview({
						type: "mcpServers",
						mcpServers: this.provider.getMcpHub()!.getAllServers(),
					})
				}

				// gui relies on model info to be up-to-date to provide the most accurate pricing
				this.provider.modelManager.refreshOpenRouterModels().then(async (openRouterModels) => {
					if (openRouterModels) {
						// update model info in state
						const { apiConfiguration } = await this.provider.getState()
						if (apiConfiguration.openRouterModelId) {
							await this.provider.settingsManager.updateGlobalState(
								"openRouterModelInfo",
								openRouterModels[apiConfiguration.openRouterModelId],
							)
							await this.provider.postStateToWebview()
						}
					}
				})

				this.provider.modelManager.readGlamaModels().then((glamaModels) => {
					if (glamaModels) {
						this.provider.postMessageToWebview({ type: "glamaModels", glamaModels })
					}
				})

				this.provider.modelManager.refreshGlamaModels().then(async (glamaModels) => {
					if (glamaModels) {
						const { apiConfiguration } = await this.provider.getState()
						if (apiConfiguration.glamaModelId) {
							await this.provider.settingsManager.updateGlobalState(
								"glamaModelInfo",
								glamaModels[apiConfiguration.glamaModelId],
							)
							await this.provider.postStateToWebview()
						}
					}
				})

				this.provider.modelManager.readUnboundModels().then((unboundModels) => {
					if (unboundModels) {
						this.provider.postMessageToWebview({ type: "unboundModels", unboundModels })
					}
				})

				this.provider.modelManager.refreshUnboundModels().then(async (unboundModels) => {
					if (unboundModels) {
						const { apiConfiguration } = await this.provider.getState()
						if (apiConfiguration?.unboundModelId) {
							await this.provider.settingsManager.updateGlobalState(
								"unboundModelInfo",
								unboundModels[apiConfiguration.unboundModelId],
							)
							await this.provider.postStateToWebview()
						}
					}
				})

				this.provider.modelManager.readRequestyModels().then((requestyModels) => {
					if (requestyModels) {
						this.provider.postMessageToWebview({ type: "requestyModels", requestyModels })
					}
				})

				this.provider.modelManager.refreshRequestyModels().then(async (requestyModels) => {
					if (requestyModels) {
						const { apiConfiguration } = await this.provider.getState()
						if (apiConfiguration.requestyModelId) {
							await this.provider.settingsManager.updateGlobalState(
								"requestyModelInfo",
								requestyModels[apiConfiguration.requestyModelId],
							)
							await this.provider.postStateToWebview()
						}
					}
				})

				this.provider.configManager
					.listConfig()
					.then(async (listApiConfig) => {
						if (!listApiConfig) {
							return
						}

						if (listApiConfig.length === 1) {
							// check if first time init then sync with exist config
							if (!checkExistKey(listApiConfig[0])) {
								const { apiConfiguration } = await this.provider.getState()
								await this.provider.configManager.saveConfig(
									listApiConfig[0].name ?? "default",
									apiConfiguration,
								)
								listApiConfig[0].apiProvider = apiConfiguration.apiProvider
							}
						}

						const currentConfigName = (await this.provider.settingsManager.getGlobalState(
							"currentApiConfigName",
						)) as string

						if (currentConfigName) {
							if (!(await this.provider.configManager.hasConfig(currentConfigName))) {
								// current config name not valid, get first config in list
								await this.provider.settingsManager.updateGlobalState(
									"currentApiConfigName",
									listApiConfig?.[0]?.name,
								)
								if (listApiConfig?.[0]?.name) {
									const apiConfig = await this.provider.configManager.loadConfig(
										listApiConfig?.[0]?.name,
									)

									await Promise.all([
										this.provider.settingsManager.updateGlobalState(
											"listApiConfigMeta",
											listApiConfig,
										),
										this.provider.postMessageToWebview({ type: "listApiConfig", listApiConfig }),
										this.provider.updateApiConfiguration(apiConfig),
									])
									await this.provider.postStateToWebview()
									return
								}
							}
						}

						await Promise.all([
							await this.provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig),
							await this.provider.postMessageToWebview({ type: "listApiConfig", listApiConfig }),
						])
					})
					.catch((error) =>
						this.provider.outputChannel.appendLine(
							`Error list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						),
					)

				this.provider.isViewLaunched = true
				break

			case "didShowAnnouncement":
				await this.provider.settingsManager.updateGlobalState(
					"lastShownAnnouncementId",
					this.provider.latestAnnouncementId,
				)
				await this.provider.postStateToWebview()
				break
		}
	}

	/**
	 * Handle task-related messages
	 */
	async handleTaskMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "newTask":
				await this.provider.initClineWithTask(message.text, message.images)
				break

			case "clearTask":
				await this.provider.clearTask()
				await this.provider.postStateToWebview()
				break

			case "cancelTask":
				await this.provider.cancelTask()
				break

			case "askResponse":
				this.provider.cline?.handleWebviewAskResponse(message.askResponse!, message.text, message.images)
				break

			case "deleteMessage":
				await this.handleDeleteMessage(message)
				break

			case "exportCurrentTask":
				const currentTaskId = this.provider.cline?.taskId
				if (currentTaskId) {
					await this.provider.taskHistoryManager.exportTaskWithId(currentTaskId)
				}
				break

			case "checkpointDiff":
				const diffResult = checkoutDiffPayloadSchema.safeParse(message.payload)
				if (diffResult.success) {
					await this.provider.cline?.checkpointDiff(diffResult.data)
				}
				break

			case "checkpointRestore": {
				const restoreResult = checkoutRestorePayloadSchema.safeParse(message.payload)
				if (restoreResult.success) {
					await this.provider.cancelTask()

					try {
						await pWaitFor(() => this.provider.cline?.isInitialized === true, { timeout: 3_000 })
					} catch (error) {
						vscode.window.showErrorMessage("Timed out when attempting to restore checkpoint.")
					}

					try {
						await this.provider.cline?.checkpointRestore(restoreResult.data)
					} catch (error) {
						vscode.window.showErrorMessage("Failed to restore checkpoint.")
					}
				}
				break
			}
		}
	}

	/**
	 * Handle task history-related messages
	 */
	async handleTaskHistoryMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "showTaskWithId":
				await this.provider.taskHistoryManager.showTaskWithId(message.text!)
				break

			case "deleteTaskWithId":
				if (message.text === this.provider.cline?.taskId) {
					await this.provider.clearTask()
				}
				await this.provider.taskHistoryManager.deleteTaskWithId(message.text!)
				await this.provider.postStateToWebview()
				break

			case "exportTaskWithId":
				await this.provider.taskHistoryManager.exportTaskWithId(message.text!)
				break
		}
	}

	/**
	 * Handle settings-related messages
	 */
	async handleSettingsMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "customInstructions":
				await this.provider.updateCustomInstructions(message.text)
				break

			case "alwaysAllowReadOnly":
				await this.provider.settingsManager.updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined)
				await this.provider.postStateToWebview()
				break

			case "alwaysAllowWrite":
				await this.provider.settingsManager.updateGlobalState("alwaysAllowWrite", message.bool ?? undefined)
				await this.provider.postStateToWebview()
				break

			case "alwaysAllowExecute":
				await this.provider.settingsManager.updateGlobalState("alwaysAllowExecute", message.bool ?? undefined)
				await this.provider.postStateToWebview()
				break

			case "alwaysAllowBrowser":
				await this.provider.settingsManager.updateGlobalState("alwaysAllowBrowser", message.bool ?? undefined)
				await this.provider.postStateToWebview()
				break

			case "alwaysAllowMcp":
				await this.provider.settingsManager.updateGlobalState("alwaysAllowMcp", message.bool)
				await this.provider.postStateToWebview()
				break

			case "alwaysAllowModeSwitch":
				await this.provider.settingsManager.updateGlobalState("alwaysAllowModeSwitch", message.bool)
				await this.provider.postStateToWebview()
				break

			case "diffEnabled":
				const diffEnabled = message.bool ?? true
				await this.provider.settingsManager.updateGlobalState("diffEnabled", diffEnabled)
				await this.provider.postStateToWebview()
				break

			case "checkpointsEnabled":
				const checkpointsEnabled = message.bool ?? false
				await this.provider.settingsManager.updateGlobalState("checkpointsEnabled", checkpointsEnabled)
				await this.provider.postStateToWebview()
				break

			case "browserViewportSize":
				const browserViewportSize = message.text ?? "900x600"
				await this.provider.settingsManager.updateGlobalState("browserViewportSize", browserViewportSize)
				await this.provider.postStateToWebview()
				break

			case "fuzzyMatchThreshold":
				await this.provider.settingsManager.updateGlobalState("fuzzyMatchThreshold", message.value)
				await this.provider.postStateToWebview()
				break

			case "alwaysApproveResubmit":
				await this.provider.settingsManager.updateGlobalState("alwaysApproveResubmit", message.bool ?? false)
				await this.provider.postStateToWebview()
				break

			case "requestDelaySeconds":
				await this.provider.settingsManager.updateGlobalState("requestDelaySeconds", message.value ?? 5)
				await this.provider.postStateToWebview()
				break

			case "rateLimitSeconds":
				await this.provider.settingsManager.updateGlobalState("rateLimitSeconds", message.value ?? 0)
				await this.provider.postStateToWebview()
				break

			case "preferredLanguage":
				await this.provider.settingsManager.updateGlobalState("preferredLanguage", message.text)
				await this.provider.postStateToWebview()
				break

			case "writeDelayMs":
				await this.provider.settingsManager.updateGlobalState("writeDelayMs", message.value)
				await this.provider.postStateToWebview()
				break

			case "terminalOutputLineLimit":
				await this.provider.settingsManager.updateGlobalState("terminalOutputLineLimit", message.value)
				await this.provider.postStateToWebview()
				break

			case "screenshotQuality":
				await this.provider.settingsManager.updateGlobalState("screenshotQuality", message.value)
				await this.provider.postStateToWebview()
				break

			case "maxOpenTabsContext":
				const tabCount = Math.min(Math.max(0, message.value ?? 20), 500)
				await this.provider.settingsManager.updateGlobalState("maxOpenTabsContext", tabCount)
				await this.provider.postStateToWebview()
				break

			case "enhancementApiConfigId":
				await this.provider.settingsManager.updateGlobalState("enhancementApiConfigId", message.text)
				await this.provider.postStateToWebview()
				break

			case "autoApprovalEnabled":
				await this.provider.settingsManager.updateGlobalState("autoApprovalEnabled", message.bool ?? false)
				await this.provider.postStateToWebview()
				break

			case "mode":
				await this.provider.handleModeSwitch(message.text as Mode)
				break

			case "allowedCommands":
				await this.provider.context.globalState.update("allowedCommands", message.commands)
				// Also update workspace settings
				await vscode.workspace
					.getConfiguration("roo-cline")
					.update("allowedCommands", message.commands, vscode.ConfigurationTarget.Global)
				break
		}
	}

	/**
	 * Handle model-related messages
	 */
	async handleModelMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "requestOllamaModels":
				const ollamaModels = await this.provider.modelManager.getOllamaModels(message.text)
				this.provider.postMessageToWebview({ type: "ollamaModels", ollamaModels })
				break

			case "requestLmStudioModels":
				const lmStudioModels = await this.provider.modelManager.getLmStudioModels(message.text)
				this.provider.postMessageToWebview({ type: "lmStudioModels", lmStudioModels })
				break

			case "requestVsCodeLmModels":
				const vsCodeLmModels = await this.provider.modelManager.getVsCodeLmModels()
				this.provider.postMessageToWebview({ type: "vsCodeLmModels", vsCodeLmModels })
				break

			case "refreshGlamaModels":
				await this.provider.modelManager.refreshGlamaModels()
				break

			case "refreshOpenRouterModels":
				await this.provider.modelManager.refreshOpenRouterModels()
				break

			case "refreshOpenAiModels":
				if (message?.values?.baseUrl && message?.values?.apiKey) {
					const openAiModels = await this.provider.modelManager.getOpenAiModels(
						message?.values?.baseUrl,
						message?.values?.apiKey,
					)
					this.provider.postMessageToWebview({ type: "openAiModels", openAiModels })
				}
				break

			case "refreshUnboundModels":
				await this.provider.modelManager.refreshUnboundModels()
				break

			case "refreshRequestyModels":
				if (message?.values?.apiKey) {
					const requestyModels = await this.provider.modelManager.refreshRequestyModels(
						message?.values?.apiKey,
					)
					this.provider.postMessageToWebview({ type: "requestyModels", requestyModels: requestyModels })
				}
				break
		}
	}

	/**
	 * Handle API configuration-related messages
	 */
	async handleApiConfigMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "apiConfiguration":
				if (message.apiConfiguration) {
					await this.provider.updateApiConfiguration(message.apiConfiguration)
				}
				await this.provider.postStateToWebview()
				break

			case "saveApiConfiguration":
				if (message.text && message.apiConfiguration) {
					try {
						await this.provider.configManager.saveConfig(message.text, message.apiConfiguration)
						const listApiConfig = await this.provider.configManager.listConfig()
						await this.provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig)
					} catch (error) {
						this.provider.outputChannel.appendLine(
							`Error save api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to save api configuration")
					}
				}
				break

			case "upsertApiConfiguration":
				if (message.text && message.apiConfiguration) {
					try {
						await this.provider.configManager.saveConfig(message.text, message.apiConfiguration)
						const listApiConfig = await this.provider.configManager.listConfig()

						await Promise.all([
							this.provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig),
							this.provider.updateApiConfiguration(message.apiConfiguration),
							this.provider.settingsManager.updateGlobalState("currentApiConfigName", message.text),
						])

						await this.provider.postStateToWebview()
					} catch (error) {
						this.provider.outputChannel.appendLine(
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

						await this.provider.configManager.saveConfig(newName, message.apiConfiguration)
						await this.provider.configManager.deleteConfig(oldName)

						const listApiConfig = await this.provider.configManager.listConfig()

						// Update listApiConfigMeta first to ensure UI has latest data
						await this.provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig)
						await this.provider.settingsManager.updateGlobalState("currentApiConfigName", newName)
						await this.provider.postStateToWebview()
					} catch (error) {
						this.provider.outputChannel.appendLine(
							`Error rename api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to rename api configuration")
					}
				}
				break

			case "loadApiConfiguration":
				if (message.text) {
					try {
						const apiConfig = await this.provider.configManager.loadConfig(message.text)
						const listApiConfig = await this.provider.configManager.listConfig()

						await Promise.all([
							this.provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig),
							this.provider.settingsManager.updateGlobalState("currentApiConfigName", message.text),
							this.provider.updateApiConfiguration(apiConfig),
						])

						await this.provider.postStateToWebview()
					} catch (error) {
						this.provider.outputChannel.appendLine(
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
						await this.provider.configManager.deleteConfig(message.text)
						const listApiConfig = await this.provider.configManager.listConfig()

						// Update listApiConfigMeta first to ensure UI has latest data
						await this.provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig)

						// If this was the current config, switch to first available
						const currentApiConfigName =
							await this.provider.settingsManager.getGlobalState("currentApiConfigName")
						if (message.text === currentApiConfigName && listApiConfig?.[0]?.name) {
							const apiConfig = await this.provider.configManager.loadConfig(listApiConfig[0].name)
							await Promise.all([
								this.provider.settingsManager.updateGlobalState(
									"currentApiConfigName",
									listApiConfig[0].name,
								),
								this.provider.updateApiConfiguration(apiConfig),
							])
						}

						await this.provider.postStateToWebview()
					} catch (error) {
						this.provider.outputChannel.appendLine(
							`Error delete api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to delete api configuration")
					}
				}
				break

			case "getListApiConfiguration":
				try {
					const listApiConfig = await this.provider.configManager.listConfig()
					await this.provider.settingsManager.updateGlobalState("listApiConfigMeta", listApiConfig)
					this.provider.postMessageToWebview({ type: "listApiConfig", listApiConfig })
				} catch (error) {
					this.provider.outputChannel.appendLine(
						`Error get list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage("Failed to get list api configuration")
				}
				break
		}
	}

	/**
	 * Handle MCP-related messages
	 */
	async handleMcpMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "openMcpSettings": {
				const mcpSettingsFilePath = await this.provider.getMcpHub()?.getMcpSettingsFilePath()
				if (mcpSettingsFilePath) {
					openFile(mcpSettingsFilePath)
				}
				break
			}

			case "deleteMcpServer": {
				if (!message.serverName) {
					break
				}

				try {
					this.provider.outputChannel.appendLine(`Attempting to delete MCP server: ${message.serverName}`)
					await this.provider.getMcpHub()?.deleteServer(message.serverName)
					this.provider.outputChannel.appendLine(`Successfully deleted MCP server: ${message.serverName}`)
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					this.provider.outputChannel.appendLine(`Failed to delete MCP server: ${errorMessage}`)
					// Error messages are already handled by McpHub.deleteServer
				}
				break
			}

			case "restartMcpServer": {
				try {
					await this.provider.getMcpHub()?.restartConnection(message.text!)
				} catch (error) {
					this.provider.outputChannel.appendLine(
						`Failed to retry connection for ${message.text}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
				}
				break
			}

			case "toggleToolAlwaysAllow": {
				try {
					await this.provider
						.getMcpHub()
						?.toggleToolAlwaysAllow(message.serverName!, message.toolName!, message.alwaysAllow!)
				} catch (error) {
					this.provider.outputChannel.appendLine(
						`Failed to toggle auto-approve for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
				}
				break
			}

			case "toggleMcpServer": {
				try {
					await this.provider.getMcpHub()?.toggleServerDisabled(message.serverName!, message.disabled!)
				} catch (error) {
					this.provider.outputChannel.appendLine(
						`Failed to toggle MCP server ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
				}
				break
			}

			case "mcpEnabled":
				const mcpEnabled = message.bool ?? true
				await this.provider.settingsManager.updateGlobalState("mcpEnabled", mcpEnabled)
				await this.provider.postStateToWebview()
				break

			case "enableMcpServerCreation":
				await this.provider.settingsManager.updateGlobalState("enableMcpServerCreation", message.bool ?? true)
				await this.provider.postStateToWebview()
				break

			case "updateMcpTimeout":
				if (message.serverName && typeof message.timeout === "number") {
					try {
						await this.provider.getMcpHub()?.updateServerTimeout(message.serverName, message.timeout)
					} catch (error) {
						this.provider.outputChannel.appendLine(
							`Failed to update timeout for ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to update server timeout")
					}
				}
				break
		}
	}

	/**
	 * Handle sound-related messages
	 */
	async handleSoundMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "playSound":
				if (message.audioType) {
					const soundPath = path.join(
						this.provider.context.extensionPath,
						"audio",
						`${message.audioType}.wav`,
					)
					playSound(soundPath)
				}
				break

			case "soundEnabled":
				const soundEnabled = message.bool ?? true
				await this.provider.settingsManager.updateGlobalState("soundEnabled", soundEnabled)
				setSoundEnabled(soundEnabled)
				await this.provider.postStateToWebview()
				break

			case "soundVolume":
				const soundVolume = message.value ?? 0.5
				await this.provider.settingsManager.updateGlobalState("soundVolume", soundVolume)
				setSoundVolume(soundVolume)
				await this.provider.postStateToWebview()
				break
		}
	}

	/**
	 * Handle file and UI interaction messages
	 */
	async handleFileAndUiMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "selectImages":
				const images = await selectImages()
				await this.provider.postMessageToWebview({ type: "selectedImages", images })
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
				const customModesFilePath = await this.provider.customModesManager.getCustomModesFilePath()
				if (customModesFilePath) {
					openFile(customModesFilePath)
				}
				break
			}
		}
	}

	/**
	 * Handle custom modes-related messages
	 */
	async handleCustomModeMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "updateCustomMode":
				if (message.modeConfig) {
					await this.provider.customModesManager.updateCustomMode(message.modeConfig.slug, message.modeConfig)
					// Update state after saving the mode
					const customModes = await this.provider.customModesManager.getCustomModes()
					await this.provider.settingsManager.updateGlobalState("customModes", customModes)
					await this.provider.settingsManager.updateGlobalState("mode", message.modeConfig.slug)
					await this.provider.postStateToWebview()
				}
				break

			case "deleteCustomMode":
				if (message.slug) {
					const answer = await vscode.window.showInformationMessage(
						"Are you sure you want to delete this custom mode?",
						{ modal: true },
						"Yes",
					)

					if (answer !== "Yes") {
						break
					}

					await this.provider.customModesManager.deleteCustomMode(message.slug)
					// Switch back to default mode after deletion
					await this.provider.settingsManager.updateGlobalState("mode", "default")
					await this.provider.postStateToWebview()
				}
				break
		}
	}

	/**
	 * Handle prompt-related messages
	 */
	async handlePromptMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "updateSupportPrompt":
				try {
					if (Object.keys(message?.values ?? {}).length === 0) {
						return
					}

					const existingPrompts =
						(await this.provider.settingsManager.getGlobalState("customSupportPrompts")) || {}

					const updatedPrompts = {
						...existingPrompts,
						...message.values,
					}

					await this.provider.settingsManager.updateGlobalState("customSupportPrompts", updatedPrompts)
					await this.provider.postStateToWebview()
				} catch (error) {
					this.provider.outputChannel.appendLine(
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

					const existingPrompts = ((await this.provider.settingsManager.getGlobalState(
						"customSupportPrompts",
					)) || {}) as Record<string, any>

					const updatedPrompts = {
						...existingPrompts,
					}

					updatedPrompts[message.text] = undefined

					await this.provider.settingsManager.updateGlobalState("customSupportPrompts", updatedPrompts)
					await this.provider.postStateToWebview()
				} catch (error) {
					this.provider.outputChannel.appendLine(
						`Error reset support prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage("Failed to reset support prompt")
				}
				break

			case "updatePrompt":
				if (message.promptMode && message.customPrompt !== undefined) {
					const existingPrompts =
						(await this.provider.settingsManager.getGlobalState("customModePrompts")) || {}

					const updatedPrompts = {
						...existingPrompts,
						[message.promptMode]: message.customPrompt,
					}

					await this.provider.settingsManager.updateGlobalState("customModePrompts", updatedPrompts)

					// Get current state and explicitly include customModePrompts
					const currentState = await this.provider.getState()

					const stateWithPrompts = {
						...currentState,
						customModePrompts: updatedPrompts,
					}

					// Post state with prompts
					this.provider.view?.webview.postMessage({
						type: "state",
						state: stateWithPrompts,
					})
				}
				break

			case "enhancePrompt":
				if (message.text) {
					try {
						const { apiConfiguration, customSupportPrompts, listApiConfigMeta, enhancementApiConfigId } =
							await this.provider.getState()

						// Try to get enhancement config first, fall back to current config
						let configToUse: ApiConfiguration = apiConfiguration
						if (enhancementApiConfigId) {
							const config = listApiConfigMeta?.find((c: any) => c.id === enhancementApiConfigId)
							if (config?.name) {
								const loadedConfig = await this.provider.configManager.loadConfig(config.name)
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

						await this.provider.postMessageToWebview({
							type: "enhancedPrompt",
							text: enhancedPrompt,
						})
					} catch (error) {
						this.provider.outputChannel.appendLine(
							`Error enhancing prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to enhance prompt")
						await this.provider.postMessageToWebview({
							type: "enhancedPrompt",
						})
					}
				}
				break

			case "getSystemPrompt":
				try {
					const systemPrompt = await this.generateSystemPrompt(message)

					await this.provider.postMessageToWebview({
						type: "systemPrompt",
						text: systemPrompt,
						mode: message.mode,
					})
				} catch (error) {
					this.provider.outputChannel.appendLine(
						`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage("Failed to get system prompt")
				}
				break

			case "copySystemPrompt":
				try {
					const systemPrompt = await this.generateSystemPrompt(message)

					await vscode.env.clipboard.writeText(systemPrompt)
					await vscode.window.showInformationMessage("System prompt successfully copied to clipboard")
				} catch (error) {
					this.provider.outputChannel.appendLine(
						`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage("Failed to get system prompt")
				}
				break
		}
	}

	/**
	 * Handle experimental features messages
	 */
	async handleExperimentalMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "updateExperimental": {
				if (!message.values) {
					break
				}

				const updatedExperiments = {
					...((await this.provider.settingsManager.getGlobalState("experiments")) ??
						this.provider.experimentDefault),
					...message.values,
				} as Record<string, boolean>

				await this.provider.settingsManager.updateGlobalState("experiments", updatedExperiments)

				// Update diffStrategy in current Cline instance if it exists
				if (message.values[EXPERIMENT_IDS.DIFF_STRATEGY] !== undefined && this.provider.cline) {
					await this.provider.cline.updateDiffStrategy(updatedExperiments[EXPERIMENT_IDS.DIFF_STRATEGY])
				}

				await this.provider.postStateToWebview()
				break
			}
		}
	}

	/**
	 * Handle miscellaneous messages
	 */
	async handleMiscMessages(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "resetState":
				await this.provider.resetState()
				break

			case "searchCommits": {
				const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
				if (cwd) {
					try {
						const commits = await searchCommits(message.query || "", cwd)
						await this.provider.postMessageToWebview({
							type: "commitSearchResults",
							commits,
						})
					} catch (error) {
						this.provider.outputChannel.appendLine(
							`Error searching commits: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to search commits")
					}
				}
				break
			}
		}
	}

	/**
	 * Handle message deletion
	 */
	private async handleDeleteMessage(message: WebviewMessage): Promise<void> {
		const answer = await vscode.window.showInformationMessage(
			"What would you like to delete?",
			{ modal: true },
			"Just this message",
			"This and all subsequent messages",
		)

		if (
			(answer === "Just this message" || answer === "This and all subsequent messages") &&
			this.provider.cline &&
			typeof message.value === "number" &&
			message.value
		) {
			const timeCutoff = message.value - 1000 // 1 second buffer before the message to delete
			const messageIndex = this.provider.cline.clineMessages.findIndex((msg) => msg.ts && msg.ts >= timeCutoff)
			const apiConversationHistoryIndex = this.provider.cline.apiConversationHistory.findIndex(
				(msg) => msg.ts && msg.ts >= timeCutoff,
			)

			if (messageIndex !== -1) {
				const { historyItem } = await this.provider.taskHistoryManager.getTaskWithId(this.provider.cline.taskId)

				if (answer === "Just this message") {
					// Find the next user message first
					const nextUserMessage = this.provider.cline.clineMessages
						.slice(messageIndex + 1)
						.find((msg) => msg.type === "say" && msg.say === "user_feedback")

					// Handle UI messages
					if (nextUserMessage) {
						// Find absolute index of next user message
						const nextUserMessageIndex = this.provider.cline.clineMessages.findIndex(
							(msg) => msg === nextUserMessage,
						)
						// Keep messages before current message and after next user message
						await this.provider.cline.overwriteClineMessages([
							...this.provider.cline.clineMessages.slice(0, messageIndex),
							...this.provider.cline.clineMessages.slice(nextUserMessageIndex),
						])
					} else {
						// If no next user message, keep only messages before current message
						await this.provider.cline.overwriteClineMessages(
							this.provider.cline.clineMessages.slice(0, messageIndex),
						)
					}

					// Handle API messages
					if (apiConversationHistoryIndex !== -1) {
						if (nextUserMessage && nextUserMessage.ts) {
							// Keep messages before current API message and after next user message
							await this.provider.cline.overwriteApiConversationHistory([
								...this.provider.cline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
								...this.provider.cline.apiConversationHistory.filter(
									(msg) => msg.ts && msg.ts >= nextUserMessage.ts,
								),
							])
						} else {
							// If no next user message, keep only messages before current API message
							await this.provider.cline.overwriteApiConversationHistory(
								this.provider.cline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
							)
						}
					}
				} else if (answer === "This and all subsequent messages") {
					// Delete this message and all that follow
					await this.provider.cline.overwriteClineMessages(
						this.provider.cline.clineMessages.slice(0, messageIndex),
					)
					if (apiConversationHistoryIndex !== -1) {
						await this.provider.cline.overwriteApiConversationHistory(
							this.provider.cline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
						)
					}
				}

				await this.provider.initClineWithHistoryItem(historyItem)
			}
		}
	}

	/**
	 * Generate system prompt for the given message
	 */
	private async generateSystemPrompt(message: WebviewMessage): Promise<string> {
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
		} = await this.provider.getState()

		// Create diffStrategy based on current model and settings
		const diffStrategy = this.provider.getDiffStrategy(
			apiConfiguration.apiModelId || apiConfiguration.openRouterModelId || "",
			fuzzyMatchThreshold,
			experiments[EXPERIMENT_IDS.DIFF_STRATEGY],
		)

		const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) || ""

		const mode = message.mode ?? "default"
		const customModes = await this.provider.customModesManager.getCustomModes()

		const systemPrompt = await this.provider.getSystemPrompt(
			cwd,
			apiConfiguration.openRouterModelInfo?.supportsComputerUse ?? false,
			mcpEnabled ? this.provider.getMcpHub() : undefined,
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
