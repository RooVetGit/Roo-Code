import { z } from "zod"

import { messageSchema } from "@/components/ui/chat"

/**
 * DeepResearchModel
 */

export const deepResearchProviders = ["openai-native", "openrouter"] as const

export type DeepResearchProviderId = (typeof deepResearchProviders)[number]

export const deepResearchModelKeys = [
	"o3-mini-high",
	"o3-mini",
	"o1",
	"o1-preview",
	"o1-mini",
	"gpt-4o",
	"gpt-4o-mini",
] as const

export type DeepResearchModelKey = (typeof deepResearchModelKeys)[number]

export type DeepResearchModelId = DeepResearchModelKey | `openai/${DeepResearchModelKey}`

export type DeepResearchModel = {
	key: DeepResearchModelKey
	modelIds: Record<DeepResearchProviderId, DeepResearchModelId>
	maxTokens: number
	contextWindow: number
	inputPrice: number
	outputPrice: number
	reasoningEffort?: "low" | "medium" | "high" | "none"
}

export const deepResearchModels: DeepResearchModel[] = [
	{
		key: "o3-mini-high",
		modelIds: {
			"openai-native": "o3-mini-high",
			openrouter: "openai/o3-mini-high",
		},
		maxTokens: 100_000,
		contextWindow: 200_000,
		inputPrice: 1.1,
		outputPrice: 4.4,
		reasoningEffort: "high",
	},
	{
		key: "o3-mini",
		modelIds: {
			"openai-native": "o3-mini",
			openrouter: "openai/o3-mini",
		},
		maxTokens: 100_000,
		contextWindow: 200_000,
		inputPrice: 1.1,
		outputPrice: 4.4,
		reasoningEffort: "medium",
	},
	{
		key: "o1",
		modelIds: {
			"openai-native": "o1",
			openrouter: "openai/o1",
		},
		maxTokens: 100_000,
		contextWindow: 200_000,
		inputPrice: 15,
		outputPrice: 60,
	},
	{
		key: "o1-preview",
		modelIds: {
			"openai-native": "o1-preview",
			openrouter: "openai/o1-preview",
		},
		maxTokens: 32_768,
		contextWindow: 128_000,
		inputPrice: 15,
		outputPrice: 60,
	},
	{
		key: "o1-mini",
		modelIds: {
			"openai-native": "o1-mini",
			openrouter: "openai/o1-mini",
		},
		maxTokens: 65_536,
		contextWindow: 128_000,
		inputPrice: 1.1,
		outputPrice: 4.4,
	},
	{
		key: "gpt-4o",
		modelIds: {
			"openai-native": "gpt-4o",
			openrouter: "openai/gpt-4o",
		},
		maxTokens: 4_096,
		contextWindow: 128_000,
		inputPrice: 5,
		outputPrice: 15,
	},
	{
		key: "gpt-4o-mini",
		modelIds: {
			"openai-native": "gpt-4o-mini",
			openrouter: "openai/gpt-4o-mini",
		},
		maxTokens: 16_384,
		contextWindow: 128_000,
		inputPrice: 0.15,
		outputPrice: 0.6,
	},
]

/**
 * Provider
 */

export const isProvider = (provider: string): provider is ProviderId =>
	deepResearchProviders.includes(provider as ProviderId)

export enum ProviderId {
	OpenRouter = "openrouter",
	OpenAI = "openai-native",
}

export type ProviderMetadata = {
	profileId: string
	profileName: string
	providerId: ProviderId
	providerName: string
}

export type Provider = ProviderMetadata & {
	providerApiKey?: string
	firecrawlApiKey?: string
}

/**
 * Validates a Firecrawl API key by making a test request
 */
export async function validateFirecrawlApiKey(key: string): Promise<boolean> {
	if (!key) return false
	try {
		const response = await fetch("https://api.firecrawl.dev/v1/team/credit-usage", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${key}`,
			},
		})
		return response.ok
	} catch (error) {
		return false
	}
}

/**
 * Research Session
 */
export const researchSessionSchema = z.object({
	providerId: z.nativeEnum(ProviderId),
	providerApiKey: z.string().min(1, { message: "Provider API key is required." }),
	firecrawlApiKey: z.string().min(1, { message: "Firecrawl API key is required." }),
	modelId: z
		.string()
		.refine(
			(value): value is DeepResearchModelId =>
				deepResearchModelKeys.some((key) => value === key || value === `openai/${key}`),
			{ message: "Invalid model ID format" },
		),
	breadth: z.number().min(1).max(10, { message: "Breadth must be between 1 and 10." }),
	depth: z.number().min(0).max(9, { message: "Depth must be between 0 and 9." }),
	concurrency: z.number().min(1).max(5, { message: "Concurrency must be between 1 and 5." }),
	query: z.string().min(1, { message: "Research topic is required." }),
})

export type ResearchSession = z.infer<typeof researchSessionSchema>

/**
 * Loading
 */

export const loadingSchema = z.object({
	isLoading: z.boolean(),
	message: z.string().optional(),
})

export type Loading = z.infer<typeof loadingSchema>

/**
 * Research Progress
 */

export const researchProgressSchema = z.object({
	completedQueries: z.number().min(0),
	expectedQueries: z.number().min(0),
	progressPercentage: z.number().min(0).max(100),
})

export type ResearchProgress = z.infer<typeof researchProgressSchema>

/**
 * Research Status
 */

export const researchStatusSchema = z.object({
	status: z.enum(["idle", "followUp", "research", "done", "aborted"]),
})

export type ResearchStatus = z.infer<typeof researchStatusSchema>

/**
 * Research Token Usage
 */

export const researchTokenUsageSchema = z.object({
	inTokens: z.number().min(0),
	outTokens: z.number().min(0),
	totalTokens: z.number().min(0),
})

export type ResearchTokenUsage = z.infer<typeof researchTokenUsageSchema>

/**
 * Research History Task
 */

export const researchHistoryTaskSchema = z.object({
	taskId: z.string(),
	query: z.string(),
	createdAt: z.number().transform((timestamp) => new Date(timestamp)),
})

export type ResearchHistoryTask = z.infer<typeof researchHistoryTaskSchema>

/**
 * Research Task
 */

const researchInquirySchema = z.object({
	initialQuery: z.string().optional(),
	followUps: z.array(z.string()),
	responses: z.array(z.string()),
	query: z.string().optional(),
	learnings: z.array(z.string()).optional(),
	urls: z.array(z.string()).optional(),
	report: z.string().optional(),
	fileUri: z.string().optional(),
})

export const researchTaskSchema = z.object({
	taskId: z.string(),
	providerId: z.string(),
	modelId: z.string(),
	breadth: z.number(),
	depth: z.number(),
	concurrency: z.number(),
	inquiry: researchInquirySchema,
	output: z.array(messageSchema),
	createdAt: z.number().transform((timestamp) => new Date(timestamp)),
})

export type ResearchTask = z.infer<typeof researchTaskSchema>
