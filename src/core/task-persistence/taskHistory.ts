import * as path from "path"
import * as fs from "fs/promises"
import { safeWriteJson, safeReadJson } from "../../utils/safeWriteJson"
import {
	HistoryItem,
	HistorySortOption,
	HistorySearchOptions,
	HistorySearchResults,
	HistorySearchResultItem,
} from "@roo-code/types"
import { getExtensionContext } from "../../extension"
import { taskHistorySearch } from "./taskHistorySearch"

const TASK_HISTORY_MONTH_INDEX_PREFIX = "task_history-"
const TASK_DIR_NAME = "tasks"
const TASK_HISTORY_DIR_NAME = "taskHistory"
const TASK_HISTORY_VERSION_KEY = "taskHistoryVersion"
const CURRENT_TASK_HISTORY_VERSION = 2 // Version 1: old array, Version 2: new file-based, Version 3: file-based indexes, Version 4: separate directories

// Configuration for batch processing; empirically, a value of 20 seems to perform best:
const BATCH_SIZE = 20

const itemObjectCache = new Map<string, HistoryItem>()

/**
 * Gets the base path for task HistoryItem storage in tasks/<id>/history_item.json
 * @returns The base path string for task items.
 */
function _getTasksBasePath(): string {
	const context = getExtensionContext()
	return path.join(context.globalStorageUri.fsPath, TASK_DIR_NAME)
}

/**
 * Gets the base path for monthly index storage.
 * @returns The base path string for monthly indexes.
 */
function _getHistoryIndexesBasePath(): string {
	const context = getExtensionContext()
	return path.join(context.globalStorageUri.fsPath, TASK_HISTORY_DIR_NAME)
}

/**
 * Gets the base path for backup files.
 * @returns The base path string for backup files.
 */
function _getBackupBasePath(): string {
	const context = getExtensionContext()
	return context.globalStorageUri.fsPath
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
 * Gets the path for a month's index file.
 * @param year - YYYY string.
 * @param month - MM string.
 * @returns The file path string.
 */
function _getMonthIndexFilePath(year: string, month: string): string {
	const basePath = _getHistoryIndexesBasePath()
	return path.join(basePath, `${year}-${month}.index.json`)
}

/**
 * Constructs the full file path for a history item.
 * @param taskId - The ID of the task.
 * @returns Full path to the history item's JSON file.
 */
function _getHistoryItemPath(taskId: string): string {
	const tasksBasePath = _getTasksBasePath()
	return path.join(tasksBasePath, taskId, "history_item.json")
}

/**
 * Reads the index object for a given month from a JSON file.
 * The object maps workspacePath to an inner object, which maps taskId to its timestamp.
 * e.g., { "workspace/path": { "task-id-1": 12345, "task-id-2": 67890 } }
 * @param year - YYYY string.
 * @param month - MM string.
 * @returns The Record of {workspacePath: {[taskId: string]: timestamp}}, or an empty object if not found.
 */
async function _readTaskHistoryMonthIndex(
	year: string,
	month: string,
): Promise<Record<string, Record<string, number>>> {
	const indexPath = _getMonthIndexFilePath(year, month)
	try {
		const data = await safeReadJson(indexPath)
		if (data && typeof data === "object" && !Array.isArray(data)) {
			return data
		}
	} catch (error) {
		console.error(`[TaskHistory] Error reading month index file for ${year}-${month}:`, error)
	}
	return {}
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

	// Return early if there's nothing to set
	if (items.length === 0) {
		return
	}

	// Group items by month for efficient processing
	const itemsByMonth = new Map<string, Map<string, HistoryItem>>()

	// First pass: group items by month
	for (const item of items) {
		if (!item || !item.id || typeof item.ts !== "number" || typeof item.task !== "string") {
			console.warn(
				`[setHistoryItems] Invalid HistoryItem skipped (missing id, ts, or task): ${JSON.stringify(item)}`,
			)
			continue
		}

		// Group by month for index updates
		const { year, month } = _getYearMonthFromTs(item.ts)
		const monthKey = `${year}-${month}`

		if (!itemsByMonth.has(monthKey)) {
			itemsByMonth.set(monthKey, new Map<string, HistoryItem>())
		}
		itemsByMonth.get(monthKey)!.set(item.id, item)
	}

	// Second pass: save individual item files with max 100 in flight
	for (const [monthKey, itemsInMonth] of itemsByMonth.entries()) {
		const count = itemsInMonth.size
		if (count > 1) {
			console.debug(`[setHistoryItems] Processing ${itemsInMonth.size} items for month ${monthKey}`)
		}

		// Use a Set to track pending promises
		const pendingPromises = new Set<Promise<any>>()

		// Process all items in the month
		for (const [itemId, item] of itemsInMonth.entries()) {
			// Wait if we've reached the maximum in-flight operations
			if (pendingPromises.size >= BATCH_SIZE) {
				// Wait for any operation to complete
				await Promise.race(pendingPromises)
			}

			// Start a new operation
			const itemPath = _getHistoryItemPath(item.id)
			const promise = safeWriteJson(itemPath, item)
				.then(() => {
					// Cache the item after successful save
					itemObjectCache.set(item.id, item)
					// Remove this promise from the pending set
					pendingPromises.delete(promise)
					return item.id
				})
				.catch((error) => {
					console.error(`[setHistoryItems] Error processing history item ${item.id}:`, error)
					// Remove this promise from the pending set
					pendingPromises.delete(promise)
					return undefined
				})

			// Add to pending set
			pendingPromises.add(promise)
		}

		// Wait for all remaining operations to complete
		if (pendingPromises.size > 0) {
			await Promise.all(pendingPromises)
		}
	}

	// Third pass: update month indexes atomically - all in parallel
	const monthUpdatePromises: Promise<void>[] = []

	for (const [monthKey, itemsInMonth] of itemsByMonth.entries()) {
		const [year, month] = monthKey.split("-")
		const indexPath = _getMonthIndexFilePath(year, month)

		// Create a promise for this month's update using .then/.catch
		const monthUpdatePromise = safeWriteJson(indexPath, {}, async (currentMonthData) => {
			// Update each item in this month
			for (const [itemId, item] of itemsInMonth.entries()) {
				// Use "" as the index key if item.workspace is undefined
				const workspacePathForIndex = item.workspace === undefined ? "" : item.workspace

				// Initialize workspace if needed - TypeScript requires explicit initialization
				if (!currentMonthData[workspacePathForIndex]) {
					currentMonthData[workspacePathForIndex] = {}
				}

				// Update the item reference
				currentMonthData[workspacePathForIndex][itemId] = item.ts
			}

			return true // Return true to write
		}).catch((error) => {
			console.error(`[setHistoryItems] Error updating month index for ${monthKey}:`, error)
		})

		// Add to the collection of promises
		monthUpdatePromises.push(monthUpdatePromise)
	}

	// Wait for all month updates to complete in parallel
	await Promise.all(monthUpdatePromises)
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

	// Cache miss - read from file using safeReadJson
	const itemPath = _getHistoryItemPath(taskId)
	try {
		const historyItem = await safeReadJson(itemPath)
		if (historyItem) {
			itemObjectCache.set(taskId, historyItem)
		}
		return historyItem
	} catch (error) {
		console.error(`[TaskHistory] [getHistoryItem] [${taskId}] error reading file ${itemPath}:`, error)
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
		const indexPath = _getMonthIndexFilePath(year, month)

		try {
			// Atomic read-modify-write operation for each month
			await safeWriteJson(indexPath, {}, async (monthData) => {
				let updatedInThisMonth = false

				for (const workspacePath in monthData) {
					if (Object.prototype.hasOwnProperty.call(monthData, workspacePath)) {
						const tasksInWorkspace = monthData[workspacePath]

						// Ensure tasksInWorkspace exists and then check for taskId
						if (tasksInWorkspace && tasksInWorkspace[taskId] !== undefined) {
							delete tasksInWorkspace[taskId]

							// If the workspacePath entry becomes empty after deleting the task,
							// remove the workspacePath key itself
							if (Object.keys(tasksInWorkspace).length === 0) {
								delete monthData[workspacePath]
							}

							updatedInThisMonth = true
						}
					}
				}

				// Return true only if changes were made, false otherwise
				// This prevents unnecessary file writes when nothing changed
				return updatedInThisMonth
			})
		} catch (error) {
			console.error(
				`[TaskHistory] Error updating month index for ${year}-${month} when deleting task ${taskId}:`,
				error,
			)
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

// Queue for serializing calls to getHistoryItemsForSearch
let historySearchQueue: Promise<HistorySearchResults> = Promise.resolve({ items: [] })

/**
 * Retrieves history items based on a search query, optional date range, and optional limit.
 * Items are sorted according to the sortOption parameter (defaults to "newest").
 * Calls are serialized to allow the cache to heat up from the first request.
 * @param search - The search options.
 * @returns A promise that resolves to an array of matching HistoryItem objects.
 */
export async function getHistoryItemsForSearch(search: HistorySearchOptions): Promise<HistorySearchResults> {
	// Serialize calls to allow cache to heat up
	return (historySearchQueue = historySearchQueue.then(() => _getHistoryItemsForSearch(search)))
}

/**
 * Internal implementation of getHistoryItemsForSearch that does the actual work.
 * @param search - The search options.
 * @returns A promise that resolves to an array of matching HistoryItem objects.
 */
async function _getHistoryItemsForSearch(search: HistorySearchOptions): Promise<HistorySearchResults> {
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

		const monthDataByWorkspace = await _readTaskHistoryMonthIndex(year, month)
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

	// Determine whether to preserve order based on sort option
	// For "mostRelevant", we want to use the fuzzy search order
	// For all other sort options, we want to preserve the original order
	const preserveOrder = sortOption !== "mostRelevant"

	let result: HistorySearchResults
	if (!searchQuery.trim()) {
		// Skip taskHistorySearch if search query is empty
		result = {
			items: sortedItems as HistorySearchResultItem[],
		}
	} else {
		// Use fzf for search and highlighting
		result = taskHistorySearch(sortedItems, searchQuery, preserveOrder)
	}

	return result
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
	const basePath = _getHistoryIndexesBasePath()
	const monthObjects: Array<{ year: string; month: string; monthStartTs: number; monthEndTs: number }> = []

	try {
		const files = await fs.readdir(basePath)
		const indexFileRegex = /^(\d{4})-(\d{2})\.index\.json$/

		for (const file of files) {
			const match = file.match(indexFileRegex)
			if (match) {
				const year = match[1]
				const month = match[2]
				const yearNum = parseInt(year, 10)
				const monthNum = parseInt(month, 10)
				const monthStartTs = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0).getTime()
				const monthEndTs = new Date(yearNum, monthNum, 0, 23, 59, 59, 999).getTime()
				monthObjects.push({ year, month, monthStartTs, monthEndTs })
			}
		}
	} catch (error) {
		console.error(`[TaskHistory] Error reading month index files:`, error)
		// Return empty array on error
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
	const migrationStartTime = performance.now()
	const context = getExtensionContext()
	const tasksBasePath = _getTasksBasePath()
	const historyIndexesBasePath = _getHistoryIndexesBasePath()
	console.log("[TaskHistory Migration] Checking task history storage version and directory...")

	const storedVersion = context.globalState.get<number>(TASK_HISTORY_VERSION_KEY)

	// Check if the taskHistory directory exists
	let directoryExists = false
	try {
		await fs.access(historyIndexesBasePath)
		directoryExists = true
	} catch (error) {
		console.log(
			`[TaskHistory Migration] taskHistory directory does not exist at ${historyIndexesBasePath}; will force migration.`,
		)
	}

	// Force migration if directory doesn't exist or version mismatch
	if (directoryExists && storedVersion && storedVersion >= CURRENT_TASK_HISTORY_VERSION) {
		console.log(
			`[TaskHistory Migration] Task history storage is up to date (version ${storedVersion}) and directory exists. No migration needed.`,
		)
		return
	}

	console.log(
		`[TaskHistory Migration] Task history storage version is ${storedVersion === undefined ? "not set (pre-versioning)" : storedVersion}. Current version is ${CURRENT_TASK_HISTORY_VERSION}. Migration check required.`,
	)

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
		const step1StartTime = performance.now()
		console.log("[TaskHistory Migration] Reading existing items from new-format indexes...")
		const allCurrentlyIndexedItems = await getHistoryItemsForSearch({})
		for (const item of allCurrentlyIndexedItems.items) {
			if (item && item.id) {
				// Basic validation
				finalItemSet.set(item.id, item)
			}
		}
		const step1Time = (performance.now() - step1StartTime) / 1000
		console.log(
			`[TaskHistory Migration] Found ${finalItemSet.size} items in existing new-format indexes. (${step1Time.toFixed(2)}s)`,
		)
	} catch (err) {
		console.warn("[TaskHistory Migration] Error reading existing new-format indexes (may be first run):", err)
		// Continue, as this might be the first time migration is running.
	}

	// Step 2: Merge items from the old "taskHistory" flat array, preferring newer timestamps.
	const step2StartTime = performance.now()
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
		const backupBasePath = _getBackupBasePath()
		const backupPath = path.join(backupBasePath, backupFileName)
		try {
			// Ensure the backup directory exists
			await fs.mkdir(backupBasePath, { recursive: true })
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
		const step2Time = (performance.now() - step2StartTime) / 1000
		console.log(
			`[TaskHistory Migration] Merged items from old 'taskHistory'. Total items: ${finalItemSet.size}. (${step2Time.toFixed(2)}s)`,
		)
		// The old "taskHistory" array in globalState is intentionally not modified or deleted here.
		// It's left as a backup.
	} else {
		console.log("[TaskHistory Migration] No old task history data found in globalState key 'taskHistory'.")
	}

	// Step 3: Call setHistoryItems with the final list.
	// setHistoryItems will write each item to its file and rebuild all monthly indexes in the new format.
	const itemsToPassToSetHistory: HistoryItem[] = Array.from(finalItemSet.values())
	if (itemsToPassToSetHistory.length > 0) {
		const step3StartTime = performance.now()
		console.log(`[TaskHistory Migration] Calling setHistoryItems with ${itemsToPassToSetHistory.length} items...`)
		await setHistoryItems(itemsToPassToSetHistory)
		migrationPerformed = true
		const step3Time = (performance.now() - step3StartTime) / 1000
		const itemsPerSecond = itemsToPassToSetHistory.length / step3Time
		console.log(
			`[TaskHistory Migration] setHistoryItems completed. (${step3Time.toFixed(2)}s, ${itemsPerSecond.toFixed(2)} items/sec)`,
		)
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

	const migrationEndTime = performance.now()
	const totalMigrationTime = (migrationEndTime - migrationStartTime) / 1000
	const totalItems = itemsToPassToSetHistory.length
	const overallItemsPerSecond = totalItems > 0 ? totalItems / totalMigrationTime : 0
	console.log(
		`[TaskHistory Migration] Migration process completed in ${totalMigrationTime.toFixed(2)}s (${overallItemsPerSecond.toFixed(2)} items/sec)`,
	)
}
