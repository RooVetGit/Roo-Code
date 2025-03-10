// Define the array first with 'as const' to create a readonly tuple type
export const SECRET_KEYS = [
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
] as const

// Derive the type from the array - creates a union of string literals
export type SecretKey = (typeof SECRET_KEYS)[number]

// Define the array first with 'as const' to create a readonly tuple type
export const GLOBAL_STATE_KEYS = [
	"apiProvider",
	"apiModelId",
	"glamaModelId",
	"glamaModelInfo",
	"awsRegion",
	"awsUseCrossRegionInference",
	"awsProfile",
	"awsUseProfile",
	"vertexKeyFile",
	"vertexJsonCredentials",
	"vertexProjectId",
	"vertexRegion",
	"lastShownAnnouncementId",
	"customInstructions",
	"alwaysAllowReadOnly",
	"alwaysAllowWrite",
	"alwaysAllowExecute",
	"alwaysAllowBrowser",
	"alwaysAllowMcp",
	"alwaysAllowModeSwitch",
	"alwaysAllowSubtasks",
	"taskHistory",
	"openAiBaseUrl",
	"openAiModelId",
	"openAiCustomModelInfo",
	"openAiUseAzure",
	"ollamaModelId",
	"ollamaBaseUrl",
	"lmStudioModelId",
	"lmStudioBaseUrl",
	"anthropicBaseUrl",
	"modelMaxThinkingTokens",
	"azureApiVersion",
	"openAiStreamingEnabled",
	"openRouterModelId",
	"openRouterModelInfo",
	"openRouterBaseUrl",
	"openRouterUseMiddleOutTransform",
	"allowedCommands",
	"soundEnabled",
	"ttsEnabled",
	"ttsSpeed",
	"soundVolume",
	"diffEnabled",
	"enableCheckpoints",
	"checkpointStorage",
	"browserViewportSize",
	"screenshotQuality",
	"fuzzyMatchThreshold",
	"preferredLanguage", // Language setting for Cline's communication
	"writeDelayMs",
	"terminalOutputLimit",
	"mcpEnabled",
	"enableMcpServerCreation",
	"alwaysApproveResubmit",
	"requestDelaySeconds",
	"rateLimitSeconds",
	"currentApiConfigName",
	"listApiConfigMeta",
	"vsCodeLmModelSelector",
	"mode",
	"modeApiConfigs",
	"customModePrompts",
	"customSupportPrompts",
	"enhancementApiConfigId",
	"experiments", // Map of experiment IDs to their enabled state
	"autoApprovalEnabled",
	"enableCustomModeCreation", // Enable the ability for Roo to create custom modes
	"customModes", // Array of custom modes
	"unboundModelId",
	"requestyModelId",
	"requestyModelInfo",
	"unboundModelInfo",
	"modelTemperature",
	"modelMaxTokens",
	"mistralCodestralUrl",
	"maxOpenTabsContext",
	"browserToolEnabled",
	"lmStudioSpeculativeDecodingEnabled",
	"lmStudioDraftModelId",
	"telemetrySetting",
	"showRooIgnoredFiles",
] as const

// Derive the type from the array - creates a union of string literals
export type GlobalStateKey = (typeof GLOBAL_STATE_KEYS)[number]
