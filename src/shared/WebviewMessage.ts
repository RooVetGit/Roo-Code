import { ApiConfiguration, ApiProvider } from "./api"
import { Mode, PromptComponent, ModeConfig } from "./modes"

export type PromptMode = Mode | "enhance"

export type AudioType = "notification" | "celebration" | "progress_loop"

export interface WebviewMessage {
	type:
		| "apiConfiguration"
		| "currentApiConfigName"
		| "upsertApiConfiguration"
		| "deleteApiConfiguration"
		| "loadApiConfiguration"
		| "renameApiConfiguration"
		| "getListApiConfiguration"
		| "customInstructions"
		| "allowedCommands"
		| "alwaysAllowReadOnly"
		| "alwaysAllowWrite"
		| "alwaysAllowExecute"
		| "webviewDidLaunch"
		| "newTask"
		| "askResponse"
		| "clearTask"
		| "didShowAnnouncement"
		| "selectImages"
		| "exportCurrentTask"
		| "showTaskWithId"
		| "deleteTaskWithId"
		| "exportTaskWithId"
		| "resetState"
		| "requestOllamaModels"
		| "requestLmStudioModels"
		| "openImage"
		| "openFile"
		| "openMention"
		| "cancelTask"
		| "refreshGlamaModels"
		| "refreshOpenRouterModels"
		| "refreshOpenAiModels"
		| "alwaysAllowBrowser"
		| "alwaysAllowMcp"
		| "alwaysAllowModeSwitch"
		| "playSound"
		| "soundEnabled"
		| "soundVolume"
		| "diffEnabled"
		| "browserViewportSize"
		| "screenshotQuality"
		| "openMcpSettings"
		| "restartMcpServer"
		| "toggleToolAlwaysAllow"
		| "toggleMcpServer"
		| "updateMcpTimeout"
		| "fuzzyMatchThreshold"
		| "preferredLanguage"
		| "writeDelayMs"
		| "enhancePrompt"
		| "enhancedPrompt"
		| "draggedImages"
		| "deleteMessage"
		| "terminalOutputLineLimit"
		| "mcpEnabled"
		| "searchCommits"
		| "refreshGlamaModels"
		| "alwaysApproveResubmit"
		| "requestDelaySeconds"
		| "setApiConfigPassword"
		| "requestVsCodeLmModels"
		| "mode"
		| "updatePrompt"
		| "updateSupportPrompt"
		| "resetSupportPrompt"
		| "getSystemPrompt"
		| "systemPrompt"
		| "enhancementApiConfigId"
		| "updateExperimental"
		| "autoApprovalEnabled"
		| "updateCustomMode"
		| "deleteCustomMode"
		| "setopenAiCustomModelInfo"
		| "openCustomModesSettings"
		| "semanticSearchMaxResults"
		| "indexingProgress"
		| "deleteSemanticIndex"
		| "reindexSemantic"
		| "semanticSearchStatus"
		| "getSemanticSearchStatus"
		| "updateSemanticSearchApiKey"
		| "saveAllSettings"
	text?: string
	disabled?: boolean
	askResponse?: ClineAskResponse
	apiConfiguration?: ApiConfiguration
	images?: string[]
	bool?: boolean
	value?:
		| number
		| {
				filePath: string
				startLine?: number
				endLine?: number
		  }
	commands?: string[]
	audioType?: AudioType
	serverName?: string
	toolName?: string
	alwaysAllow?: boolean
	mode?: Mode
	promptMode?: PromptMode
	customPrompt?: PromptComponent
	dataUrls?: string[]
	values?: Record<string, any>
	query?: string
	slug?: string
	modeConfig?: ModeConfig
	timeout?: number
	settings?: {
		apiConfiguration?: ApiConfiguration
		alwaysAllowReadOnly?: boolean
		alwaysAllowWrite?: boolean
		alwaysAllowExecute?: boolean
		alwaysAllowBrowser?: boolean
		alwaysAllowMcp?: boolean
		allowedCommands?: string[]
		soundEnabled?: boolean
		soundVolume?: number
		diffEnabled?: boolean
		browserViewportSize?: string
		fuzzyMatchThreshold?: number
		writeDelayMs?: number
		screenshotQuality?: number
		terminalOutputLineLimit?: number
		mcpEnabled?: boolean
		alwaysApproveResubmit?: boolean
		requestDelaySeconds?: number
		currentApiConfigName?: string
		experiments?: Record<string, boolean>
		alwaysAllowModeSwitch?: boolean
		semanticSearchMaxResults?: number
		semanticSearchStatus?: string
	}
}

export type ClineAskResponse = "yesButtonClicked" | "noButtonClicked" | "messageResponse"
