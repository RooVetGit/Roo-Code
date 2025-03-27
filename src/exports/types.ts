// This file is automatically generated by running `npx tsx scripts/generated-types.ts`
// Do not edit it directly.

type ProviderName =
	| "anthropic"
	| "glama"
	| "openrouter"
	| "bedrock"
	| "vertex"
	| "openai"
	| "ollama"
	| "vscode-lm"
	| "lmstudio"
	| "gemini"
	| "openai-native"
	| "mistral"
	| "deepseek"
	| "unbound"
	| "requesty"
	| "human-relay"
	| "fake-ai"

export type { ProviderName }

type ToolGroup = "read" | "edit" | "browser" | "command" | "mcp" | "modes"

export type { ToolGroup }

type CheckpointStorage = "task" | "workspace"

export type { CheckpointStorage }

type Language =
	| "ca"
	| "de"
	| "en"
	| "es"
	| "fr"
	| "hi"
	| "it"
	| "ja"
	| "ko"
	| "pl"
	| "pt-BR"
	| "tr"
	| "vi"
	| "zh-CN"
	| "zh-TW"

export type { Language }

type TelemetrySetting = "unset" | "enabled" | "disabled"

export type { TelemetrySetting }

type ModelInfo = {
	maxTokens?: number | undefined
	contextWindow: number
	supportsImages?: boolean | undefined
	supportsComputerUse?: boolean | undefined
	supportsPromptCache: boolean
	inputPrice?: number | undefined
	outputPrice?: number | undefined
	cacheWritesPrice?: number | undefined
	cacheReadsPrice?: number | undefined
	description?: string | undefined
	reasoningEffort?: ("low" | "medium" | "high") | undefined
	thinking?: boolean | undefined
}

export type { ModelInfo }

type ApiConfigMeta = {
	id: string
	name: string
	apiProvider?:
		| (
				| "anthropic"
				| "glama"
				| "openrouter"
				| "bedrock"
				| "vertex"
				| "openai"
				| "ollama"
				| "vscode-lm"
				| "lmstudio"
				| "gemini"
				| "openai-native"
				| "mistral"
				| "deepseek"
				| "unbound"
				| "requesty"
				| "human-relay"
				| "fake-ai"
		  )
		| undefined
}

export type { ApiConfigMeta }

type HistoryItem = {
	id: string
	number: number
	ts: number
	task: string
	tokensIn: number
	tokensOut: number
	cacheWrites?: number | undefined
	cacheReads?: number | undefined
	totalCost: number
	size?: number | undefined
}

export type { HistoryItem }

type GroupOptions = {
	fileRegex?: string | undefined
	description?: string | undefined
}

export type { GroupOptions }

type GroupEntry =
	| ("read" | "edit" | "browser" | "command" | "mcp" | "modes")
	| [
			"read" | "edit" | "browser" | "command" | "mcp" | "modes",
			{
				fileRegex?: string | undefined
				description?: string | undefined
			},
	  ]

export type { GroupEntry }

type ModeConfig = {
	slug: string
	name: string
	roleDefinition: string
	customInstructions?: string | undefined
	groups: (
		| ("read" | "edit" | "browser" | "command" | "mcp" | "modes")
		| [
				"read" | "edit" | "browser" | "command" | "mcp" | "modes",
				{
					fileRegex?: string | undefined
					description?: string | undefined
				},
		  ]
	)[]
	source?: ("global" | "project") | undefined
}

export type { ModeConfig }

type PromptComponent = {
	roleDefinition?: string | undefined
	customInstructions?: string | undefined
}

export type { PromptComponent }

type CustomModePrompts = {
	[x: string]:
		| {
				roleDefinition?: string | undefined
				customInstructions?: string | undefined
		  }
		| undefined
}

export type { CustomModePrompts }

type CustomSupportPrompts = {
	[x: string]: string | undefined
}

export type { CustomSupportPrompts }

type ExperimentId =
	| "experimentalDiffStrategy"
	| "search_and_replace"
	| "insert_content"
	| "powerSteering"
	| "multi_search_and_replace"

export type { ExperimentId }

type Experiments = {
	experimentalDiffStrategy: boolean
	search_and_replace: boolean
	insert_content: boolean
	powerSteering: boolean
	multi_search_and_replace: boolean
}

export type { Experiments }

type GlobalSettings = {
	currentApiConfigName?: string | undefined
	listApiConfigMeta?:
		| {
				id: string
				name: string
				apiProvider?:
					| (
							| "anthropic"
							| "glama"
							| "openrouter"
							| "bedrock"
							| "vertex"
							| "openai"
							| "ollama"
							| "vscode-lm"
							| "lmstudio"
							| "gemini"
							| "openai-native"
							| "mistral"
							| "deepseek"
							| "unbound"
							| "requesty"
							| "human-relay"
							| "fake-ai"
					  )
					| undefined
		  }[]
		| undefined
	pinnedApiConfigs?:
		| {
				[x: string]: boolean
		  }
		| undefined
	lastShownAnnouncementId?: string | undefined
	customInstructions?: string | undefined
	taskHistory?:
		| {
				id: string
				number: number
				ts: number
				task: string
				tokensIn: number
				tokensOut: number
				cacheWrites?: number | undefined
				cacheReads?: number | undefined
				totalCost: number
				size?: number | undefined
		  }[]
		| undefined
	autoApprovalEnabled?: boolean | undefined
	alwaysAllowReadOnly?: boolean | undefined
	alwaysAllowReadOnlyOutsideWorkspace?: boolean | undefined
	alwaysAllowWrite?: boolean | undefined
	alwaysAllowWriteOutsideWorkspace?: boolean | undefined
	writeDelayMs?: number | undefined
	alwaysAllowBrowser?: boolean | undefined
	alwaysApproveResubmit?: boolean | undefined
	requestDelaySeconds?: number | undefined
	alwaysAllowMcp?: boolean | undefined
	alwaysAllowModeSwitch?: boolean | undefined
	alwaysAllowSubtasks?: boolean | undefined
	alwaysAllowExecute?: boolean | undefined
	allowedCommands?: string[] | undefined
	browserToolEnabled?: boolean | undefined
	browserViewportSize?: string | undefined
	screenshotQuality?: number | undefined
	remoteBrowserEnabled?: boolean | undefined
	remoteBrowserHost?: string | undefined
	enableCheckpoints?: boolean | undefined
	checkpointStorage?: ("task" | "workspace") | undefined
	ttsEnabled?: boolean | undefined
	ttsSpeed?: number | undefined
	soundEnabled?: boolean | undefined
	soundVolume?: number | undefined
	maxOpenTabsContext?: number | undefined
	maxWorkspaceFiles?: number | undefined
	showRooIgnoredFiles?: boolean | undefined
	maxReadFileLine?: number | undefined
	terminalOutputLineLimit?: number | undefined
	terminalShellIntegrationTimeout?: number | undefined
	rateLimitSeconds?: number | undefined
	diffEnabled?: boolean | undefined
	fuzzyMatchThreshold?: number | undefined
	experiments?:
		| {
				experimentalDiffStrategy: boolean
				search_and_replace: boolean
				insert_content: boolean
				powerSteering: boolean
				multi_search_and_replace: boolean
		  }
		| undefined
	language?:
		| (
				| "ca"
				| "de"
				| "en"
				| "es"
				| "fr"
				| "hi"
				| "it"
				| "ja"
				| "ko"
				| "pl"
				| "pt-BR"
				| "tr"
				| "vi"
				| "zh-CN"
				| "zh-TW"
		  )
		| undefined
	telemetrySetting?: ("unset" | "enabled" | "disabled") | undefined
	mcpEnabled?: boolean | undefined
	enableMcpServerCreation?: boolean | undefined
	mode?: string | undefined
	modeApiConfigs?:
		| {
				[x: string]: string
		  }
		| undefined
	customModes?:
		| {
				slug: string
				name: string
				roleDefinition: string
				customInstructions?: string | undefined
				groups: (
					| ("read" | "edit" | "browser" | "command" | "mcp" | "modes")
					| [
							"read" | "edit" | "browser" | "command" | "mcp" | "modes",
							{
								fileRegex?: string | undefined
								description?: string | undefined
							},
					  ]
				)[]
				source?: ("global" | "project") | undefined
		  }[]
		| undefined
	customModePrompts?:
		| {
				[x: string]:
					| {
							roleDefinition?: string | undefined
							customInstructions?: string | undefined
					  }
					| undefined
		  }
		| undefined
	customSupportPrompts?:
		| {
				[x: string]: string | undefined
		  }
		| undefined
	enhancementApiConfigId?: string | undefined
}

export type { GlobalSettings }

type ProviderSettings = {
	apiProvider?:
		| (
				| "anthropic"
				| "glama"
				| "openrouter"
				| "bedrock"
				| "vertex"
				| "openai"
				| "ollama"
				| "vscode-lm"
				| "lmstudio"
				| "gemini"
				| "openai-native"
				| "mistral"
				| "deepseek"
				| "unbound"
				| "requesty"
				| "human-relay"
				| "fake-ai"
		  )
		| undefined
	apiModelId?: string | undefined
	apiKey?: string | undefined
	anthropicBaseUrl?: string | undefined
	glamaModelId?: string | undefined
	glamaModelInfo?:
		| {
				maxTokens?: number | undefined
				contextWindow: number
				supportsImages?: boolean | undefined
				supportsComputerUse?: boolean | undefined
				supportsPromptCache: boolean
				inputPrice?: number | undefined
				outputPrice?: number | undefined
				cacheWritesPrice?: number | undefined
				cacheReadsPrice?: number | undefined
				description?: string | undefined
				reasoningEffort?: ("low" | "medium" | "high") | undefined
				thinking?: boolean | undefined
		  }
		| undefined
	glamaApiKey?: string | undefined
	openRouterApiKey?: string | undefined
	openRouterModelId?: string | undefined
	openRouterModelInfo?:
		| {
				maxTokens?: number | undefined
				contextWindow: number
				supportsImages?: boolean | undefined
				supportsComputerUse?: boolean | undefined
				supportsPromptCache: boolean
				inputPrice?: number | undefined
				outputPrice?: number | undefined
				cacheWritesPrice?: number | undefined
				cacheReadsPrice?: number | undefined
				description?: string | undefined
				reasoningEffort?: ("low" | "medium" | "high") | undefined
				thinking?: boolean | undefined
		  }
		| undefined
	openRouterBaseUrl?: string | undefined
	openRouterSpecificProvider?: string | undefined
	openRouterUseMiddleOutTransform?: boolean | undefined
	awsAccessKey?: string | undefined
	awsSecretKey?: string | undefined
	awsSessionToken?: string | undefined
	awsRegion?: string | undefined
	awsUseCrossRegionInference?: boolean | undefined
	awsUsePromptCache?: boolean | undefined
	awspromptCacheId?: string | undefined
	awsProfile?: string | undefined
	awsUseProfile?: boolean | undefined
	awsCustomArn?: string | undefined
	vertexKeyFile?: string | undefined
	vertexJsonCredentials?: string | undefined
	vertexProjectId?: string | undefined
	vertexRegion?: string | undefined
	openAiBaseUrl?: string | undefined
	openAiApiKey?: string | undefined
	openAiR1FormatEnabled?: boolean | undefined
	openAiModelId?: string | undefined
	openAiCustomModelInfo?:
		| {
				maxTokens?: number | undefined
				contextWindow: number
				supportsImages?: boolean | undefined
				supportsComputerUse?: boolean | undefined
				supportsPromptCache: boolean
				inputPrice?: number | undefined
				outputPrice?: number | undefined
				cacheWritesPrice?: number | undefined
				cacheReadsPrice?: number | undefined
				description?: string | undefined
				reasoningEffort?: ("low" | "medium" | "high") | undefined
				thinking?: boolean | undefined
		  }
		| undefined
	openAiUseAzure?: boolean | undefined
	azureApiVersion?: string | undefined
	openAiStreamingEnabled?: boolean | undefined
	ollamaModelId?: string | undefined
	ollamaBaseUrl?: string | undefined
	vsCodeLmModelSelector?:
		| {
				vendor?: string | undefined
				family?: string | undefined
				version?: string | undefined
				id?: string | undefined
		  }
		| undefined
	lmStudioModelId?: string | undefined
	lmStudioBaseUrl?: string | undefined
	lmStudioDraftModelId?: string | undefined
	lmStudioSpeculativeDecodingEnabled?: boolean | undefined
	geminiApiKey?: string | undefined
	googleGeminiBaseUrl?: string | undefined
	openAiNativeApiKey?: string | undefined
	mistralApiKey?: string | undefined
	mistralCodestralUrl?: string | undefined
	deepSeekBaseUrl?: string | undefined
	deepSeekApiKey?: string | undefined
	unboundApiKey?: string | undefined
	unboundModelId?: string | undefined
	unboundModelInfo?:
		| {
				maxTokens?: number | undefined
				contextWindow: number
				supportsImages?: boolean | undefined
				supportsComputerUse?: boolean | undefined
				supportsPromptCache: boolean
				inputPrice?: number | undefined
				outputPrice?: number | undefined
				cacheWritesPrice?: number | undefined
				cacheReadsPrice?: number | undefined
				description?: string | undefined
				reasoningEffort?: ("low" | "medium" | "high") | undefined
				thinking?: boolean | undefined
		  }
		| undefined
	requestyApiKey?: string | undefined
	requestyModelId?: string | undefined
	requestyModelInfo?:
		| {
				maxTokens?: number | undefined
				contextWindow: number
				supportsImages?: boolean | undefined
				supportsComputerUse?: boolean | undefined
				supportsPromptCache: boolean
				inputPrice?: number | undefined
				outputPrice?: number | undefined
				cacheWritesPrice?: number | undefined
				cacheReadsPrice?: number | undefined
				description?: string | undefined
				reasoningEffort?: ("low" | "medium" | "high") | undefined
				thinking?: boolean | undefined
		  }
		| undefined
	modelTemperature?: (number | null) | undefined
	modelMaxTokens?: number | undefined
	modelMaxThinkingTokens?: number | undefined
	includeMaxTokens?: boolean | undefined
	fakeAi?: unknown | undefined
}

export type { ProviderSettings }
