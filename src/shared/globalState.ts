import { z } from "zod"

import type {
	ProviderName,
	ExperimentId,
	CheckpointStorage,
	ToolGroup,
	Language,
	TelemetrySetting,
	SecretKey,
	GlobalStateKey,
	GlobalConfiguration,
} from "../exports/roo-code"

import { AssertEqual, Equals } from "../utils/type-fu"

/**
 * ProviderName
 */

const providerNames: Record<ProviderName, true> = {
	anthropic: true,
	glama: true,
	openrouter: true,
	bedrock: true,
	vertex: true,
	openai: true,
	ollama: true,
	lmstudio: true,
	gemini: true,
	"openai-native": true,
	deepseek: true,
	"vscode-lm": true,
	mistral: true,
	unbound: true,
	requesty: true,
	"human-relay": true,
	"fake-ai": true,
}

const providerNameKeys = Object.keys(providerNames) as ProviderName[]

const PROVIDER_NAMES: [ProviderName, ...ProviderName[]] = [
	providerNameKeys[0],
	...providerNameKeys.slice(1).map((p) => p),
]

/**
 * ExperimentId
 */

const experimentIds: Record<ExperimentId, true> = {
	experimentalDiffStrategy: true,
	search_and_replace: true,
	insert_content: true,
	powerSteering: true,
	multi_search_and_replace: true,
}

const experimentIdKeys = Object.keys(experimentIds) as ExperimentId[]

const EXPERIMENT_IDS: [ExperimentId, ...ExperimentId[]] = [
	experimentIdKeys[0],
	...experimentIdKeys.slice(1).map((p) => p),
]

/**
 * CheckpointStorage
 */

const checkpointStorages: Record<CheckpointStorage, true> = {
	task: true,
	workspace: true,
}

const checkpointStorageKeys = Object.keys(checkpointStorages) as CheckpointStorage[]

const CHECKPOINT_STORAGES: [CheckpointStorage, ...CheckpointStorage[]] = [
	checkpointStorageKeys[0],
	...checkpointStorageKeys.slice(1).map((p) => p),
]

/**
 * ToolGroup
 */

const toolGroups: Record<ToolGroup, true> = {
	read: true,
	edit: true,
	browser: true,
	command: true,
	mcp: true,
	modes: true,
}

const toolGroupKeys = Object.keys(toolGroups) as ToolGroup[]

const TOOL_GROUPS: [ToolGroup, ...ToolGroup[]] = [toolGroupKeys[0], ...toolGroupKeys.slice(1).map((p) => p)]

/**
 * Language
 */

const languages: Record<Language, true> = {
	ca: true,
	de: true,
	en: true,
	es: true,
	fr: true,
	hi: true,
	it: true,
	ja: true,
	ko: true,
	pl: true,
	"pt-BR": true,
	tr: true,
	vi: true,
	"zh-CN": true,
	"zh-TW": true,
}

const languageKeys = Object.keys(languages) as Language[]

const LANGUAGES: [Language, ...Language[]] = [languageKeys[0], ...languageKeys.slice(1).map((p) => p)]

/**
 * TelemetrySetting
 */

const telemetrySettings: Record<TelemetrySetting, true> = {
	unset: true,
	enabled: true,
	disabled: true,
}

const telemetrySettingKeys = Object.keys(telemetrySettings) as TelemetrySetting[]

const TELEMETRY_SETTINGS: [TelemetrySetting, ...TelemetrySetting[]] = [
	telemetrySettingKeys[0],
	...telemetrySettingKeys.slice(1).map((p) => p),
]

/**
 * SecretKey
 */

export type { SecretKey }

const secretKeys: Record<SecretKey, true> = {
	apiKey: true,
	glamaApiKey: true,
	openRouterApiKey: true,
	awsAccessKey: true,
	awsSecretKey: true,
	awsSessionToken: true,
	openAiApiKey: true,
	geminiApiKey: true,
	openAiNativeApiKey: true,
	deepSeekApiKey: true,
	mistralApiKey: true,
	unboundApiKey: true,
	requestyApiKey: true,
}

export const SECRET_KEYS = Object.keys(secretKeys) as SecretKey[]

export const isSecretKey = (key: string): key is SecretKey => SECRET_KEYS.includes(key as SecretKey)

/**
 * GlobalStateKey
 */

export type { GlobalStateKey }

export const globalStateKeys: Record<GlobalStateKey, true> = {
	apiProvider: true,
	apiModelId: true,
	glamaModelId: true,
	glamaModelInfo: true,
	awsRegion: true,
	awsUseCrossRegionInference: true,
	awsProfile: true,
	awsUseProfile: true,
	awsCustomArn: true,
	awsUsePromptCache: true,
	awspromptCacheId: true,
	vertexKeyFile: true,
	vertexJsonCredentials: true,
	vertexProjectId: true,
	vertexRegion: true,
	lastShownAnnouncementId: true,
	customInstructions: true,
	alwaysAllowReadOnly: true,
	alwaysAllowWrite: true,
	alwaysAllowExecute: true,
	alwaysAllowBrowser: true,
	alwaysAllowMcp: true,
	alwaysAllowModeSwitch: true,
	alwaysAllowSubtasks: true,
	taskHistory: true,
	openAiBaseUrl: true,
	openAiModelId: true,
	openAiCustomModelInfo: true,
	openAiUseAzure: true,
	ollamaModelId: true,
	ollamaBaseUrl: true,
	lmStudioModelId: true,
	lmStudioBaseUrl: true,
	anthropicBaseUrl: true,
	includeMaxTokens: true,
	modelMaxThinkingTokens: true,
	azureApiVersion: true,
	openAiStreamingEnabled: true,
	openAiR1FormatEnabled: true,
	openRouterModelId: true,
	openRouterModelInfo: true,
	openRouterBaseUrl: true,
	openRouterSpecificProvider: true,
	openRouterUseMiddleOutTransform: true,
	googleGeminiBaseUrl: true,
	deepSeekBaseUrl: true,
	allowedCommands: true,
	soundEnabled: true,
	ttsEnabled: true,
	ttsSpeed: true,
	soundVolume: true,
	diffEnabled: true,
	enableCheckpoints: true,
	checkpointStorage: true,
	browserViewportSize: true,
	screenshotQuality: true,
	remoteBrowserHost: true,
	fuzzyMatchThreshold: true,
	writeDelayMs: true,
	terminalOutputLineLimit: true,
	terminalShellIntegrationTimeout: true,
	mcpEnabled: true,
	enableMcpServerCreation: true,
	alwaysApproveResubmit: true,
	requestDelaySeconds: true,
	rateLimitSeconds: true,
	currentApiConfigName: true,
	listApiConfigMeta: true,
	vsCodeLmModelSelector: true,
	mode: true,
	modeApiConfigs: true,
	customModePrompts: true,
	customSupportPrompts: true,
	enhancementApiConfigId: true,
	experiments: true, // Map of experiment IDs to their enabled state.
	autoApprovalEnabled: true,
	enableCustomModeCreation: true, // Enable the ability for Roo to create custom modes.
	customModes: true, // Array of custom modes.
	unboundModelId: true,
	requestyModelId: true,
	requestyModelInfo: true,
	unboundModelInfo: true,
	modelTemperature: true,
	modelMaxTokens: true,
	mistralCodestralUrl: true,
	maxOpenTabsContext: true,
	browserToolEnabled: true,
	lmStudioSpeculativeDecodingEnabled: true,
	lmStudioDraftModelId: true,
	telemetrySetting: true,
	showRooIgnoredFiles: true,
	remoteBrowserEnabled: true,
	language: true,
	maxWorkspaceFiles: true,
	maxReadFileLine: true,
	fakeAi: true,
}

export const GLOBAL_STATE_KEYS = Object.keys(globalStateKeys) as GlobalStateKey[]

export const isGlobalStateKey = (key: string): key is GlobalStateKey =>
	GLOBAL_STATE_KEYS.includes(key as GlobalStateKey)

/**
 * Schemas
 */

const apiConfigMetaSchema = z.object({
	id: z.string(),
	name: z.string(),
	apiProvider: z.enum(PROVIDER_NAMES).optional(),
})

const taskHistorySchema = z.object({
	id: z.string(),
	number: z.number(),
	ts: z.number(),
	task: z.string(),
	tokensIn: z.number(),
	tokensOut: z.number(),
	cacheWrites: z.number().optional(),
	cacheReads: z.number().optional(),
	totalCost: z.number(),
	size: z.number().optional(),
})

const toolGroupSchema = z.enum(TOOL_GROUPS)

const groupEntrySchema = z.union([
	toolGroupSchema,
	z
		.tuple([
			toolGroupSchema,
			z.object({
				fileRegex: z.string().optional(),
				description: z.string().optional(),
			}),
		])
		.readonly(),
])

const modeConfigSchema = z.object({
	slug: z.string(),
	name: z.string(),
	roleDefinition: z.string(),
	customInstructions: z.string().optional(),
	groups: z.array(groupEntrySchema).readonly(),
	source: z.enum(["global", "project"]).optional(),
})

const experimentsSchema = z.object({
	experimentalDiffStrategy: z.boolean(),
	search_and_replace: z.boolean(),
	insert_content: z.boolean(),
	powerSteering: z.boolean(),
	multi_search_and_replace: z.boolean(),
})

export const globalConfigurationSchema = z.object({
	currentApiConfigName: z.string().optional(),
	listApiConfigMeta: z.array(apiConfigMetaSchema).optional(),
	lastShownAnnouncementId: z.string().optional(),
	customInstructions: z.string().optional(),
	taskHistory: z.array(taskHistorySchema).optional(),

	autoApprovalEnabled: z.boolean().optional(),
	alwaysAllowReadOnly: z.boolean().optional(),
	alwaysAllowWrite: z.boolean().optional(),
	writeDelayMs: z.number().optional(),
	alwaysAllowBrowser: z.boolean().optional(),
	alwaysApproveResubmit: z.boolean().optional(),
	requestDelaySeconds: z.number().optional(),
	alwaysAllowMcp: z.boolean().optional(),
	alwaysAllowModeSwitch: z.boolean().optional(),
	alwaysAllowSubtasks: z.boolean().optional(),
	alwaysAllowExecute: z.boolean().optional(),
	allowedCommands: z.array(z.string()).optional(),

	browserToolEnabled: z.boolean().optional(),
	browserViewportSize: z.string().optional(),
	screenshotQuality: z.number().optional(),
	remoteBrowserEnabled: z.boolean().optional(),
	remoteBrowserHost: z.string().optional(),

	enableCheckpoints: z.boolean().optional(),
	checkpointStorage: z.enum(CHECKPOINT_STORAGES).optional(),

	ttsEnabled: z.boolean().optional(),
	ttsSpeed: z.number().optional(),
	soundEnabled: z.boolean().optional(),
	soundVolume: z.number().optional(),

	maxOpenTabsContext: z.number().optional(),
	maxWorkspaceFiles: z.number().optional(),
	showRooIgnoredFiles: z.boolean().optional(),
	maxReadFileLine: z.number().optional(),

	terminalOutputLineLimit: z.number().optional(),
	terminalShellIntegrationTimeout: z.number().optional(),

	rateLimitSeconds: z.number().optional(),
	diffEnabled: z.boolean().optional(),
	fuzzyMatchThreshold: z.number().optional(),
	experiments: experimentsSchema.optional(),

	language: z.enum(LANGUAGES).optional(),

	telemetrySetting: z.enum(TELEMETRY_SETTINGS).optional(),

	mcpEnabled: z.boolean().optional(),
	enableMcpServerCreation: z.boolean().optional(),

	mode: z.string().optional(),
	modeApiConfigs: z.record(z.string(), z.string()).optional(),
	customModes: z.array(modeConfigSchema),
	enableCustomModeCreation: z.boolean().optional(),
	customModePrompts: z
		.record(
			z.string(),
			z
				.object({
					roleDefinition: z.string().optional(),
					customInstructions: z.string().optional(),
				})
				.optional(),
		)
		.optional(),
	customSupportPrompts: z.record(z.string(), z.string().optional()).optional(),
	enhancementApiConfigId: z.string().optional(),
})

// Throws a type error if the inferred type of the schema is not equal to the
// type of the GlobalConfiguration.
type _AssertGlobalConfigurationMatchesSchema = AssertEqual<
	Equals<GlobalConfiguration, z.infer<typeof globalConfigurationSchema>>
>

/**
 * Pass-through state keys.
 * TODO: What are these?
 */

export const PASS_THROUGH_STATE_KEYS = ["taskHistory"] as const

export const isPassThroughStateKey = (key: string): key is (typeof PASS_THROUGH_STATE_KEYS)[number] =>
	PASS_THROUGH_STATE_KEYS.includes(key as (typeof PASS_THROUGH_STATE_KEYS)[number])
