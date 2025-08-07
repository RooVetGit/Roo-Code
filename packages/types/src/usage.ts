import { z } from "zod"

/**
 * Schema for persistent usage tracking item
 * Stores cost and token data for completed tasks
 */
export const PersistentUsageItemSchema = z.object({
	taskId: z.string(),
	taskWorkspace: z.string(), // Workspace path for filtering
	mode: z.string().optional(),
	timestamp: z.number(),
	cost: z.number().default(0),
	inputTokens: z.number().default(0),
	outputTokens: z.number().default(0),
	cacheReads: z.number().default(0),
	cacheWrites: z.number().default(0),
})

export type PersistentUsageItem = z.infer<typeof PersistentUsageItemSchema>

/**
 * Usage summary data structure for frontend display
 */
export interface UsageSummary {
	totalCost: number
	totalInputTokens: number
	totalOutputTokens: number
	totalCacheReads: number
	totalCacheWrites: number
	modeBreakdown: Record<
		string,
		{
			cost: number
			inputTokens: number
			outputTokens: number
			cacheReads: number
			cacheWrites: number
			count: number
		}
	>
	workspaceName?: string
}
