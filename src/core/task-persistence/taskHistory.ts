import * as path from "path"
import * as fs from "fs/promises"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { HistoryItem, HistorySortOption, HistorySearchOptions, HistorySearchResults } from "@roo-code/types"
import { getExtensionContext } from "../../extension"
import { taskHistorySearch } from "./taskHistorySearch"

const TASK_HISTORY_MONTH_INDEX_PREFIX = "task_history-"
const TASK_HISTORY_DIR_NAME = "tasks"
const TASK_HISTORY_VERSION_KEY = "taskHistoryVersion"
const CURRENT_TASK_HISTORY_VERSION = 2 // Version 1: old array, Version 2: new file-based

const itemObjectCache = new Map<string, HistoryItem>()

/**
 * Gets the base path for task history storage.
 * @returns The base path string.
 */
function _getBasePath(): string {
	const context = getExtensionContext()
	return path.join(context.globalStorageUri.fsPath, TASK_HISTORY_DIR_NAME)
}

/**
 * Extracts year (YYYY) and month (MM) from a timestamp.
 * @param timestamp - Milliseconds since epoch.
 * @returns Object with year and month strings.
 */
function _getYearMonthFromTs(timestamp: number): { year: string; month: string } {
	const date = new Date(timestamp)
	const year = date.getFullYear().toString()
	const month = (date.getMonth() + 1).toString().padStart(2, "0")
	return { year, month }
}

/**
 * Generates the globalState key for a given year and month.
 * @param year - YYYY string.
 * @param month - MM string.
 * @returns The globalState key string.
 */
function _getGlobalStateMonthKey(year: string, month: string): string {
	return `${TASK_HISTORY_MONTH_INDEX_PREFIX}${year}-${month}`
}

/**
 * Parses year and month from a globalState month key.
 * @param key - The globalState key string (e.g., "task_history-YYYY-MM").
 * @returns Object with year and month strings, or null if key format is invalid.
 */
function _parseGlobalStateMonthKey(key: string): { year: string; month: string } | null {
	const monthKeyRegex = new RegExp(`^${TASK_HISTORY_MONTH_INDEX_PREFIX}(\\d{4})-(\\d{2})$`)
	const match = key.match(monthKeyRegex)
	if (match && match.length === 3) {
		return { year: match[1], month: match[2] }
	}
	return null
}

/**
 * Constructs the full file path for a history item.
 * @param taskId - The ID of the task.
 * @returns Full path to the history item's JSON file.
 */
function _getHistoryItemPath(taskId: string): string {
	const currentBasePath = _getBasePath()
	return path.join(currentBasePath, taskId, "history_item.json")
}

/**
 * Reads the index object for a given month from globalState.
 * The object maps workspacePath to an inner object, which maps taskId to its timestamp.
 * e.g., { "workspace/path": { "task-id-1": 12345, "task-id-2": 67890 } }
 * @param year - YYYY string.
 * @param month - MM string.
 * @returns The Record of {workspacePath: {[taskId: string]: timestamp}}, or an empty object if not found.
 */
async function _readGlobalStateMonthIndex(
	year: string,
	month: string,
): Promise<Record<string, Record<string, number>>> {
	const context = getExtensionContext()
	const monthKey = _getGlobalStateMonthKey(year, month)
	const storedData = context.globalState.get<Record<string, Record<string, number>>>(monthKey)

	if (storedData && typeof storedData === "object" && !Array.isArray(storedData)) {
		return storedData
	}
	return {}
}

/**
 * Writes the index object for a given month to globalState.
 * @param year - YYYY string.
 * @param month - MM string.
 * @param indexData - The Record of {workspacePath: {[taskId: string]: timestamp}} to write.
 */
async function _writeGlobalStateMonthIndex(
	year: string,
	month: string,
	indexData: Record<string, Record<string, number>>,
): Promise<void> {
	const context = getExtensionContext()
	const monthKey = _getGlobalStateMonthKey(year, month)
	// The indexData is already in the correct Record format to be stored.
	await context.globalState.update(monthKey, indexData)
}

/**
 * Extracts task references from month data, optionally filtering by workspace.
 * @param monthDataByWorkspace - The month data indexed by workspace.
 * @param workspacePath - Optional workspace path to filter by.
 * @returns Array of task references with id and timestamp.
 */
function _getTasksByWorkspace(
	monthDataByWorkspace: Record<string, Record<string, number>>,
	workspacePath?: string,
): Array<{ id: string; ts: number }> {
	const tasksToFetch: Array<{ id: string; ts: number }> = []

	if (workspacePath !== undefined) {
		// Filter by single workspace
		const tasksInWorkspace = monthDataByWorkspace[workspacePath]
		if (tasksInWorkspace) {
			for (const id in tasksInWorkspace) {
				if (Object.prototype.hasOwnProperty.call(tasksInWorkspace, id)) {
					tasksToFetch.push({ id, ts: tasksInWorkspace[id] })
				}
			}
		}
	} else {
		// All workspaces for the month
		for (const wsPathKey in monthDataByWorkspace) {
			const tasksInCurrentWorkspace = monthDataByWorkspace[wsPathKey]
			if (tasksInCurrentWorkspace) {
				for (const id in tasksInCurrentWorkspace) {
					if (Object.prototype.hasOwnProperty.call(tasksInCurrentWorkspace, id)) {
						tasksToFetch.push({ id, ts: tasksInCurrentWorkspace[id] })
					}
				}
			}
		}
	}

	return tasksToFetch
}

/**
 * Prepares task references for processing by filtering by date range and sorting.
 * We consider this "fast" because it does not read the history item from disk,
 * so it is a preliminary sort-filter.
 *
 * @param tasks - Array of task references with id and timestamp.
 * @param dateRange - Optional date range to filter by.
 * @param sortOption - Optional sort option (defaults to "newest").
 * @returns Filtered and sorted array of task references.
 */
function _fastSortFilterTasks(
	tasks: Array<{ id: string; ts: number }>,
	dateRange?: { fromTs?: number; toTs?: number },
	sortOption: HistorySortOption = "newest",
): Array<{ id: string; ts: number }> {
	const fromTsNum = dateRange?.fromTs
	const toTsNum = dateRange?.toTs

	// Filter by date range
	let filteredTasks = tasks
	if (fromTsNum || toTsNum) {
		filteredTasks = tasks.filter((taskRef) => {
			if (fromTsNum && taskRef.ts < fromTsNum) {
				return false
			}
			if (toTsNum && taskRef.ts > toTsNum) {
				return false
			}
			return true
		})
	}

	// Sort by timestamp based on sortOption
	if (sortOption === "oldest") {
		return filteredTasks.sort((a, b) => a.ts - b.ts)
	} else {
		// Default to "newest" for all other sort options at this stage
		// Other sort options (mostExpensive, mostTokens, mostRelevant) require the full HistoryItem
		// and will be handled by _sortHistoryItems after fetching the items
		return filteredTasks.sort((a, b) => b.ts - a.ts)
	}
}

// Public API Functions

/**
 * Adds or updates multiple history items.
 * This is the primary method for saving items.
 * @param items - An array of HistoryItem objects to set.
 */
export async function setHistoryItems(items: HistoryItem[]): Promise<void> {
	if (!Array.isArray(items)) {
		throw new Error("Invalid argument: items must be an array.")
	}

	const affectedMonthIndexes = new Map<string, Record<string, Record<string, number>>>()

	for (const item of items) {
		if (!item || !item.id || typeof item.ts !== "number" || typeof item.task !== "string") {
			console.warn(
				`[TaskHistory Migration] Invalid HistoryItem skipped (missing id, ts, or task): ${JSON.stringify(item)}`,
			)
			continue
		}

		const itemPath = _getHistoryItemPath(item.id)
		const dirPath = path.dirname(itemPath)

		try {
			await fs.mkdir(dirPath, { recursive: true })

			// Save and cache the item
			await safeWriteJson(itemPath, item)
			itemObjectCache.set(item.id, item)

			const { year, month } = _getYearMonthFromTs(item.ts)
			const monthKeyString = `${year}-${month}`

			// Use "" as the index key if item.workspace is undefined, otherwise use item.workspace.
			// The item.workspace property itself on the 'item' object is not modified.
			const workspacePathForIndex = item.workspace === undefined ? "" : item.workspace

			let currentMonthData: Record<string, Record<string, number>>
			if (affectedMonthIndexes.has(monthKeyString)) {
				currentMonthData = affectedMonthIndexes.get(monthKeyString)!
			} else {
				currentMonthData = await _readGlobalStateMonthIndex(year, month)
			}

			if (!currentMonthData[workspacePathForIndex]) {
				currentMonthData[workspacePathForIndex] = {}
			}
			currentMonthData[workspacePathForIndex][item.id] = item.ts
			affectedMonthIndexes.set(monthKeyString, currentMonthData)
		} catch (error) {
			console.error(`[TaskHistory Migration] Error processing history item ${item.id}:`, error)
		}
	}

	for (const [monthKeyString, monthMap] of affectedMonthIndexes.entries()) {
		const [year, month] = monthKeyString.split("-")
		try {
			await _writeGlobalStateMonthIndex(year, month, monthMap)
		} catch (error) {
			console.error(`[TaskHistory Migration] Error writing globalState index for ${monthKeyString}:`, error)
		}
	}
}

/**
 * Retrieves a specific history item by its ID.
 * Uses an in-memory cache first, then falls back to file storage.
 * @param taskId - The ID of the task to retrieve.
 * @returns The HistoryItem if found, otherwise undefined.
 */
export async function getHistoryItem(taskId: string): Promise<HistoryItem | undefined> {
	// Check cache first (fast path)
	if (itemObjectCache.has(taskId)) {
		return itemObjectCache.get(taskId)
	}

	// Cache miss - read from file
	const itemPath = _getHistoryItemPath(taskId)
	try {
		const fileContent = await fs.readFile(itemPath, "utf8")
		const historyItem: HistoryItem = JSON.parse(fileContent)
		itemObjectCache.set(taskId, historyItem)

		return historyItem
	} catch (error: any) {
		if (error.code !== "ENOENT") {
			console.error(`[TaskHistory] [getHistoryItem] [${taskId}] error reading file ${itemPath}:`, error)
		}
		return undefined
	}
}

/**
 * Deletes a history item by its ID.
 * This involves deleting the item's file and removing its references from ALL globalState month indexes.
 * @param taskId - The ID of the task to delete.
 */
export async function deleteHistoryItem(taskId: string): Promise<void> {
	if (!taskId) {
		throw new Error("Invalid arguments: taskId is required.")
	}

	const itemPath = _getHistoryItemPath(taskId)
	const itemDir = path.dirname(itemPath)

	try {
		await fs.rm(itemDir, { recursive: true, force: true })
	} catch (error: any) {
		if (error.code !== "ENOENT") {
			console.warn(
				`[TaskHistory Migration] Error deleting history item directory ${itemDir} (may be benign if already deleted):`,
				error,
			)
		}
	}

	itemObjectCache.delete(taskId)

	// Iterate all monthly indexes to ensure comprehensive cleanup of the taskId.
	// We don't use getHistoryItem() here to get workspace/ts for a targeted update
	// because historical index states is intentionally inconsistent ("fuzzy"), and we want to ensure
	// the ID is removed wherever it might appear as the latest for any workspace in any month.
	// Tasks may exist in multiple workspaces and this is a normal workflow when the user loads
	// a task from one workspace and continues using it in another.
	const availableMonths = await getAvailableHistoryMonths()

	for (const { year, month } of availableMonths) {
		const monthData = await _readGlobalStateMonthIndex(year, month) // monthData is Record<string, Record<string, number>>
		let updatedInThisMonth = false
		for (const workspacePath in monthData) {
			if (Object.prototype.hasOwnProperty.call(monthData, workspacePath)) {
				const tasksInWorkspace = monthData[workspacePath]
				// Ensure tasksInWorkspace exists and then check for taskId
				if (tasksInWorkspace && tasksInWorkspace[taskId] !== undefined) {
					delete tasksInWorkspace[taskId]
					// If the workspacePath entry becomes empty after deleting the task, remove the workspacePath key itself
					if (Object.keys(tasksInWorkspace).length === 0) {
						delete monthData[workspacePath]
					}
					updatedInThisMonth = true
				}
			}
		}
		if (updatedInThisMonth) {
			await _writeGlobalStateMonthIndex(year, month, monthData)
		}
	}
}

/**
 * Sorts history items based on the specified sort option.
 * @param items - The array of history items to sort.
 * @param sortOption - The sort option to apply.
 * @returns The sorted array of history items.
 */
function _sortHistoryItems(items: HistoryItem[], sortOption: HistorySortOption): HistoryItem[] {
	if (!items.length) {
		return items
	}

	switch (sortOption) {
		case "newest":
			return items.sort((a, b) => b.ts - a.ts)
		case "oldest":
			return items.sort((a, b) => a.ts - b.ts)
		case "mostExpensive":
			return items.sort((a, b) => b.totalCost - a.totalCost)
		case "mostTokens":
			// Sort by total tokens (in + out)
			return items.sort((a, b) => b.tokensIn + b.tokensOut - (a.tokensIn + a.tokensOut))
		case "mostRelevant":
			// For now, "mostRelevant" is the same as "newest"
			// This could be enhanced in the future with more sophisticated relevance scoring
			return items.sort((a, b) => b.ts - a.ts)
		default:
			// Default to newest
			return items.sort((a, b) => b.ts - a.ts)
	}
}

/**
 * Retrieves history items based on a search query, optional date range, and optional limit.
 * Items are sorted according to the sortOption parameter (defaults to "newest").
 * @param search - The search options.
 * @returns A promise that resolves to an array of matching HistoryItem objects.
 */
export async function getHistoryItemsForSearch(search: HistorySearchOptions): Promise<HistorySearchResults> {
	const { searchQuery = "", dateRange, limit, workspacePath, sortOption = "newest" } = search
	const startTime = performance.now()
	const limitStringForLog = limit !== undefined ? limit : "none"
	console.debug(
		`[TaskHistory] [getHistoryItemsForSearch] starting: query="${searchQuery}", limit=${limitStringForLog}, workspace=${workspacePath || "all"}, hasDateRange=${!!dateRange}, sortOption=${sortOption || "default"}`,
	)

	// Extract timestamp values directly
	const fromTsNum = dateRange?.fromTs
	const toTsNum = dateRange?.toTs

	const resultItems: HistoryItem[] = []

	// Track task IDs that have already been added to results
	// to prevent duplicate items, which can happen if the same
	// task ID appears in multiple months or workspaces; this is expected
	// because the indexes are lazy for better performance.
	const processedIds = new Set<string>()

	const lowerCaseSearchQuery = searchQuery.trim().toLowerCase()

	// Get available months in the appropriate order based on sortOption
	const sortedMonthObjects = await getAvailableHistoryMonths(sortOption)

	let processedMonths = 0
	let skippedMonths = 0
	let processedItems = 0
	let matchedItems = 0

	// Process each month in the sorted order
	for (const { year, month, monthStartTs, monthEndTs } of sortedMonthObjects) {
		// If we've already collected enough results to meet the limit,
		// count remaining months as skipped and exit the loop
		if (limit !== undefined && resultItems.length >= limit) {
			skippedMonths += sortedMonthObjects.length - processedMonths
			break
		}

		// Date Range Pruning (Month Level) using pre-calculated timestamps
		if (toTsNum && monthStartTs > toTsNum) {
			skippedMonths++
			continue
		}
		if (fromTsNum && monthEndTs < fromTsNum) {
			skippedMonths++
			continue
		}

		const monthDataByWorkspace = await _readGlobalStateMonthIndex(year, month)
		if (Object.keys(monthDataByWorkspace).length === 0) {
			continue
		}

		processedMonths++

		// Get all tasks, or limit by workspace if defined:
		let tasksInMonthToConsider = _getTasksByWorkspace(monthDataByWorkspace, workspacePath)

		// Filter by date range and sort by timestamp
		tasksInMonthToConsider = _fastSortFilterTasks(
			tasksInMonthToConsider,
			{ fromTs: fromTsNum, toTs: toTsNum },
			sortOption,
		)

		// This is where we actually load HistoryItems from disk
		// taskRef is {id: string, ts: number}
		for (const taskRef of tasksInMonthToConsider) {
			if (limit !== undefined && resultItems.length >= limit) {
				break
			}

			// Skip if we've already processed this item
			if (processedIds.has(taskRef.id)) {
				continue
			}

			const item = await getHistoryItem(taskRef.id)
			if (!item) {
				continue
			}

			processedItems++

			// We no longer filter by search query here - we'll use fzf later

			// Workspace filtering is handled by the selection from monthDataByWorkspace.
			// No need to re-check item.workspace against the search.

			resultItems.push(item)
			processedIds.add(item.id) // Add ID to the processed set
			matchedItems++

			if (limit !== undefined && resultItems.length >= limit) {
				break
			}
		}

		// Removed per-month processing logs
		if (limit !== undefined && resultItems.length >= limit) {
			break
		}
	}

	const endTime = performance.now()
	console.debug(
		`[TaskHistory] [getHistoryItemsForSearch] completed in ${(endTime - startTime).toFixed(2)}ms: ` +
			`processed ${processedMonths}/${sortedMonthObjects.length} months, ` +
			`skipped ${skippedMonths} months, ` +
			`processed ${processedItems} items, ` +
			`matched ${matchedItems} items`,
	)

	// Apply final sorting if needed (for non-timestamp based sorts)
	const sortedItems = _sortHistoryItems(resultItems, sortOption)

	// Use fzf for search and highlighting
	return taskHistorySearch(sortedItems, searchQuery)
}

/**
 * Retrieves a sorted list of available year/month objects from globalState keys,
 * including pre-calculated month start and end timestamps (numeric, Unix ms).
 * The list is sorted according to the sortOption parameter.
 * @param sortOption - Optional sort order (defaults to "newest").
 * @returns A promise that resolves to an array of { year: string, month: string, monthStartTs: number, monthEndTs: number } objects.
 */
export async function getAvailableHistoryMonths(
	sortOption?: HistorySortOption,
): Promise<Array<{ year: string; month: string; monthStartTs: number; monthEndTs: number }>> {
	const context = getExtensionContext()
	const allGlobalStateKeys = await context.globalState.keys()
	const monthObjects: Array<{ year: string; month: string; monthStartTs: number; monthEndTs: number }> = []

	for (const key of allGlobalStateKeys) {
		const parsed = _parseGlobalStateMonthKey(key)
		if (parsed) {
			const yearNum = parseInt(parsed.year, 10)
			const monthNum = parseInt(parsed.month, 10)
			const monthStartTs = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0).getTime()
			const monthEndTs = new Date(yearNum, monthNum, 0, 23, 59, 59, 999).getTime()
			monthObjects.push({ ...parsed, monthStartTs, monthEndTs })
		}
	}

	// Sort months based on sortOption
	if (sortOption === "oldest") {
		// Oldest first
		monthObjects.sort((a, b) => {
			if (a.year !== b.year) {
				return a.year.localeCompare(b.year)
			}
			return a.month.localeCompare(b.month)
		})
	} else {
		// Default to newest first for all other sort options
		monthObjects.sort((a, b) => {
			if (a.year !== b.year) {
				return b.year.localeCompare(a.year)
			}
			return b.month.localeCompare(a.month)
		})
	}

	return monthObjects
}

/**
 * Migrates task history from the old globalState array format to the new
 * file-based storage with globalState Map indexes.
 * It also cleans up any old date-organized directory structures if they exist from testing.
 */
export async function migrateTaskHistoryStorage(): Promise<void> {
	const context = getExtensionContext()
	const currentBasePath = _getBasePath()
	console.log("[TaskHistory Migration] Checking task history storage version...")

	const storedVersion = context.globalState.get<number>(TASK_HISTORY_VERSION_KEY)

	if (storedVersion && storedVersion >= CURRENT_TASK_HISTORY_VERSION) {
		console.log(
			`[TaskHistory Migration] Task history storage is up to date (version ${storedVersion}). No migration needed.`,
		)
		return
	}

	console.log(
		`[TaskHistory Migration] Task history storage version is ${storedVersion === undefined ? "not set (pre-versioning)" : storedVersion}. Current version is ${CURRENT_TASK_HISTORY_VERSION}. Migration check required.`,
	)

	// This specific cleanup for YYYY-named directories might be from very old test versions.
	// The primary storage is now under a "tasks" directory.
	try {
		const entries = await fs.readdir(currentBasePath, { withFileTypes: true })
		for (const entry of entries) {
			if (entry.isDirectory() && /^\d{4}$/.test(entry.name)) {
				const yearPath = path.join(currentBasePath, entry.name)
				console.log(
					`[TaskHistory Migration] Found old-style year artifact directory: ${yearPath}. Attempting to remove.`,
				)
				await fs.rm(yearPath, { recursive: true, force: true })
			}
		}
	} catch (error: any) {
		if (error.code !== "ENOENT") {
			console.warn(
				`[TaskHistory Migration] Error during cleanup of old-style year artifact directories in ${currentBasePath}:`,
				error,
			)
		}
	}

	// This migration handles transitioning from the old flat "taskHistory" array
	// and potentially existing new-format monthly indexes to a consistent state.
	// It ensures that for any given task ID, the latest version (by timestamp) is kept,
	// and then uses setHistoryItems to persist these items and which will als rebuild
	// all monthly indexes into the new format.

	let migrationPerformed = false
	const finalItemSet = new Map<string, HistoryItem>() // taskId -> HistoryItem

	// Step 1: Populate finalItemSet with items currently indexed in the new-format monthly indexes.
	// This ensures that if migration runs multiple times, it considers what's already been migrated.
	try {
		console.log("[TaskHistory Migration] Reading existing items from new-format indexes...")
		const allCurrentlyIndexedItems = await getHistoryItemsForSearch({})
		for (const item of allCurrentlyIndexedItems.items) {
			if (item && item.id) {
				// Basic validation
				finalItemSet.set(item.id, item)
			}
		}
		console.log(`[TaskHistory Migration] Found ${finalItemSet.size} items in existing new-format indexes.`)
	} catch (err) {
		console.warn("[TaskHistory Migration] Error reading existing new-format indexes (may be first run):", err)
		// Continue, as this might be the first time migration is running.
	}

	// Step 2: Merge items from the old "taskHistory" flat array, preferring newer timestamps.
	const oldHistoryArrayFromGlobalState = context.globalState.get<HistoryItem[]>("taskHistory") || []
	if (oldHistoryArrayFromGlobalState.length > 0) {
		console.log(
			`[TaskHistory Migration] Found ${oldHistoryArrayFromGlobalState.length} items in old 'taskHistory' globalState key. Merging...`,
		)
		migrationPerformed = true

		// Backup the old array before processing
		const now = new Date()
		const timestampString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}_${now.getHours().toString().padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now.getSeconds().toString().padStart(2, "0")}`
		const backupFileName = `${timestampString}-backup_globalState_taskHistory_array.json`
		const backupPath = path.join(currentBasePath, backupFileName)
		try {
			await fs.mkdir(currentBasePath, { recursive: true })
			await safeWriteJson(backupPath, oldHistoryArrayFromGlobalState)
			console.log(`[TaskHistory Migration] Successfully backed up old task history array to: ${backupPath}`)
		} catch (backupError: any) {
			console.warn(`[TaskHistory Migration] Error backing up old task history array: ${backupError.message}`)
		}

		for (const oldItem of oldHistoryArrayFromGlobalState) {
			if (!oldItem || !oldItem.id || typeof oldItem.ts !== "number") {
				// Basic validation
				console.warn(
					`[TaskHistory Migration] Skipped invalid item from oldHistoryArray: ${JSON.stringify(oldItem)}`,
				)
				continue
			}

			if (!finalItemSet.has(oldItem.id) || oldItem.ts >= finalItemSet.get(oldItem.id)!.ts) {
				finalItemSet.set(oldItem.id, oldItem)
			}
		}
		console.log(`[TaskHistory Migration] Merged items from old 'taskHistory'. Total items: ${finalItemSet.size}.`)
		// The old "taskHistory" array in globalState is intentionally not modified or deleted here.
		// It's left as a backup.
	} else {
		console.log("[TaskHistory Migration] No old task history data found in globalState key 'taskHistory'.")
	}

	// Step 3: Call setHistoryItems with the final list.
	// setHistoryItems will write each item to its file and rebuild all monthly indexes in the new format.
	const itemsToPassToSetHistory: HistoryItem[] = Array.from(finalItemSet.values())
	if (itemsToPassToSetHistory.length > 0) {
		console.log(`[TaskHistory Migration] Calling setHistoryItems with ${itemsToPassToSetHistory.length} items...`)
		await setHistoryItems(itemsToPassToSetHistory)
		migrationPerformed = true
		console.log("[TaskHistory Migration] setHistoryItems completed.")
	} else if (migrationPerformed) {
		// This case means oldHistoryArray was processed but resulted in no items to set (e.g., all were older)
		// or new-format indexes were empty and oldHistoryArray was empty/invalid.
		console.log("[TaskHistory Migration] No final items to pass to setHistoryItems after processing.")
	}

	// Update the version in globalState if migration was performed or if it's a fresh setup without any old data.
	// This ensures we don't re-run the migration check unnecessarily.
	if (migrationPerformed || storedVersion === undefined || storedVersion < CURRENT_TASK_HISTORY_VERSION) {
		try {
			await context.globalState.update(TASK_HISTORY_VERSION_KEY, CURRENT_TASK_HISTORY_VERSION)
			console.log(
				`[TaskHistory Migration] Task history version updated to ${CURRENT_TASK_HISTORY_VERSION} in globalState.`,
			)
		} catch (error) {
			console.error(`[TaskHistory Migration] Error updating task history version in globalState:`, error)
		}
	}
}
