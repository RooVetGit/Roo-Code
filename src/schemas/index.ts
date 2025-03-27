// Update to this file will automatically propgate to src/exports/types.d.ts
// via a pre-commit hook. If you want to update the types before committing you
// can run `npx tsx scripts/generate-types.ts`.

import { z } from "zod"

/**
 * ProviderName
 */

export const providerNames = [
	"anthropic",
	"glama",
	"openrouter",
	"bedrock",
	"vertex",
	"openai",
	"ollama",
	"vscode-lm",
	"lmstudio",
	"gemini",
	"openai-native",
	"mistral",
	"deepseek",
	"unbound",
	"requesty",
	"human-relay",
	"fake-ai",
] as const

export const providerNamesSchema = z.enum(providerNames)

export type ProviderName = z.infer<typeof providerNamesSchema>

/**
 * ToolGroup
 */

export const toolGroups = ["read", "edit", "browser", "command", "mcp", "modes"] as const

export const toolGroupsSchema = z.enum(toolGroups)

export type ToolGroup = z.infer<typeof toolGroupsSchema>

/**
 * CheckpointStorage
 */

export const checkpointStorages = ["task", "workspace"] as const

export const checkpointStoragesSchema = z.enum(checkpointStorages)

export type CheckpointStorage = z.infer<typeof checkpointStoragesSchema>

/**
 * Language
 */

export const languages = [
	"ca",
	"de",
	"en",
	"es",
	"fr",
	"hi",
	"it",
	"ja",
	"ko",
	"pl",
	"pt-BR",
	"tr",
	"vi",
	"zh-CN",
	"zh-TW",
] as const

export const languagesSchema = z.enum(languages)

export type Language = z.infer<typeof languagesSchema>

/**
 * TelemetrySetting
 */

export const telemetrySettings = ["unset", "enabled", "disabled"] as const

export const telemetrySettingsSchema = z.enum(telemetrySettings)

export type TelemetrySetting = z.infer<typeof telemetrySettingsSchema>

/**
 * ModelInfo
 */

export const modelInfoSchema = z.object({
	maxTokens: z.number().optional(),
	contextWindow: z.number(),
	supportsImages: z.boolean().optional(),
	supportsComputerUse: z.boolean().optional(),
	supportsPromptCache: z.boolean(),
	inputPrice: z.number().optional(),
	outputPrice: z.number().optional(),
	cacheWritesPrice: z.number().optional(),
	cacheReadsPrice: z.number().optional(),
	description: z.string().optional(),
	reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
	thinking: z.boolean().optional(),
})

export type ModelInfo = z.infer<typeof modelInfoSchema>

/**
 * ApiConfigMeta
 */

export const apiConfigMetaSchema = z.object({
	id: z.string(),
	name: z.string(),
	apiProvider: providerNamesSchema.optional(),
})

export type ApiConfigMeta = z.infer<typeof apiConfigMetaSchema>

/**
 * HistoryItem
 */

export const historyItemSchema = z.object({
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

export type HistoryItem = z.infer<typeof historyItemSchema>

/**
 * GroupEntry
 */

export const groupEntrySchema = z.union([
	toolGroupsSchema,
	z
		.tuple([
			toolGroupsSchema,
			z.object({
				fileRegex: z.string().optional(),
				description: z.string().optional(),
			}),
		])
		.readonly(),
])

export type GroupEntry = z.infer<typeof groupEntrySchema>

/**
 * ModeConfig
 */

export const modeConfigSchema = z.object({
	slug: z.string(),
	name: z.string(),
	roleDefinition: z.string(),
	customInstructions: z.string().optional(),
	groups: z.array(groupEntrySchema).readonly(),
	source: z.enum(["global", "project"]).optional(),
})

export type ModeConfig = z.infer<typeof modeConfigSchema>

/**
 * ExperimentId
 */

export const experimentIdSchema = z.object({
	experimentalDiffStrategy: z.boolean(),
	search_and_replace: z.boolean(),
	insert_content: z.boolean(),
	powerSteering: z.boolean(),
	multi_search_and_replace: z.boolean(),
})

export type ExperimentId = z.infer<typeof experimentIdSchema>

/**
 * GlobalSettings
 */

export const globalSettingsSchema = z.object({
	currentApiConfigName: z.string().optional(),
	listApiConfigMeta: z.array(apiConfigMetaSchema).optional(),
	pinnedApiConfigs: z.record(z.string(), z.boolean()).optional(),

	lastShownAnnouncementId: z.string().optional(),
	customInstructions: z.string().optional(),
	taskHistory: z.array(historyItemSchema).optional(),

	autoApprovalEnabled: z.boolean().optional(),
	alwaysAllowReadOnly: z.boolean().optional(),
	alwaysAllowReadOnlyOutsideWorkspace: z.boolean().optional(),
	alwaysAllowWrite: z.boolean().optional(),
	alwaysAllowWriteOutsideWorkspace: z.boolean().optional(),
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
	checkpointStorage: checkpointStoragesSchema.optional(),

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
	experiments: experimentIdSchema.optional(),

	language: languagesSchema.optional(),

	telemetrySetting: telemetrySettingsSchema.optional(),

	mcpEnabled: z.boolean().optional(),
	enableMcpServerCreation: z.boolean().optional(),

	mode: z.string().optional(),
	modeApiConfigs: z.record(z.string(), z.string()).optional(),
	customModes: z.array(modeConfigSchema).optional(),
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

export type GlobalSettings = z.infer<typeof globalSettingsSchema>

type TypeDefinition = {
	schema: z.ZodTypeAny
	identifier: string
}

export const typeDefinitions: TypeDefinition[] = [
	{ schema: providerNamesSchema, identifier: "ProviderName" },
	{ schema: toolGroupsSchema, identifier: "ToolGroup" },
	{ schema: checkpointStoragesSchema, identifier: "CheckpointStorage" },
	{ schema: languagesSchema, identifier: "Language" },
	{ schema: telemetrySettingsSchema, identifier: "TelemetrySetting" },
	{ schema: modelInfoSchema, identifier: "ModelInfo" },
	{ schema: apiConfigMetaSchema, identifier: "ApiConfigMeta" },
	{ schema: historyItemSchema, identifier: "HistoryItem" },
	{ schema: groupEntrySchema, identifier: "GroupEntry" },
	{ schema: modeConfigSchema, identifier: "ModeConfig" },
	{ schema: experimentIdSchema, identifier: "ExperimentId" },
	{ schema: globalSettingsSchema, identifier: "GlobalSettings" },
]
