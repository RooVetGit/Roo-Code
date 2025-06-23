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
	dateRange?: { fromTs?: number; toTs?: number }
}

/**
 * Represents the results of a scan of the task history on disk and in global state.
 * This is a read-only data structure used to report the state of the history to the UI.
 */
export interface HistoryScanResults {
	/**
	 * The number of valid tasks found during the scan.
	 * This is equivalent to tasks.valid.size.
	 */
	validCount: number

	tasks: {
		/**
		 * Tasks with a valid `history_item.json` file.
		 * Key: Task ID, Value: The corresponding HistoryItem.
		 */
		valid: Map<string, HistoryItem>

		/**
		 * Tasks found in the legacy globalState array but not on the filesystem.
		 * Key: Task ID, Value: The corresponding HistoryItem from globalState.
		 */
		tasksOnlyInGlobalState: Map<string, HistoryItem>

		/**
		 * Tasks found in the <state>/taskHistory/ indexes but not in the globalState array.
		 * Key: Task ID, Value: The corresponding HistoryItem from file indexes.
		 */
		tasksOnlyInTaskHistoryIndexes: Map<string, HistoryItem>

		/**
		 * Tasks found on the filesystem that are not in the index, but
		 * successfully reconstructed in-memory from history_item.json or ui_messages.json
		 * Key: Task ID, Value: The reconstructed HistoryItem.
		 */
		orphans: Map<string, HistoryItem>

		/**
		 * Task IDs for which in-memory reconstruction from UI messages failed.
		 * Value: The Task ID.
		 */
		failedReconstructions: Set<string>
	}
}

/**
 * Options for rebuilding history indexes.
 */
export interface HistoryRebuildOptions {
	/**
	 * The rebuild mode (not applicable when doing a scan):
	 * - "replace": Creates fresh indexes, replacing existing ones
	 * - "merge": Only indexes missing/changed history items, preserving existing data
	 */
	mode: "replace" | "merge"

	/**
	 * Whether to merge items from globalState.
	 * When true, moves globalState tasks to the rebuild process.
	 */
	mergeFromGlobal?: boolean

	/**
	 * Whether to merge rebuilt items to globalState.
	 * When true, updates context.globalState with the rebuilt history items.
	 */
	mergeToGlobal?: boolean

	/**
	 * Whether to scan for orphan history_item.json files during the rebuild process.
	 * When true, use file system scanning to find all files
	 * When false (default), use getHistoryItemsForSearch() because it is faster to use the index
	 */
	scanHistoryFiles?: boolean

	/**
	 * Whether to attempt reconstructing orphaned tasks.
	 * When true, writes orphaned items to disk.
	 */
	reconstructOrphans?: boolean

	/**
	 * Array to collect log messages during the operation.
	 * If provided, all operation logs will be added to this array.
	 */
	logs?: string[]

	/**
	 * Whether to skip the verification scan after rebuilding.
	 * When true, skips the verification step to improve performance.
	 */
	noVerify?: boolean
}
