import { GLOBAL_STATE_KEYS, GlobalStateKey, SECRET_KEYS, SecretKey } from "../../shared/globalState"
import { ApiConfiguration, ApiProvider, API_CONFIG_KEYS } from "../../shared/api"
import * as vscode from "vscode"

import { formatLanguage } from "../../shared/language"
import { Mode, defaultModeSlug, ModeConfig } from "../../shared/modes"
import { TERMINAL_SHELL_INTEGRATION_TIMEOUT } from "../../integrations/terminal/Terminal"
import { experimentDefault } from "../../shared/experiments"
import { CustomModesManager } from "../config/CustomModesManager"
import { ContextProxy } from "../contextProxy"

export class ClineStateManager {
	private static instance: ClineStateManager
	private readonly contextProxy: ContextProxy
	/**
	 * A manager for state specific to each ClineProvider instance.
	 *
	 * Manages the global state associated with the extension (e.g. the user's chosen language, their api configuration, etc).
	 * Also has methods to simplify the process of updating state.
	 *
	 * TODO: refactor customModesManager so that we can use it as a singleton?
	 *
	 * @param customModesManager The manager for the user's custom modes.
	 */
	constructor(private readonly customModesManager: CustomModesManager) {
		this.contextProxy = ContextProxy.getInstance()
	}

	public static getInstance(customModesManager: CustomModesManager): ClineStateManager {
		// Ensure we only have one instance of ClineStateManager
		if (!ClineStateManager.instance) {
			ClineStateManager.instance = new ClineStateManager(customModesManager)
		}
		return ClineStateManager.instance
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
		// Create an object to store all fetched values
		const stateValues: Record<GlobalStateKey | SecretKey, any> = {} as Record<GlobalStateKey | SecretKey, any>
		const secretValues: Record<SecretKey, any> = {} as Record<SecretKey, any>

		// Create promise arrays for global state and secrets
		const statePromises = GLOBAL_STATE_KEYS.map((key) => this.contextProxy.getGlobalState(key))
		const secretPromises = SECRET_KEYS.map((key) => this.contextProxy.getSecret(key))

		// Add promise for custom modes which is handled separately
		// todo: decouple customModesManager

		const customModesPromise = this.customModesManager.getCustomModes()

		let idx = 0
		const valuePromises = await Promise.all([...statePromises, ...secretPromises, customModesPromise])

		// Populate stateValues and secretValues
		GLOBAL_STATE_KEYS.forEach((key, _) => {
			stateValues[key] = valuePromises[idx]
			idx = idx + 1
		})

		SECRET_KEYS.forEach((key, index) => {
			secretValues[key] = valuePromises[idx]
			idx = idx + 1
		})

		let customModes = valuePromises[idx] as ModeConfig[] | undefined

		// Determine apiProvider with the same logic as before
		let apiProvider: ApiProvider
		if (stateValues.apiProvider) {
			apiProvider = stateValues.apiProvider
		} else {
			apiProvider = "anthropic"
		}

		// Build the apiConfiguration object combining state values and secrets
		// Using the dynamic approach with API_CONFIG_KEYS
		const apiConfiguration: ApiConfiguration = {
			// Dynamically add all API-related keys from stateValues
			...Object.fromEntries(API_CONFIG_KEYS.map((key) => [key, stateValues[key]])),
			// Add all secrets
			...secretValues,
		}

		// Ensure apiProvider is set properly if not already in state
		if (!apiConfiguration.apiProvider) {
			apiConfiguration.apiProvider = apiProvider
		}

		// Return the same structure as before
		return {
			apiConfiguration,
			lastShownAnnouncementId: stateValues.lastShownAnnouncementId,
			customInstructions: stateValues.customInstructions,
			alwaysAllowReadOnly: stateValues.alwaysAllowReadOnly ?? false,
			alwaysAllowReadOnlyOutsideWorkspace: stateValues.alwaysAllowReadOnlyOutsideWorkspace ?? false,
			alwaysAllowWrite: stateValues.alwaysAllowWrite ?? false,
			alwaysAllowWriteOutsideWorkspace: stateValues.alwaysAllowWriteOutsideWorkspace ?? false,
			alwaysAllowExecute: stateValues.alwaysAllowExecute ?? false,
			alwaysAllowBrowser: stateValues.alwaysAllowBrowser ?? false,
			alwaysAllowMcp: stateValues.alwaysAllowMcp ?? false,
			alwaysAllowModeSwitch: stateValues.alwaysAllowModeSwitch ?? false,
			alwaysAllowSubtasks: stateValues.alwaysAllowSubtasks ?? false,
			taskHistory: stateValues.taskHistory,
			allowedCommands: stateValues.allowedCommands,
			soundEnabled: stateValues.soundEnabled ?? false,
			ttsEnabled: stateValues.ttsEnabled ?? false,
			ttsSpeed: stateValues.ttsSpeed ?? 1.0,
			diffEnabled: stateValues.diffEnabled ?? true,
			enableCheckpoints: stateValues.enableCheckpoints ?? true,
			checkpointStorage: stateValues.checkpointStorage ?? "task",
			soundVolume: stateValues.soundVolume,
			browserViewportSize: stateValues.browserViewportSize ?? "900x600",
			screenshotQuality: stateValues.screenshotQuality ?? 75,
			remoteBrowserHost: stateValues.remoteBrowserHost,
			remoteBrowserEnabled: stateValues.remoteBrowserEnabled ?? false,
			fuzzyMatchThreshold: stateValues.fuzzyMatchThreshold ?? 1.0,
			writeDelayMs: stateValues.writeDelayMs ?? 1000,
			terminalOutputLineLimit: stateValues.terminalOutputLineLimit ?? 500,
			terminalShellIntegrationTimeout:
				stateValues.terminalShellIntegrationTimeout ?? TERMINAL_SHELL_INTEGRATION_TIMEOUT,
			mode: stateValues.mode ?? defaultModeSlug,
			language: stateValues.language ?? formatLanguage(vscode.env.language),
			mcpEnabled: stateValues.mcpEnabled ?? true,
			enableMcpServerCreation: stateValues.enableMcpServerCreation ?? true,
			alwaysApproveResubmit: stateValues.alwaysApproveResubmit ?? false,
			requestDelaySeconds: Math.max(5, stateValues.requestDelaySeconds ?? 10),
			rateLimitSeconds: stateValues.rateLimitSeconds ?? 0,
			currentApiConfigName: stateValues.currentApiConfigName ?? "default",
			listApiConfigMeta: stateValues.listApiConfigMeta ?? [],
			modeApiConfigs: stateValues.modeApiConfigs ?? ({} as Record<Mode, string>),
			customModePrompts: stateValues.customModePrompts ?? {},
			customSupportPrompts: stateValues.customSupportPrompts ?? {},
			enhancementApiConfigId: stateValues.enhancementApiConfigId,
			experiments: stateValues.experiments ?? experimentDefault,
			autoApprovalEnabled: stateValues.autoApprovalEnabled ?? false,
			customModes,
			maxOpenTabsContext: stateValues.maxOpenTabsContext ?? 20,
			maxWorkspaceFiles: stateValues.maxWorkspaceFiles ?? 200,
			openRouterUseMiddleOutTransform: stateValues.openRouterUseMiddleOutTransform ?? true,
			browserToolEnabled: stateValues.browserToolEnabled ?? true,
			telemetrySetting: stateValues.telemetrySetting || "unset",
			showRooIgnoredFiles: stateValues.showRooIgnoredFiles ?? true,
			maxReadFileLine: stateValues.maxReadFileLine ?? 500,
		}
	}
}
