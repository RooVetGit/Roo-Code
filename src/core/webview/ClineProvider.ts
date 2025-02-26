import { Anthropic } from "@anthropic-ai/sdk"
import delay from "delay"
import axios from "axios"
import fs from "fs/promises"
import os from "os"
import pWaitFor from "p-wait-for"
import * as path from "path"
import * as vscode from "vscode"
import simpleGit from "simple-git"

import { SettingsManager, SecretKey, GlobalStateKey } from "../settings/SettingsManager"
import { ModelManager } from "../models/ModelManager"
import { TaskHistoryManager } from "../tasks/TaskHistoryManager"
import { WebviewManager } from "./WebviewManager"
import { WebviewCommandRegistry } from "./commands/WebviewCommandRegistry"
import { BrowserManager } from "../browser/BrowserManager"
import { SettingsCommandHandler } from "./commands/SettingsCommandHandler"
import { TaskCommandHandler } from "./commands/TaskCommandHandler"
import { TaskHistoryCommandHandler } from "./commands/TaskHistoryCommandHandler"
import { ModelCommandHandler } from "./commands/ModelCommandHandler"
import { ApiConfigCommandHandler } from "./commands/ApiConfigCommandHandler"
import { McpCommandHandler } from "./commands/McpCommandHandler"
import { MiscCommandHandler } from "./commands/MiscCommandHandler"
import { PromptCommandHandler } from "./commands/PromptCommandHandler"
import { CustomModeCommandHandler } from "./commands/CustomModeCommandHandler"
import { WebviewInitCommandHandler } from "./commands/WebviewInitCommandHandler"

import { buildApiHandler } from "../../api"
import { downloadTask } from "../../integrations/misc/export-markdown"
import { openFile, openImage } from "../../integrations/misc/open-file"
import { selectImages } from "../../integrations/misc/process-images"
import { getTheme } from "../../integrations/theme/getTheme"
import { getDiffStrategy } from "../diff/DiffStrategy"
import WorkspaceTracker from "../../integrations/workspace/WorkspaceTracker"
import { McpHub } from "../../services/mcp/McpHub"
import { ApiConfiguration, ApiProvider, ModelInfo } from "../../shared/api"
import { findLast } from "../../shared/array"
import { ApiConfigMeta, ExtensionMessage } from "../../shared/ExtensionMessage"
import { HistoryItem } from "../../shared/HistoryItem"
import { checkoutDiffPayloadSchema, checkoutRestorePayloadSchema, WebviewMessage } from "../../shared/WebviewMessage"
import { Mode, CustomModePrompts, PromptComponent, defaultModeSlug } from "../../shared/modes"
import { SystemPromptGenerator } from "../prompts/SystemPromptGenerator"
import { fileExistsAtPath } from "../../utils/fs"
import { Cline } from "../Cline"
import { openMention } from "../mentions"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { playSound, setSoundEnabled, setSoundVolume } from "../../utils/sound"
import { checkExistKey } from "../../shared/checkExistApiConfig"
import { singleCompletionHandler } from "../../utils/single-completion-handler"
import { searchCommits } from "../../utils/git"
import { ConfigManager } from "../config/ConfigManager"
import { CustomModesManager } from "../config/CustomModesManager"
import {
	EXPERIMENT_IDS,
	experiments as Experiments,
	experimentDefault as expDefault,
	ExperimentId,
} from "../../shared/experiments"
import { CustomSupportPrompts, supportPrompt } from "../../shared/support-prompt"

import { ACTION_NAMES } from "../CodeActionProvider"
import { McpServerManager } from "../../services/mcp/McpServerManager"
import { ServiceLocator } from "../ServiceLocator"

/*
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts

https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
*/

export const GlobalFileNames = {
	mcpSettings: "cline_mcp_settings.json",
}

export class ClineProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = "roo-cline.SidebarProvider" // used in package.json as the view's id. This value cannot be changed due to how vscode caches views based on their id, and updating the id would break existing instances of the extension.
	public static readonly tabPanelId = "roo-cline.TabPanelProvider"
	private static activeInstances: Set<ClineProvider> = new Set()
	private disposables: vscode.Disposable[] = []
	public view?: vscode.WebviewView | vscode.WebviewPanel
	public isViewLaunched = false
	public cline?: Cline
	public workspaceTracker?: WorkspaceTracker
	protected mcpHub?: McpHub // Change from private to protected
	public latestAnnouncementId = "jan-21-2025-custom-modes" // update to some unique identifier when we add a new announcement
	configManager: ConfigManager
	customModesManager: CustomModesManager
	public settingsManager: SettingsManager
	public modelManager: ModelManager
	public taskHistoryManager: TaskHistoryManager
	private webviewManager: WebviewManager
	private commandRegistry: WebviewCommandRegistry
	public experimentDefault = expDefault
	private systemPromptGenerator: SystemPromptGenerator
	public browserManager: BrowserManager

	/**
	 * Register command handlers for different message types
	 */
	private registerCommandHandlers() {
		// Register settings-related command handlers
		this.commandRegistry.register("customInstructions", new SettingsCommandHandler())
		this.commandRegistry.register("alwaysAllowReadOnly", new SettingsCommandHandler())
		this.commandRegistry.register("alwaysAllowWrite", new SettingsCommandHandler())
		this.commandRegistry.register("alwaysAllowExecute", new SettingsCommandHandler())
		this.commandRegistry.register("alwaysAllowBrowser", new SettingsCommandHandler())
		this.commandRegistry.register("alwaysAllowMcp", new SettingsCommandHandler())
		this.commandRegistry.register("alwaysAllowModeSwitch", new SettingsCommandHandler())
		this.commandRegistry.register("diffEnabled", new SettingsCommandHandler())
		this.commandRegistry.register("checkpointsEnabled", new SettingsCommandHandler())
		this.commandRegistry.register("browserViewportSize", new SettingsCommandHandler())
		this.commandRegistry.register("fuzzyMatchThreshold", new SettingsCommandHandler())
		this.commandRegistry.register("alwaysApproveResubmit", new SettingsCommandHandler())
		this.commandRegistry.register("requestDelaySeconds", new SettingsCommandHandler())
		this.commandRegistry.register("rateLimitSeconds", new SettingsCommandHandler())
		this.commandRegistry.register("preferredLanguage", new SettingsCommandHandler())
		this.commandRegistry.register("writeDelayMs", new SettingsCommandHandler())
		this.commandRegistry.register("terminalOutputLineLimit", new SettingsCommandHandler())
		this.commandRegistry.register("screenshotQuality", new SettingsCommandHandler())
		this.commandRegistry.register("maxOpenTabsContext", new SettingsCommandHandler())
		this.commandRegistry.register("enhancementApiConfigId", new SettingsCommandHandler())
		this.commandRegistry.register("autoApprovalEnabled", new SettingsCommandHandler())
		this.commandRegistry.register("mode", new SettingsCommandHandler())
		this.commandRegistry.register("allowedCommands", new SettingsCommandHandler())

		// Register task-related command handlers
		this.commandRegistry.register("newTask", new TaskCommandHandler())
		this.commandRegistry.register("clearTask", new TaskCommandHandler())
		this.commandRegistry.register("cancelTask", new TaskCommandHandler())
		this.commandRegistry.register("askResponse", new TaskCommandHandler())
		this.commandRegistry.register("deleteMessage", new TaskCommandHandler())
		this.commandRegistry.register("exportCurrentTask", new TaskCommandHandler())
		this.commandRegistry.register("checkpointDiff", new TaskCommandHandler())
		this.commandRegistry.register("checkpointRestore", new TaskCommandHandler())

		// Register task history-related command handlers
		this.commandRegistry.register("showTaskWithId", new TaskHistoryCommandHandler())
		this.commandRegistry.register("deleteTaskWithId", new TaskHistoryCommandHandler())
		this.commandRegistry.register("exportTaskWithId", new TaskHistoryCommandHandler())

		// Register model-related command handlers
		this.commandRegistry.register("requestOllamaModels", new ModelCommandHandler())
		this.commandRegistry.register("requestLmStudioModels", new ModelCommandHandler())
		this.commandRegistry.register("requestVsCodeLmModels", new ModelCommandHandler())
		this.commandRegistry.register("refreshGlamaModels", new ModelCommandHandler())
		this.commandRegistry.register("refreshOpenRouterModels", new ModelCommandHandler())
		this.commandRegistry.register("refreshOpenAiModels", new ModelCommandHandler())
		this.commandRegistry.register("refreshUnboundModels", new ModelCommandHandler())
		this.commandRegistry.register("refreshRequestyModels", new ModelCommandHandler())

		// Register API configuration-related command handlers
		this.commandRegistry.register("apiConfiguration", new ApiConfigCommandHandler())
		this.commandRegistry.register("saveApiConfiguration", new ApiConfigCommandHandler())
		this.commandRegistry.register("upsertApiConfiguration", new ApiConfigCommandHandler())
		this.commandRegistry.register("renameApiConfiguration", new ApiConfigCommandHandler())
		this.commandRegistry.register("loadApiConfiguration", new ApiConfigCommandHandler())
		this.commandRegistry.register("deleteApiConfiguration", new ApiConfigCommandHandler())
		this.commandRegistry.register("getListApiConfiguration", new ApiConfigCommandHandler())

		// Register MCP-related command handlers
		this.commandRegistry.register("openMcpSettings", new McpCommandHandler())
		this.commandRegistry.register("deleteMcpServer", new McpCommandHandler())
		this.commandRegistry.register("restartMcpServer", new McpCommandHandler())
		this.commandRegistry.register("toggleToolAlwaysAllow", new McpCommandHandler())
		this.commandRegistry.register("toggleMcpServer", new McpCommandHandler())
		this.commandRegistry.register("mcpEnabled", new McpCommandHandler())
		this.commandRegistry.register("enableMcpServerCreation", new McpCommandHandler())
		this.commandRegistry.register("updateMcpTimeout", new McpCommandHandler())

		// Register miscellaneous command handlers
		this.commandRegistry.register("selectImages", new MiscCommandHandler())
		this.commandRegistry.register("openImage", new MiscCommandHandler())
		this.commandRegistry.register("openFile", new MiscCommandHandler())
		this.commandRegistry.register("openMention", new MiscCommandHandler())
		this.commandRegistry.register("openCustomModesSettings", new MiscCommandHandler())
		this.commandRegistry.register("playSound", new MiscCommandHandler())
		this.commandRegistry.register("soundEnabled", new MiscCommandHandler())
		this.commandRegistry.register("soundVolume", new MiscCommandHandler())
		this.commandRegistry.register("updateExperimental", new MiscCommandHandler())
		this.commandRegistry.register("resetState", new MiscCommandHandler())
		this.commandRegistry.register("searchCommits", new MiscCommandHandler())
		this.commandRegistry.register("webviewDidLaunch", new MiscCommandHandler())

		// Register prompt-related command handlers
		this.commandRegistry.register("updateSupportPrompt", new PromptCommandHandler())
		this.commandRegistry.register("resetSupportPrompt", new PromptCommandHandler())
		this.commandRegistry.register("updatePrompt", new PromptCommandHandler())
		this.commandRegistry.register("enhancePrompt", new PromptCommandHandler())
		this.commandRegistry.register("getSystemPrompt", new PromptCommandHandler())
		this.commandRegistry.register("copySystemPrompt", new PromptCommandHandler())

		// Register custom mode-related command handlers
		this.commandRegistry.register("updateCustomMode", new CustomModeCommandHandler())
		this.commandRegistry.register("deleteCustomMode", new CustomModeCommandHandler())

		// Register webview initialization-related command handlers
		this.commandRegistry.register("didShowAnnouncement", new WebviewInitCommandHandler())
	}

	constructor(
		readonly context: vscode.ExtensionContext,
		readonly outputChannel: vscode.OutputChannel,
	) {
		this.outputChannel.appendLine("ClineProvider instantiated")
		ClineProvider.activeInstances.add(this)

		// Initialize all dependencies
		this.workspaceTracker = new WorkspaceTracker(this)
		this.configManager = new ConfigManager(this.context)
		this.customModesManager = new CustomModesManager(this.context, async () => {
			await this.postStateToWebview()
		})
		this.settingsManager = new SettingsManager(this.context)
		this.modelManager = new ModelManager(this.context, this.outputChannel, this.settingsManager)
		this.taskHistoryManager = new TaskHistoryManager(this.context, this.settingsManager, this.outputChannel)
		this.webviewManager = new WebviewManager(this.context, this.outputChannel)
		this.commandRegistry = new WebviewCommandRegistry()
		this.systemPromptGenerator = new SystemPromptGenerator(this.context)
		this.browserManager = new BrowserManager(this.context, this.outputChannel)

		// Register all services with the ServiceLocator
		const serviceLocator = ServiceLocator.getInstance()
		serviceLocator.register("context", this.context)
		serviceLocator.register("outputChannel", this.outputChannel)
		serviceLocator.register("settingsManager", this.settingsManager)
		serviceLocator.register("modelManager", this.modelManager)
		serviceLocator.register("taskHistoryManager", this.taskHistoryManager)
		serviceLocator.register("webviewManager", this.webviewManager)
		serviceLocator.register("commandRegistry", this.commandRegistry)
		serviceLocator.register("systemPromptGenerator", this.systemPromptGenerator)
		serviceLocator.register("browserManager", this.browserManager)
		serviceLocator.register("configManager", this.configManager)
		serviceLocator.register("customModesManager", this.customModesManager)
		serviceLocator.register("clineProvider", this)

		this.registerCommandHandlers()

		// Initialize MCP Hub through the singleton manager
		McpServerManager.getInstance(this.context, this)
			.then((hub) => {
				this.mcpHub = hub
				// Register McpHub with ServiceLocator once it's available
				serviceLocator.register("mcpHub", hub)
			})
			.catch((error) => {
				this.outputChannel.appendLine(`Failed to initialize MCP Hub: ${error}`)
			})
	}

	/*
	VSCode extensions use the disposable pattern to clean up resources when the sidebar/editor tab is closed by the user or system. This applies to event listening, commands, interacting with the UI, etc.
	- https://vscode-docs.readthedocs.io/en/stable/extensions/patterns-and-principles/
	- https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	*/
	async dispose() {
		this.outputChannel.appendLine("Disposing ClineProvider...")
		await this.clearTask()
		this.outputChannel.appendLine("Cleared task")
		if (this.view && "dispose" in this.view) {
			this.view.dispose()
			this.outputChannel.appendLine("Disposed webview")
		}
		while (this.disposables.length) {
			const x = this.disposables.pop()
			if (x) {
				x.dispose()
			}
		}
		this.workspaceTracker?.dispose()
		this.workspaceTracker = undefined
		this.mcpHub?.dispose()
		this.mcpHub = undefined
		this.customModesManager?.dispose()
		this.outputChannel.appendLine("Disposed all disposables")
		ClineProvider.activeInstances.delete(this)

		// Unregister from McpServerManager
		McpServerManager.unregisterProvider(this)
	}

	public static getVisibleInstance(): ClineProvider | undefined {
		return findLast(Array.from(this.activeInstances), (instance) => instance.view?.visible === true)
	}

	public static async getInstance(): Promise<ClineProvider | undefined> {
		let visibleProvider = ClineProvider.getVisibleInstance()

		// If no visible provider, try to show the sidebar view
		if (!visibleProvider) {
			await vscode.commands.executeCommand("roo-cline.SidebarProvider.focus")
			// Wait briefly for the view to become visible
			await delay(100)
			visibleProvider = ClineProvider.getVisibleInstance()
		}

		// If still no visible provider, return
		if (!visibleProvider) {
			return
		}

		return visibleProvider
	}

	public static async isActiveTask(): Promise<boolean> {
		const visibleProvider = await ClineProvider.getInstance()
		if (!visibleProvider) {
			return false
		}

		if (visibleProvider.cline) {
			return true
		}

		return false
	}

	public static async handleCodeAction(
		command: string,
		promptType: keyof typeof ACTION_NAMES,
		params: Record<string, string | any[]>,
	): Promise<void> {
		const visibleProvider = await ClineProvider.getInstance()
		if (!visibleProvider) {
			return
		}

		const { customSupportPrompts } = await visibleProvider.getState()

		const prompt = supportPrompt.create(promptType, params, customSupportPrompts)

		if (command.endsWith("addToContext")) {
			await visibleProvider.postMessageToWebview({
				type: "invoke",
				invoke: "setChatBoxMessage",
				text: prompt,
			})

			return
		}

		if (visibleProvider.cline && command.endsWith("InCurrentTask")) {
			await visibleProvider.postMessageToWebview({
				type: "invoke",
				invoke: "sendMessage",
				text: prompt,
			})

			return
		}

		await visibleProvider.initClineWithTask(prompt)
	}

	public static async handleTerminalAction(
		command: string,
		promptType: "TERMINAL_ADD_TO_CONTEXT" | "TERMINAL_FIX" | "TERMINAL_EXPLAIN",
		params: Record<string, string | any[]>,
	): Promise<void> {
		const visibleProvider = await ClineProvider.getInstance()
		if (!visibleProvider) {
			return
		}

		const { customSupportPrompts } = await visibleProvider.getState()

		const prompt = supportPrompt.create(promptType, params, customSupportPrompts)

		if (command.endsWith("AddToContext")) {
			await visibleProvider.postMessageToWebview({
				type: "invoke",
				invoke: "setChatBoxMessage",
				text: prompt,
			})
			return
		}

		if (visibleProvider.cline && command.endsWith("InCurrentTask")) {
			await visibleProvider.postMessageToWebview({
				type: "invoke",
				invoke: "sendMessage",
				text: prompt,
			})
			return
		}

		await visibleProvider.initClineWithTask(prompt)
	}

	async resolveWebviewView(webviewView: vscode.WebviewView | vscode.WebviewPanel) {
		this.outputChannel.appendLine("Resolving webview view")
		this.view = webviewView

		// Initialize sound enabled state
		this.getState().then(({ soundEnabled }) => {
			setSoundEnabled(soundEnabled ?? false)
		})

		// Use WebviewManager to resolve the webview view
		await this.webviewManager.resolveWebviewView(
			webviewView,
			async (message) => {
				// Delegate message handling to command registry
				try {
					// Execute the appropriate command handler for this message type
					await this.commandRegistry.execute(message, this)
				} catch (error) {
					this.outputChannel.appendLine(
						`Error handling webview message: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage("An error occurred while processing your request")
				}
			},
			this.disposables,
		)

		// Add custom dispose handler
		webviewView.onDidDispose(
			async () => {
				await this.dispose()
			},
			null,
			this.disposables,
		)

		// Add theme change handler
		vscode.workspace.onDidChangeConfiguration(
			async (e) => {
				if (e && e.affectsConfiguration("workbench.colorTheme")) {
					// Sends latest theme name to webview
					await this.postMessageToWebview({ type: "theme", text: JSON.stringify(await getTheme()) })
				}
			},
			null,
			this.disposables,
		)

		// if the extension is starting a new session, clear previous task state
		this.clearTask()

		this.outputChannel.appendLine("Webview view resolved")
	}

	public async initClineWithTask(task?: string, images?: string[]) {
		await this.clearTask()
		const {
			apiConfiguration,
			customModePrompts,
			diffEnabled,
			checkpointsEnabled,
			fuzzyMatchThreshold,
			mode,
			customInstructions: globalInstructions,
			experiments,
		} = await this.getState()

		const modePrompt = customModePrompts?.[mode] as PromptComponent
		const effectiveInstructions = [globalInstructions, modePrompt?.customInstructions].filter(Boolean).join("\n\n")

		this.cline = new Cline({
			provider: this,
			apiConfiguration,
			customInstructions: effectiveInstructions,
			enableDiff: diffEnabled,
			enableCheckpoints: checkpointsEnabled,
			fuzzyMatchThreshold,
			task,
			images,
			experiments,
		})
	}

	public async initClineWithHistoryItem(historyItem: HistoryItem) {
		await this.clearTask()

		const {
			apiConfiguration,
			customModePrompts,
			diffEnabled,
			checkpointsEnabled,
			fuzzyMatchThreshold,
			mode,
			customInstructions: globalInstructions,
			experiments,
		} = await this.getState()

		const modePrompt = customModePrompts?.[mode] as PromptComponent
		const effectiveInstructions = [globalInstructions, modePrompt?.customInstructions].filter(Boolean).join("\n\n")

		this.cline = new Cline({
			provider: this,
			apiConfiguration,
			customInstructions: effectiveInstructions,
			enableDiff: diffEnabled,
			enableCheckpoints: checkpointsEnabled,
			fuzzyMatchThreshold,
			historyItem,
			experiments,
		})
	}

	public async postMessageToWebview(message: ExtensionMessage) {
		await this.webviewManager.postMessageToWebview(this.view, message)
		// For testing purposes, also call the webview's postMessage directly
		await this.view?.webview.postMessage(message)
	}

	/**
	 * Handle switching to a new mode, including updating the associated API configuration
	 * @param newMode The mode to switch to
	 */
	public async handleModeSwitch(newMode: Mode) {
		await this.updateGlobalState("mode", newMode)

		// Load the saved API config for the new mode if it exists
		const savedConfigId = await this.configManager.getModeConfigId(newMode)
		const listApiConfig = await this.configManager.listConfig()

		// Update listApiConfigMeta first to ensure UI has latest data
		await this.updateGlobalState("listApiConfigMeta", listApiConfig)

		// If this mode has a saved config, use it
		if (savedConfigId) {
			const config = listApiConfig?.find((c) => c.id === savedConfigId)
			if (config?.name) {
				const apiConfig = await this.configManager.loadConfig(config.name)
				await Promise.all([
					this.updateGlobalState("currentApiConfigName", config.name),
					this.updateApiConfiguration(apiConfig),
				])
			}
		} else {
			// If no saved config for this mode, save current config as default
			const currentApiConfigName = await this.getGlobalState("currentApiConfigName")
			if (currentApiConfigName) {
				const config = listApiConfig?.find((c) => c.name === currentApiConfigName)
				if (config?.id) {
					await this.configManager.setModeConfig(newMode, config.id)
				}
			}
		}

		await this.postStateToWebview()
	}

	public async updateApiConfiguration(apiConfiguration: ApiConfiguration) {
		// Update mode's default config
		const { mode } = await this.getState()
		if (mode) {
			const currentApiConfigName = await this.getGlobalState("currentApiConfigName")
			const listApiConfig = await this.configManager.listConfig()
			const config = listApiConfig?.find((c) => c.name === currentApiConfigName)
			if (config?.id) {
				await this.configManager.setModeConfig(mode, config.id)
			}
		}

		const {
			apiProvider,
			apiModelId,
			apiKey,
			glamaModelId,
			glamaModelInfo,
			glamaApiKey,
			openRouterApiKey,
			awsAccessKey,
			awsSecretKey,
			awsSessionToken,
			awsRegion,
			awsUseCrossRegionInference,
			awsProfile,
			awsUseProfile,
			vertexProjectId,
			vertexRegion,
			openAiBaseUrl,
			openAiApiKey,
			openAiModelId,
			openAiCustomModelInfo,
			openAiUseAzure,
			ollamaModelId,
			ollamaBaseUrl,
			lmStudioModelId,
			lmStudioBaseUrl,
			anthropicBaseUrl,
			geminiApiKey,
			openAiNativeApiKey,
			deepSeekApiKey,
			azureApiVersion,
			openAiStreamingEnabled,
			openRouterModelId,
			openRouterBaseUrl,
			openRouterModelInfo,
			openRouterUseMiddleOutTransform,
			vsCodeLmModelSelector,
			mistralApiKey,
			mistralCodestralUrl,
			unboundApiKey,
			unboundModelId,
			unboundModelInfo,
			requestyApiKey,
			requestyModelId,
			requestyModelInfo,
			modelTemperature,
		} = apiConfiguration
		await Promise.all([
			this.updateGlobalState("apiProvider", apiProvider),
			this.updateGlobalState("apiModelId", apiModelId),
			this.storeSecret("apiKey", apiKey),
			this.updateGlobalState("glamaModelId", glamaModelId),
			this.updateGlobalState("glamaModelInfo", glamaModelInfo),
			this.storeSecret("glamaApiKey", glamaApiKey),
			this.storeSecret("openRouterApiKey", openRouterApiKey),
			this.storeSecret("awsAccessKey", awsAccessKey),
			this.storeSecret("awsSecretKey", awsSecretKey),
			this.storeSecret("awsSessionToken", awsSessionToken),
			this.updateGlobalState("awsRegion", awsRegion),
			this.updateGlobalState("awsUseCrossRegionInference", awsUseCrossRegionInference),
			this.updateGlobalState("awsProfile", awsProfile),
			this.updateGlobalState("awsUseProfile", awsUseProfile),
			this.updateGlobalState("vertexProjectId", vertexProjectId),
			this.updateGlobalState("vertexRegion", vertexRegion),
			this.updateGlobalState("openAiBaseUrl", openAiBaseUrl),
			this.storeSecret("openAiApiKey", openAiApiKey),
			this.updateGlobalState("openAiModelId", openAiModelId),
			this.updateGlobalState("openAiCustomModelInfo", openAiCustomModelInfo),
			this.updateGlobalState("openAiUseAzure", openAiUseAzure),
			this.updateGlobalState("ollamaModelId", ollamaModelId),
			this.updateGlobalState("ollamaBaseUrl", ollamaBaseUrl),
			this.updateGlobalState("lmStudioModelId", lmStudioModelId),
			this.updateGlobalState("lmStudioBaseUrl", lmStudioBaseUrl),
			this.updateGlobalState("anthropicBaseUrl", anthropicBaseUrl),
			this.storeSecret("geminiApiKey", geminiApiKey),
			this.storeSecret("openAiNativeApiKey", openAiNativeApiKey),
			this.storeSecret("deepSeekApiKey", deepSeekApiKey),
			this.updateGlobalState("azureApiVersion", azureApiVersion),
			this.updateGlobalState("openAiStreamingEnabled", openAiStreamingEnabled),
			this.updateGlobalState("openRouterModelId", openRouterModelId),
			this.updateGlobalState("openRouterModelInfo", openRouterModelInfo),
			this.updateGlobalState("openRouterBaseUrl", openRouterBaseUrl),
			this.updateGlobalState("openRouterUseMiddleOutTransform", openRouterUseMiddleOutTransform),
			this.updateGlobalState("vsCodeLmModelSelector", vsCodeLmModelSelector),
			this.storeSecret("mistralApiKey", mistralApiKey),
			this.updateGlobalState("mistralCodestralUrl", mistralCodestralUrl),
			this.storeSecret("unboundApiKey", unboundApiKey),
			this.updateGlobalState("unboundModelId", unboundModelId),
			this.updateGlobalState("unboundModelInfo", unboundModelInfo),
			this.storeSecret("requestyApiKey", requestyApiKey),
			this.updateGlobalState("requestyModelId", requestyModelId),
			this.updateGlobalState("requestyModelInfo", requestyModelInfo),
			this.updateGlobalState("modelTemperature", modelTemperature),
		])
		if (this.cline) {
			this.cline.api = buildApiHandler(apiConfiguration)
		}
	}

	async cancelTask() {
		if (this.cline) {
			const { historyItem } = await this.getTaskWithId(this.cline.taskId)
			this.cline.abortTask()

			await pWaitFor(
				() =>
					this.cline === undefined ||
					this.cline.isStreaming === false ||
					this.cline.didFinishAbortingStream ||
					// If only the first chunk is processed, then there's no
					// need to wait for graceful abort (closes edits, browser,
					// etc).
					this.cline.isWaitingForFirstChunk,
				{
					timeout: 3_000,
				},
			).catch(() => {
				console.error("Failed to abort task")
			})

			if (this.cline) {
				// 'abandoned' will prevent this Cline instance from affecting
				// future Cline instances. This may happen if its hanging on a
				// streaming request.
				this.cline.abandoned = true
			}

			// Clears task again, so we need to abortTask manually above.
			await this.initClineWithHistoryItem(historyItem)
		}
	}

	async updateCustomInstructions(instructions?: string) {
		// User may be clearing the field
		await this.updateGlobalState("customInstructions", instructions || undefined)
		if (this.cline) {
			this.cline.customInstructions = instructions || undefined
		}
		await this.postStateToWebview()
	}

	// MCP

	async ensureMcpServersDirectoryExists(): Promise<string> {
		const mcpServersDir = path.join(os.homedir(), "Documents", "Cline", "MCP")
		try {
			await fs.mkdir(mcpServersDir, { recursive: true })
		} catch (error) {
			return "~/Documents/Cline/MCP" // in case creating a directory in documents fails for whatever reason (e.g. permissions) - this is fine since this path is only ever used in the system prompt
		}
		return mcpServersDir
	}

	async ensureSettingsDirectoryExists(): Promise<string> {
		const settingsDir = path.join(this.context.globalStorageUri.fsPath, "settings")
		await fs.mkdir(settingsDir, { recursive: true })
		return settingsDir
	}

	// Model-related methods delegated to ModelManager

	async getOllamaModels(baseUrl?: string) {
		return this.modelManager.getOllamaModels(baseUrl)
	}

	async getLmStudioModels(baseUrl?: string) {
		return this.modelManager.getLmStudioModels(baseUrl)
	}

	private async getVsCodeLmModels() {
		return this.modelManager.getVsCodeLmModels()
	}

	async getOpenAiModels(baseUrl?: string, apiKey?: string) {
		return this.modelManager.getOpenAiModels(baseUrl, apiKey)
	}

	async readRequestyModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.modelManager.readRequestyModels()
	}

	async refreshRequestyModels(apiKey?: string) {
		const models = await this.modelManager.refreshRequestyModels(apiKey)
		await this.postMessageToWebview({ type: "requestyModels", requestyModels: models })
		return models
	}

	async handleOpenRouterCallback(code: string) {
		const apiKey = await this.modelManager.handleOpenRouterCallback(code)

		const openrouter: ApiProvider = "openrouter"
		await this.updateGlobalState("apiProvider", openrouter)
		await this.storeSecret("openRouterApiKey", apiKey)
		await this.postStateToWebview()
		if (this.cline) {
			this.cline.api = buildApiHandler({ apiProvider: openrouter, openRouterApiKey: apiKey })
		}
	}

	private async ensureCacheDirectoryExists(): Promise<string> {
		// This is still needed for other parts of the code
		const cacheDir = path.join(this.context.globalStorageUri.fsPath, "cache")
		await fs.mkdir(cacheDir, { recursive: true })
		return cacheDir
	}

	async handleGlamaCallback(code: string) {
		const apiKey = await this.modelManager.handleGlamaCallback(code)

		const glama: ApiProvider = "glama"
		await this.updateGlobalState("apiProvider", glama)
		await this.storeSecret("glamaApiKey", apiKey)
		await this.postStateToWebview()
		if (this.cline) {
			this.cline.api = buildApiHandler({
				apiProvider: glama,
				glamaApiKey: apiKey,
			})
		}
	}

	async readGlamaModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.modelManager.readGlamaModels()
	}

	async refreshGlamaModels() {
		const models = await this.modelManager.refreshGlamaModels()
		await this.postMessageToWebview({ type: "glamaModels", glamaModels: models })
		return models
	}

	async readOpenRouterModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.modelManager.readOpenRouterModels()
	}

	async refreshOpenRouterModels() {
		const models = await this.modelManager.refreshOpenRouterModels()
		await this.postMessageToWebview({ type: "openRouterModels", openRouterModels: models })
		return models
	}

	async readUnboundModels(): Promise<Record<string, ModelInfo> | undefined> {
		return this.modelManager.readUnboundModels()
	}

	async refreshUnboundModels() {
		const models = await this.modelManager.refreshUnboundModels()
		await this.postMessageToWebview({ type: "unboundModels", unboundModels: models })
		return models
	}

	// Task history

	async getTaskWithId(id: string) {
		return this.taskHistoryManager.getTaskWithId(id)
	}

	async showTaskWithId(id: string) {
		if (id !== this.cline?.taskId) {
			// non-current task
			const historyItem = await this.taskHistoryManager.showTaskWithId(id)
			await this.initClineWithHistoryItem(historyItem) // clears existing task
		}
		await this.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	async exportTaskWithId(id: string) {
		await this.taskHistoryManager.exportTaskWithId(id)
	}

	async deleteTaskWithId(id: string) {
		if (id === this.cline?.taskId) {
			await this.clearTask()
		}

		await this.taskHistoryManager.deleteTaskWithId(id)

		// Notify the webview that the task has been deleted
		await this.postStateToWebview()
	}

	async deleteTaskFromState(id: string) {
		await this.taskHistoryManager.deleteTaskFromState(id)

		// Notify the webview that the task has been deleted
		await this.postStateToWebview()
	}

	async postStateToWebview() {
		const state = await this.getStateToPostToWebview()
		this.postMessageToWebview({ type: "state", state })
	}

	async getStateToPostToWebview() {
		const {
			apiConfiguration,
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowExecute,
			alwaysAllowBrowser,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			soundEnabled,
			diffEnabled,
			checkpointsEnabled,
			taskHistory,
			soundVolume,
			browserViewportSize,
			screenshotQuality,
			preferredLanguage,
			writeDelayMs,
			terminalOutputLineLimit,
			fuzzyMatchThreshold,
			mcpEnabled,
			enableMcpServerCreation,
			alwaysApproveResubmit,
			requestDelaySeconds,
			rateLimitSeconds,
			currentApiConfigName,
			listApiConfigMeta,
			mode,
			customModePrompts,
			customSupportPrompts,
			enhancementApiConfigId,
			autoApprovalEnabled,
			experiments,
			maxOpenTabsContext,
		} = await this.getState()

		const allowedCommands = vscode.workspace.getConfiguration("roo-cline").get<string[]>("allowedCommands") || []

		return {
			version: this.context.extension?.packageJSON?.version ?? "",
			apiConfiguration,
			customInstructions,
			alwaysAllowReadOnly: alwaysAllowReadOnly ?? false,
			alwaysAllowWrite: alwaysAllowWrite ?? false,
			alwaysAllowExecute: alwaysAllowExecute ?? false,
			alwaysAllowBrowser: alwaysAllowBrowser ?? false,
			alwaysAllowMcp: alwaysAllowMcp ?? false,
			alwaysAllowModeSwitch: alwaysAllowModeSwitch ?? false,
			uriScheme: vscode.env.uriScheme,
			currentTaskItem: this.cline?.taskId
				? (taskHistory || []).find((item) => item.id === this.cline?.taskId)
				: undefined,
			clineMessages: this.cline?.clineMessages || [],
			taskHistory: (taskHistory || [])
				.filter((item: HistoryItem) => item.ts && item.task)
				.sort((a: HistoryItem, b: HistoryItem) => b.ts - a.ts),
			soundEnabled: soundEnabled ?? false,
			diffEnabled: diffEnabled ?? true,
			checkpointsEnabled: checkpointsEnabled ?? false,
			shouldShowAnnouncement: lastShownAnnouncementId !== this.latestAnnouncementId,
			allowedCommands,
			soundVolume: soundVolume ?? 0.5,
			browserViewportSize: browserViewportSize ?? "900x600",
			screenshotQuality: screenshotQuality ?? 75,
			preferredLanguage: preferredLanguage ?? "English",
			writeDelayMs: writeDelayMs ?? 1000,
			terminalOutputLineLimit: terminalOutputLineLimit ?? 500,
			fuzzyMatchThreshold: fuzzyMatchThreshold ?? 1.0,
			mcpEnabled: mcpEnabled ?? true,
			enableMcpServerCreation: enableMcpServerCreation ?? true,
			alwaysApproveResubmit: alwaysApproveResubmit ?? false,
			requestDelaySeconds: requestDelaySeconds ?? 10,
			rateLimitSeconds: rateLimitSeconds ?? 0,
			currentApiConfigName: currentApiConfigName ?? "default",
			listApiConfigMeta: listApiConfigMeta ?? [],
			mode: mode ?? defaultModeSlug,
			customModePrompts: customModePrompts ?? {},
			customSupportPrompts: customSupportPrompts ?? {},
			enhancementApiConfigId,
			autoApprovalEnabled: autoApprovalEnabled ?? false,
			customModes: await this.customModesManager.getCustomModes(),
			experiments: experiments ?? this.experimentDefault,
			mcpServers: this.mcpHub?.getAllServers() ?? [],
			maxOpenTabsContext: maxOpenTabsContext ?? 20,
		}
	}

	async clearTask() {
		this.cline?.abortTask()
		this.cline = undefined // removes reference to it, so once promises end it will be garbage collected
	}

	// Caching mechanism to keep track of webview messages + API conversation history per provider instance

	/*
	Now that we use retainContextWhenHidden, we don't have to store a cache of cline messages in the user's state, but we could to reduce memory footprint in long conversations.

	- We have to be careful of what state is shared between ClineProvider instances since there could be multiple instances of the extension running at once. For example when we cached cline messages using the same key, two instances of the extension could end up using the same key and overwriting each other's messages.
	- Some state does need to be shared between the instances, i.e. the API key--however there doesn't seem to be a good way to notfy the other instances that the API key has changed.

	We need to use a unique identifier for each ClineProvider instance's message cache since we could be running several instances of the extension outside of just the sidebar i.e. in editor panels.

	// conversation history to send in API requests

	/*
	It seems that some API messages do not comply with vscode state requirements. Either the Anthropic library is manipulating these values somehow in the backend in a way thats creating cyclic references, or the API returns a function or a Symbol as part of the message content.
	VSCode docs about state: "The value must be JSON-stringifyable ... value — A value. MUST not contain cyclic references."
	For now we'll store the conversation history in memory, and if we need to store in state directly we'd need to do a manual conversion to ensure proper json stringification.
	*/

	// getApiConversationHistory(): Anthropic.MessageParam[] {
	// 	// const history = (await this.getGlobalState(
	// 	// 	this.getApiConversationHistoryStateKey()
	// 	// )) as Anthropic.MessageParam[]
	// 	// return history || []
	// 	return this.apiConversationHistory
	// }

	// setApiConversationHistory(history: Anthropic.MessageParam[] | undefined) {
	// 	// await this.updateGlobalState(this.getApiConversationHistoryStateKey(), history)
	// 	this.apiConversationHistory = history || []
	// }

	// addMessageToApiConversationHistory(message: Anthropic.MessageParam): Anthropic.MessageParam[] {
	// 	// const history = await this.getApiConversationHistory()
	// 	// history.push(message)
	// 	// await this.setApiConversationHistory(history)
	// 	// return history
	// 	this.apiConversationHistory.push(message)
	// 	return this.apiConversationHistory
	// }

	/*
	Storage
	https://dev.to/kompotkot/how-to-use-secretstorage-in-your-vscode-extensions-2hco
	https://www.eliostruyf.com/devhack-code-extension-storage-options/
	*/

	async getState() {
		const [
			storedApiProvider,
			apiModelId,
			apiKey,
			glamaApiKey,
			glamaModelId,
			glamaModelInfo,
			openRouterApiKey,
			awsAccessKey,
			awsSecretKey,
			awsSessionToken,
			awsRegion,
			awsUseCrossRegionInference,
			awsProfile,
			awsUseProfile,
			vertexProjectId,
			vertexRegion,
			openAiBaseUrl,
			openAiApiKey,
			openAiModelId,
			openAiCustomModelInfo,
			openAiUseAzure,
			ollamaModelId,
			ollamaBaseUrl,
			lmStudioModelId,
			lmStudioBaseUrl,
			anthropicBaseUrl,
			geminiApiKey,
			openAiNativeApiKey,
			deepSeekApiKey,
			mistralApiKey,
			mistralCodestralUrl,
			azureApiVersion,
			openAiStreamingEnabled,
			openRouterModelId,
			openRouterModelInfo,
			openRouterBaseUrl,
			openRouterUseMiddleOutTransform,
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowExecute,
			alwaysAllowBrowser,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			taskHistory,
			allowedCommands,
			soundEnabled,
			diffEnabled,
			checkpointsEnabled,
			soundVolume,
			browserViewportSize,
			fuzzyMatchThreshold,
			preferredLanguage,
			writeDelayMs,
			screenshotQuality,
			terminalOutputLineLimit,
			mcpEnabled,
			enableMcpServerCreation,
			alwaysApproveResubmit,
			requestDelaySeconds,
			rateLimitSeconds,
			currentApiConfigName,
			listApiConfigMeta,
			vsCodeLmModelSelector,
			mode,
			modeApiConfigs,
			customModePrompts,
			customSupportPrompts,
			enhancementApiConfigId,
			autoApprovalEnabled,
			customModes,
			experiments,
			unboundApiKey,
			unboundModelId,
			unboundModelInfo,
			requestyApiKey,
			requestyModelId,
			requestyModelInfo,
			modelTemperature,
			maxOpenTabsContext,
		] = await Promise.all([
			this.getGlobalState("apiProvider") as Promise<ApiProvider | undefined>,
			this.getGlobalState("apiModelId") as Promise<string | undefined>,
			this.getSecret("apiKey") as Promise<string | undefined>,
			this.getSecret("glamaApiKey") as Promise<string | undefined>,
			this.getGlobalState("glamaModelId") as Promise<string | undefined>,
			this.getGlobalState("glamaModelInfo") as Promise<ModelInfo | undefined>,
			this.getSecret("openRouterApiKey") as Promise<string | undefined>,
			this.getSecret("awsAccessKey") as Promise<string | undefined>,
			this.getSecret("awsSecretKey") as Promise<string | undefined>,
			this.getSecret("awsSessionToken") as Promise<string | undefined>,
			this.getGlobalState("awsRegion") as Promise<string | undefined>,
			this.getGlobalState("awsUseCrossRegionInference") as Promise<boolean | undefined>,
			this.getGlobalState("awsProfile") as Promise<string | undefined>,
			this.getGlobalState("awsUseProfile") as Promise<boolean | undefined>,
			this.getGlobalState("vertexProjectId") as Promise<string | undefined>,
			this.getGlobalState("vertexRegion") as Promise<string | undefined>,
			this.getGlobalState("openAiBaseUrl") as Promise<string | undefined>,
			this.getSecret("openAiApiKey") as Promise<string | undefined>,
			this.getGlobalState("openAiModelId") as Promise<string | undefined>,
			this.getGlobalState("openAiCustomModelInfo") as Promise<ModelInfo | undefined>,
			this.getGlobalState("openAiUseAzure") as Promise<boolean | undefined>,
			this.getGlobalState("ollamaModelId") as Promise<string | undefined>,
			this.getGlobalState("ollamaBaseUrl") as Promise<string | undefined>,
			this.getGlobalState("lmStudioModelId") as Promise<string | undefined>,
			this.getGlobalState("lmStudioBaseUrl") as Promise<string | undefined>,
			this.getGlobalState("anthropicBaseUrl") as Promise<string | undefined>,
			this.getSecret("geminiApiKey") as Promise<string | undefined>,
			this.getSecret("openAiNativeApiKey") as Promise<string | undefined>,
			this.getSecret("deepSeekApiKey") as Promise<string | undefined>,
			this.getSecret("mistralApiKey") as Promise<string | undefined>,
			this.getGlobalState("mistralCodestralUrl") as Promise<string | undefined>,
			this.getGlobalState("azureApiVersion") as Promise<string | undefined>,
			this.getGlobalState("openAiStreamingEnabled") as Promise<boolean | undefined>,
			this.getGlobalState("openRouterModelId") as Promise<string | undefined>,
			this.getGlobalState("openRouterModelInfo") as Promise<ModelInfo | undefined>,
			this.getGlobalState("openRouterBaseUrl") as Promise<string | undefined>,
			this.getGlobalState("openRouterUseMiddleOutTransform") as Promise<boolean | undefined>,
			this.getGlobalState("lastShownAnnouncementId") as Promise<string | undefined>,
			this.getGlobalState("customInstructions") as Promise<string | undefined>,
			this.getGlobalState("alwaysAllowReadOnly") as Promise<boolean | undefined>,
			this.getGlobalState("alwaysAllowWrite") as Promise<boolean | undefined>,
			this.getGlobalState("alwaysAllowExecute") as Promise<boolean | undefined>,
			this.getGlobalState("alwaysAllowBrowser") as Promise<boolean | undefined>,
			this.getGlobalState("alwaysAllowMcp") as Promise<boolean | undefined>,
			this.getGlobalState("alwaysAllowModeSwitch") as Promise<boolean | undefined>,
			this.getGlobalState("taskHistory") as Promise<HistoryItem[] | undefined>,
			this.getGlobalState("allowedCommands") as Promise<string[] | undefined>,
			this.getGlobalState("soundEnabled") as Promise<boolean | undefined>,
			this.getGlobalState("diffEnabled") as Promise<boolean | undefined>,
			this.getGlobalState("checkpointsEnabled") as Promise<boolean | undefined>,
			this.getGlobalState("soundVolume") as Promise<number | undefined>,
			this.getGlobalState("browserViewportSize") as Promise<string | undefined>,
			this.getGlobalState("fuzzyMatchThreshold") as Promise<number | undefined>,
			this.getGlobalState("preferredLanguage") as Promise<string | undefined>,
			this.getGlobalState("writeDelayMs") as Promise<number | undefined>,
			this.getGlobalState("screenshotQuality") as Promise<number | undefined>,
			this.getGlobalState("terminalOutputLineLimit") as Promise<number | undefined>,
			this.getGlobalState("mcpEnabled") as Promise<boolean | undefined>,
			this.getGlobalState("enableMcpServerCreation") as Promise<boolean | undefined>,
			this.getGlobalState("alwaysApproveResubmit") as Promise<boolean | undefined>,
			this.getGlobalState("requestDelaySeconds") as Promise<number | undefined>,
			this.getGlobalState("rateLimitSeconds") as Promise<number | undefined>,
			this.getGlobalState("currentApiConfigName") as Promise<string | undefined>,
			this.getGlobalState("listApiConfigMeta") as Promise<ApiConfigMeta[] | undefined>,
			this.getGlobalState("vsCodeLmModelSelector") as Promise<vscode.LanguageModelChatSelector | undefined>,
			this.getGlobalState("mode") as Promise<Mode | undefined>,
			this.getGlobalState("modeApiConfigs") as Promise<Record<Mode, string> | undefined>,
			this.getGlobalState("customModePrompts") as Promise<CustomModePrompts | undefined>,
			this.getGlobalState("customSupportPrompts") as Promise<CustomSupportPrompts | undefined>,
			this.getGlobalState("enhancementApiConfigId") as Promise<string | undefined>,
			this.getGlobalState("autoApprovalEnabled") as Promise<boolean | undefined>,
			this.customModesManager.getCustomModes(),
			this.getGlobalState("experiments") as Promise<Record<ExperimentId, boolean> | undefined>,
			this.getSecret("unboundApiKey") as Promise<string | undefined>,
			this.getGlobalState("unboundModelId") as Promise<string | undefined>,
			this.getGlobalState("unboundModelInfo") as Promise<ModelInfo | undefined>,
			this.getSecret("requestyApiKey") as Promise<string | undefined>,
			this.getGlobalState("requestyModelId") as Promise<string | undefined>,
			this.getGlobalState("requestyModelInfo") as Promise<ModelInfo | undefined>,
			this.getGlobalState("modelTemperature") as Promise<number | undefined>,
			this.getGlobalState("maxOpenTabsContext") as Promise<number | undefined>,
		])

		let apiProvider: ApiProvider
		if (storedApiProvider) {
			apiProvider = storedApiProvider
		} else {
			// Either new user or legacy user that doesn't have the apiProvider stored in state
			// (If they're using OpenRouter or Bedrock, then apiProvider state will exist)
			if (apiKey) {
				apiProvider = "anthropic"
			} else {
				// New users should default to openrouter
				apiProvider = "openrouter"
			}
		}

		return {
			apiConfiguration: {
				apiProvider,
				apiModelId,
				apiKey,
				glamaApiKey,
				glamaModelId,
				glamaModelInfo,
				openRouterApiKey,
				awsAccessKey,
				awsSecretKey,
				awsSessionToken,
				awsRegion,
				awsUseCrossRegionInference,
				awsProfile,
				awsUseProfile,
				vertexProjectId,
				vertexRegion,
				openAiBaseUrl,
				openAiApiKey,
				openAiModelId,
				openAiCustomModelInfo,
				openAiUseAzure,
				ollamaModelId,
				ollamaBaseUrl,
				lmStudioModelId,
				lmStudioBaseUrl,
				anthropicBaseUrl,
				geminiApiKey,
				openAiNativeApiKey,
				deepSeekApiKey,
				mistralApiKey,
				mistralCodestralUrl,
				azureApiVersion,
				openAiStreamingEnabled,
				openRouterModelId,
				openRouterModelInfo,
				openRouterBaseUrl,
				openRouterUseMiddleOutTransform,
				vsCodeLmModelSelector,
				unboundApiKey,
				unboundModelId,
				unboundModelInfo,
				requestyApiKey,
				requestyModelId,
				requestyModelInfo,
				modelTemperature,
			},
			lastShownAnnouncementId,
			customInstructions,
			alwaysAllowReadOnly: alwaysAllowReadOnly ?? false,
			alwaysAllowWrite: alwaysAllowWrite ?? false,
			alwaysAllowExecute: alwaysAllowExecute ?? false,
			alwaysAllowBrowser: alwaysAllowBrowser ?? false,
			alwaysAllowMcp: alwaysAllowMcp ?? false,
			alwaysAllowModeSwitch: alwaysAllowModeSwitch ?? false,
			taskHistory,
			allowedCommands,
			soundEnabled: soundEnabled ?? false,
			diffEnabled: diffEnabled ?? true,
			checkpointsEnabled: checkpointsEnabled ?? false,
			soundVolume,
			browserViewportSize: browserViewportSize ?? "900x600",
			screenshotQuality: screenshotQuality ?? 75,
			fuzzyMatchThreshold: fuzzyMatchThreshold ?? 1.0,
			writeDelayMs: writeDelayMs ?? 1000,
			terminalOutputLineLimit: terminalOutputLineLimit ?? 500,
			mode: mode ?? defaultModeSlug,
			preferredLanguage:
				preferredLanguage ??
				(() => {
					// Get VSCode's locale setting
					const vscodeLang = vscode.env.language
					// Map VSCode locale to our supported languages
					const langMap: { [key: string]: string } = {
						en: "English",
						ar: "Arabic",
						"pt-br": "Brazilian Portuguese",
						ca: "Catalan",
						cs: "Czech",
						fr: "French",
						de: "German",
						hi: "Hindi",
						hu: "Hungarian",
						it: "Italian",
						ja: "Japanese",
						ko: "Korean",
						pl: "Polish",
						pt: "Portuguese",
						ru: "Russian",
						zh: "Simplified Chinese",
						"zh-cn": "Simplified Chinese",
						es: "Spanish",
						"zh-tw": "Traditional Chinese",
						tr: "Turkish",
					}
					// Return mapped language or default to English
					return langMap[vscodeLang] ?? langMap[vscodeLang.split("-")[0]] ?? "English"
				})(),
			mcpEnabled: mcpEnabled ?? true,
			enableMcpServerCreation: enableMcpServerCreation ?? true,
			alwaysApproveResubmit: alwaysApproveResubmit ?? false,
			requestDelaySeconds: Math.max(5, requestDelaySeconds ?? 10),
			rateLimitSeconds: rateLimitSeconds ?? 0,
			currentApiConfigName: currentApiConfigName ?? "default",
			listApiConfigMeta: listApiConfigMeta ?? [],
			modeApiConfigs: modeApiConfigs ?? ({} as Record<Mode, string>),
			customModePrompts: customModePrompts ?? {},
			customSupportPrompts: customSupportPrompts ?? {},
			enhancementApiConfigId,
			experiments: experiments ?? this.experimentDefault,
			autoApprovalEnabled: autoApprovalEnabled ?? false,
			customModes,
			maxOpenTabsContext: maxOpenTabsContext ?? 20,
		}
	}

	// Helper methods for accessing SettingsManager

	public async updateGlobalState(key: GlobalStateKey, value: any) {
		await this.settingsManager.updateGlobalState(key, value)
	}

	public async getGlobalState(key: GlobalStateKey) {
		return await this.settingsManager.getGlobalState(key)
	}

	public async storeSecret(key: SecretKey, value?: string) {
		await this.settingsManager.storeSecret(key, value)
	}

	public async getSecret(key: SecretKey) {
		return await this.settingsManager.getSecret(key)
	}

	// workspace

	private async updateWorkspaceState(key: string, value: any) {
		await this.context.workspaceState.update(key, value)
	}

	private async getWorkspaceState(key: string) {
		return await this.context.workspaceState.get(key)
	}

	// dev

	async resetState() {
		const answer = await vscode.window.showInformationMessage(
			"Are you sure you want to reset all state and secret storage in the extension? This cannot be undone.",
			{ modal: true },
			"Yes",
		)

		if (answer !== "Yes") {
			return
		}

		// Reset all settings using SettingsManager
		await this.settingsManager.resetAllSettings()

		// Reset configs and custom modes
		await this.configManager.resetAllConfigs()
		await this.customModesManager.resetCustomModes()

		// Clear current task
		if (this.cline) {
			this.cline.abortTask()
			this.cline = undefined
		}

		await this.postStateToWebview()
		await this.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
	}

	// logging

	public log(message: string) {
		this.outputChannel.appendLine(message)
	}

	// integration tests

	get viewLaunched() {
		return this.isViewLaunched
	}

	get messages() {
		return this.cline?.clineMessages || []
	}

	// Add public getter
	public getMcpHub(): McpHub | undefined {
		return this.mcpHub
	}

	// Task history management
	public async updateTaskHistory(historyItem: HistoryItem) {
		return this.taskHistoryManager.updateTaskHistory(historyItem)
	}

	// Required methods from ClineProviderInterface
	public getDiffStrategy(modelId: string, fuzzyMatchThreshold: number, useExperimentalDiffStrategy: boolean) {
		return getDiffStrategy(modelId, fuzzyMatchThreshold, useExperimentalDiffStrategy)
	}

	public async getSystemPrompt(
		cwd: string,
		supportsComputerUse: boolean,
		mcpHub: McpHub | undefined,
		diffStrategy: any,
		browserViewportSize: string,
		mode: Mode,
		customModePrompts: CustomModePrompts | undefined,
		customModes: any,
		customInstructions: string | undefined,
		preferredLanguage: string,
		diffEnabled: boolean,
		experiments: Record<ExperimentId, boolean>,
		enableMcpServerCreation: boolean,
	) {
		return this.systemPromptGenerator.generate(
			cwd,
			supportsComputerUse,
			mcpHub,
			diffStrategy,
			browserViewportSize,
			mode,
			customModePrompts,
			customModes,
			customInstructions,
			preferredLanguage,
			diffEnabled,
			experiments,
			enableMcpServerCreation,
		)
	}
}
