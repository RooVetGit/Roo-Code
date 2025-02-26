import * as vscode from "vscode"
import { ApiConfiguration, ApiProvider, ModelInfo } from "../../shared/api"
import { Mode } from "../../shared/modes"
import { ApiConfigMeta } from "../../shared/ExtensionMessage"
import { HistoryItem } from "../../shared/HistoryItem"
import { ExperimentId, experimentDefault } from "../../shared/experiments"
import { CustomSupportPrompts } from "../../shared/support-prompt"
import { CustomModePrompts } from "../../shared/modes"
import { logger } from "../../utils/logging"

/**
 * Types of secret keys that can be stored in the extension's secret storage
 */
export type SecretKey =
	| "apiKey"
	| "glamaApiKey"
	| "openRouterApiKey"
	| "awsAccessKey"
	| "awsSecretKey"
	| "awsSessionToken"
	| "openAiApiKey"
	| "geminiApiKey"
	| "openAiNativeApiKey"
	| "deepSeekApiKey"
	| "mistralApiKey"
	| "unboundApiKey"
	| "requestyApiKey"

/**
 * Types of global state keys that can be stored in the extension's global state
 */
export type GlobalStateKey =
	| "apiProvider"
	| "apiModelId"
	| "glamaModelId"
	| "glamaModelInfo"
	| "awsRegion"
	| "awsUseCrossRegionInference"
	| "awsProfile"
	| "awsUseProfile"
	| "vertexProjectId"
	| "vertexRegion"
	| "lastShownAnnouncementId"
	| "customInstructions"
	| "alwaysAllowReadOnly"
	| "alwaysAllowWrite"
	| "alwaysAllowExecute"
	| "alwaysAllowBrowser"
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "taskHistory"
	| "openAiBaseUrl"
	| "openAiModelId"
	| "openAiCustomModelInfo"
	| "openAiUseAzure"
	| "ollamaModelId"
	| "ollamaBaseUrl"
	| "lmStudioModelId"
	| "lmStudioBaseUrl"
	| "anthropicBaseUrl"
	| "azureApiVersion"
	| "openAiStreamingEnabled"
	| "openRouterModelId"
	| "openRouterModelInfo"
	| "openRouterBaseUrl"
	| "openRouterUseMiddleOutTransform"
	| "allowedCommands"
	| "soundEnabled"
	| "soundVolume"
	| "diffEnabled"
	| "checkpointsEnabled"
	| "browserViewportSize"
	| "screenshotQuality"
	| "fuzzyMatchThreshold"
	| "preferredLanguage"
	| "writeDelayMs"
	| "terminalOutputLineLimit"
	| "mcpEnabled"
	| "enableMcpServerCreation"
	| "alwaysApproveResubmit"
	| "requestDelaySeconds"
	| "rateLimitSeconds"
	| "currentApiConfigName"
	| "listApiConfigMeta"
	| "vsCodeLmModelSelector"
	| "mode"
	| "modeApiConfigs"
	| "customModePrompts"
	| "customSupportPrompts"
	| "enhancementApiConfigId"
	| "experiments"
	| "autoApprovalEnabled"
	| "customModes"
	| "unboundModelId"
	| "requestyModelId"
	| "requestyModelInfo"
	| "unboundModelInfo"
	| "modelTemperature"
	| "mistralCodestralUrl"
	| "maxOpenTabsContext"

/**
 * Interface for the settings object returned by getAllSettings()
 */
export interface Settings {
	apiConfiguration: ApiConfiguration
	lastShownAnnouncementId?: string
	customInstructions?: string
	alwaysAllowReadOnly: boolean
	alwaysAllowWrite: boolean
	alwaysAllowExecute: boolean
	alwaysAllowBrowser: boolean
	alwaysAllowMcp: boolean
	alwaysAllowModeSwitch: boolean
	taskHistory?: HistoryItem[]
	allowedCommands?: string[]
	soundEnabled: boolean
	diffEnabled: boolean
	checkpointsEnabled: boolean
	soundVolume?: number
	browserViewportSize: string
	screenshotQuality: number
	fuzzyMatchThreshold: number
	writeDelayMs: number
	terminalOutputLineLimit: number
	mode: Mode
	preferredLanguage: string
	mcpEnabled: boolean
	enableMcpServerCreation: boolean
	alwaysApproveResubmit: boolean
	requestDelaySeconds: number
	rateLimitSeconds: number
	currentApiConfigName: string
	listApiConfigMeta?: ApiConfigMeta[]
	modeApiConfigs: Record<Mode, string>
	customModePrompts: CustomModePrompts
	customSupportPrompts: CustomSupportPrompts
	enhancementApiConfigId?: string
	experiments: Record<ExperimentId, boolean>
	autoApprovalEnabled: boolean
	customModes?: any[] // Using any[] for now, should be replaced with proper type
	maxOpenTabsContext: number
}

/**
 * Event data for settings changes
 */
export type SettingsChangeEvent = {
	key: GlobalStateKey
	value: any
}

/**
 * Manages settings for the extension, including global state and secrets.
 * This class centralizes all settings-related functionality to improve maintainability
 * and separation of concerns.
 */
export class SettingsManager {
	private readonly _onDidChangeSettings = new vscode.EventEmitter<SettingsChangeEvent>()

	/**
	 * Event that fires when settings change
	 */
	public readonly onDidChangeSettings = this._onDidChangeSettings.event

	/**
	 * Creates a new SettingsManager instance
	 * @param context The extension context
	 */
	constructor(private readonly context: vscode.ExtensionContext) {
		logger.debug("SettingsManager initialized")
	}

	/**
	 * Updates a global state setting
	 * @param key The key of the setting to update
	 * @param value The new value of the setting
	 * @throws Error if the update fails
	 */
	async updateGlobalState(key: GlobalStateKey, value: any): Promise<void> {
		try {
			await this.context.globalState.update(key, value)
			this._onDidChangeSettings.fire({ key, value })
			logger.debug(`Updated global state: ${key}`)
		} catch (error) {
			logger.error(`Failed to update global state for key ${key}:`, error)
			throw new Error(`Failed to update setting: ${key}`)
		}
	}

	/**
	 * Gets a global state setting
	 * @param key The key of the setting to get
	 * @returns The value of the setting, or undefined if it doesn't exist
	 */
	async getGlobalState(key: GlobalStateKey): Promise<any> {
		try {
			return this.context.globalState.get(key)
		} catch (error) {
			logger.error(`Failed to get global state for key ${key}:`, error)
			return undefined
		}
	}

	/**
	 * Stores a secret in the extension's secret storage
	 * @param key The key of the secret to store
	 * @param value The value of the secret, or undefined to delete the secret
	 * @throws Error if the operation fails
	 */
	async storeSecret(key: SecretKey, value?: string): Promise<void> {
		try {
			if (value) {
				await this.context.secrets.store(key, value)
				logger.debug(`Stored secret: ${key}`)
			} else {
				await this.context.secrets.delete(key)
				logger.debug(`Deleted secret: ${key}`)
			}
		} catch (error) {
			logger.error(`Failed to ${value ? "store" : "delete"} secret for key ${key}:`, error)
			throw new Error(`Failed to ${value ? "store" : "delete"} secret: ${key}`)
		}
	}

	/**
	 * Gets a secret from the extension's secret storage
	 * @param key The key of the secret to get
	 * @returns The value of the secret, or undefined if it doesn't exist
	 */
	async getSecret(key: SecretKey): Promise<string | undefined> {
		try {
			return await this.context.secrets.get(key)
		} catch (error) {
			logger.error(`Failed to get secret for key ${key}:`, error)
			return undefined
		}
	}

	/**
	 * Gets all settings at once
	 * @returns An object containing all settings
	 */
	async getAllSettings(): Promise<Settings> {
		logger.debug("Getting all settings")

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
			this.getGlobalState("apiProvider"),
			this.getGlobalState("apiModelId"),
			this.getSecret("apiKey"),
			this.getSecret("glamaApiKey"),
			this.getGlobalState("glamaModelId"),
			this.getGlobalState("glamaModelInfo"),
			this.getSecret("openRouterApiKey"),
			this.getSecret("awsAccessKey"),
			this.getSecret("awsSecretKey"),
			this.getSecret("awsSessionToken"),
			this.getGlobalState("awsRegion"),
			this.getGlobalState("awsUseCrossRegionInference"),
			this.getGlobalState("awsProfile"),
			this.getGlobalState("awsUseProfile"),
			this.getGlobalState("vertexProjectId"),
			this.getGlobalState("vertexRegion"),
			this.getGlobalState("openAiBaseUrl"),
			this.getSecret("openAiApiKey"),
			this.getGlobalState("openAiModelId"),
			this.getGlobalState("openAiCustomModelInfo"),
			this.getGlobalState("openAiUseAzure"),
			this.getGlobalState("ollamaModelId"),
			this.getGlobalState("ollamaBaseUrl"),
			this.getGlobalState("lmStudioModelId"),
			this.getGlobalState("lmStudioBaseUrl"),
			this.getGlobalState("anthropicBaseUrl"),
			this.getSecret("geminiApiKey"),
			this.getSecret("openAiNativeApiKey"),
			this.getSecret("deepSeekApiKey"),
			this.getSecret("mistralApiKey"),
			this.getGlobalState("mistralCodestralUrl"),
			this.getGlobalState("azureApiVersion"),
			this.getGlobalState("openAiStreamingEnabled"),
			this.getGlobalState("openRouterModelId"),
			this.getGlobalState("openRouterModelInfo"),
			this.getGlobalState("openRouterBaseUrl"),
			this.getGlobalState("openRouterUseMiddleOutTransform"),
			this.getGlobalState("lastShownAnnouncementId"),
			this.getGlobalState("customInstructions"),
			this.getGlobalState("alwaysAllowReadOnly"),
			this.getGlobalState("alwaysAllowWrite"),
			this.getGlobalState("alwaysAllowExecute"),
			this.getGlobalState("alwaysAllowBrowser"),
			this.getGlobalState("alwaysAllowMcp"),
			this.getGlobalState("alwaysAllowModeSwitch"),
			this.getGlobalState("taskHistory"),
			this.getGlobalState("allowedCommands"),
			this.getGlobalState("soundEnabled"),
			this.getGlobalState("diffEnabled"),
			this.getGlobalState("checkpointsEnabled"),
			this.getGlobalState("soundVolume"),
			this.getGlobalState("browserViewportSize"),
			this.getGlobalState("fuzzyMatchThreshold"),
			this.getGlobalState("preferredLanguage"),
			this.getGlobalState("writeDelayMs"),
			this.getGlobalState("screenshotQuality"),
			this.getGlobalState("terminalOutputLineLimit"),
			this.getGlobalState("mcpEnabled"),
			this.getGlobalState("enableMcpServerCreation"),
			this.getGlobalState("alwaysApproveResubmit"),
			this.getGlobalState("requestDelaySeconds"),
			this.getGlobalState("rateLimitSeconds"),
			this.getGlobalState("currentApiConfigName"),
			this.getGlobalState("listApiConfigMeta"),
			this.getGlobalState("vsCodeLmModelSelector"),
			this.getGlobalState("mode"),
			this.getGlobalState("modeApiConfigs"),
			this.getGlobalState("customModePrompts"),
			this.getGlobalState("customSupportPrompts"),
			this.getGlobalState("enhancementApiConfigId"),
			this.getGlobalState("autoApprovalEnabled"),
			this.getGlobalState("customModes"),
			this.getGlobalState("experiments"),
			this.getSecret("unboundApiKey"),
			this.getGlobalState("unboundModelId"),
			this.getGlobalState("unboundModelInfo"),
			this.getSecret("requestyApiKey"),
			this.getGlobalState("requestyModelId"),
			this.getGlobalState("requestyModelInfo"),
			this.getGlobalState("modelTemperature"),
			this.getGlobalState("maxOpenTabsContext"),
		])

		let apiProvider: ApiProvider
		if (storedApiProvider) {
			apiProvider = storedApiProvider
		} else {
			// Either new user or legacy user that doesn't have the apiProvider stored in state
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
			mode: mode ?? "code",
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
			experiments: experiments ?? experimentDefault,
			autoApprovalEnabled: autoApprovalEnabled ?? false,
			customModes,
			maxOpenTabsContext: maxOpenTabsContext ?? 20,
		}
	}

	/**
	 * Updates the API configuration settings
	 * @param apiConfiguration The new API configuration
	 * @throws Error if the update fails
	 */
	async updateApiConfiguration(apiConfiguration: ApiConfiguration): Promise<void> {
		logger.debug("Updating API configuration")

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

		try {
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

			logger.debug("API configuration updated successfully")
		} catch (error) {
			logger.error("Failed to update API configuration:", error)
			throw new Error("Failed to update API configuration")
		}
	}

	/**
	 * Updates the custom instructions
	 * @param instructions The new custom instructions, or undefined to clear
	 * @throws Error if the update fails
	 */
	async updateCustomInstructions(instructions?: string): Promise<void> {
		try {
			await this.updateGlobalState("customInstructions", instructions || undefined)
			logger.debug("Custom instructions updated")
		} catch (error) {
			logger.error("Failed to update custom instructions:", error)
			throw new Error("Failed to update custom instructions")
		}
	}

	/**
	 * Updates the task history
	 * @param item The history item to update or add
	 * @returns The updated history
	 * @throws Error if the update fails
	 */
	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		try {
			const history = ((await this.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
			const existingItemIndex = history.findIndex((h) => h.id === item.id)

			if (existingItemIndex !== -1) {
				history[existingItemIndex] = item
				logger.debug(`Updated task history item: ${item.id}`)
			} else {
				history.push(item)
				logger.debug(`Added new task history item: ${item.id}`)
			}

			await this.updateGlobalState("taskHistory", history)
			return history
		} catch (error) {
			logger.error("Failed to update task history:", error)
			throw new Error("Failed to update task history")
		}
	}

	/**
	 * Gets the API configuration for a specific mode
	 * @param mode The mode to get the API configuration for
	 * @returns The API configuration ID for the mode, or undefined if not set
	 */
	async getModeApiConfig(mode: Mode): Promise<string | undefined> {
		try {
			const modeApiConfigs = (await this.getGlobalState("modeApiConfigs")) as Record<Mode, string> | undefined
			return modeApiConfigs?.[mode]
		} catch (error) {
			logger.error(`Failed to get mode API config for mode ${mode}:`, error)
			return undefined
		}
	}

	/**
	 * Sets the API configuration for a specific mode
	 * @param mode The mode to set the API configuration for
	 * @param configId The API configuration ID to set
	 * @throws Error if the update fails
	 */
	async setModeApiConfig(mode: Mode, configId: string): Promise<void> {
		try {
			const modeApiConfigs = ((await this.getGlobalState("modeApiConfigs")) as Record<Mode, string>) || {}
			modeApiConfigs[mode] = configId
			await this.updateGlobalState("modeApiConfigs", modeApiConfigs)
			logger.debug(`Set mode API config for mode ${mode}: ${configId}`)
		} catch (error) {
			logger.error(`Failed to set mode API config for mode ${mode}:`, error)
			throw new Error(`Failed to set mode API config for mode ${mode}`)
		}
	}

	/**
	 * Resets all settings to their default values
	 * @throws Error if the reset fails
	 */
	async resetAllSettings(): Promise<void> {
		logger.debug("Resetting all settings")

		try {
			// Clear all global state keys
			for (const key of this.context.globalState.keys()) {
				await this.context.globalState.update(key, undefined)
			}

			// Clear all secrets
			const secretKeys: SecretKey[] = [
				"apiKey",
				"glamaApiKey",
				"openRouterApiKey",
				"awsAccessKey",
				"awsSecretKey",
				"awsSessionToken",
				"openAiApiKey",
				"geminiApiKey",
				"openAiNativeApiKey",
				"deepSeekApiKey",
				"mistralApiKey",
				"unboundApiKey",
				"requestyApiKey",
			]

			for (const key of secretKeys) {
				await this.storeSecret(key, undefined)
			}

			logger.debug("All settings reset successfully")
		} catch (error) {
			logger.error("Failed to reset all settings:", error)
			throw new Error("Failed to reset all settings")
		}
	}
}
