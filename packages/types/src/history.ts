import { z } from "zod"

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
	workspace: z.string().optional(),
})

export type HistoryItem = z.infer<typeof historyItemSchema>

/**
 * HistorySearchResultItem - extends HistoryItem with match positions from fzf
 */
export const historySearchResultItemSchema = historyItemSchema.extend({
	match: z
		.object({
			positions: z.array(z.number()),
		})
		.optional(),
})

export type HistorySearchResultItem = z.infer<typeof historySearchResultItemSchema>

/**
 * HistorySearchResults - contains a list of search results with match information
 * and unique workspaces encountered during the search
 */
/**
 * HistoryWorkspaceItem - represents a workspace with metadata
 */
export const historyWorkspaceItemSchema = z.object({
	path: z.string(),
	name: z.string(),
	missing: z.boolean(),
	ts: z.number(),
})

export type HistoryWorkspaceItem = z.infer<typeof historyWorkspaceItemSchema>

export const historySearchResultsSchema = z.object({
	items: z.array(historySearchResultItemSchema),
	workspaces: z.array(z.string()).optional(),
	workspaceItems: z.array(historyWorkspaceItemSchema).optional(),
})

export type HistorySearchResults = z.infer<typeof historySearchResultsSchema>

/**
 * Sort options for history items
 */
export type HistorySortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

/**
 * HistorySearchOptions
 */
export interface HistorySearchOptions {
	searchQuery?: string
	limit?: number
	workspacePath?: string
	sortOption?: HistorySortOption
	showAllWorkspaces?: boolean
	dateRange?: { fromTs?: number; toTs?: number }
}
