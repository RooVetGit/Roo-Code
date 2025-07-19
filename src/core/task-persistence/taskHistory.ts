import * as path from "path"
import * as fs from "fs/promises"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { safeReadJson } from "../../utils/safeReadJson"

import { getWorkspacePath } from "../../utils/path"
import {
	HistoryItem,
	HistorySortOption,
	HistorySearchOptions,
	HistorySearchResults,
	HistorySearchResultItem,
	HistoryWorkspaceItem,
} from "@roo-code/types"
import { getExtensionContext } from "../../extension"
import { taskHistorySearch } from "./taskHistorySearch"
import { GlobalFileNames } from "../../shared/globalFileNames"

const TASK_DIR_NAME = "tasks"
const TASK_HISTORY_DIR_NAME = "taskHistory"
const WORKSPACES_INDEX_FILE = "workspaces.index.json"

// Configuration for batch processing; empirically, a value of 16 seems to perform best:
const BATCH_SIZE = 16

const itemObjectCache = new Map<string, HistoryItem>()

// Mutex for serializing history operations to prevent concurrent execution
// This ensures that search and reindex operations don't run at the same time
let historyOperationMutex: Promise<void> = Promise.resolve()

/**
 * Helper function to execute an operation with mutex protection.
 * This ensures that operations are serialized and don't run concurrently.
 * It also handles errors properly to prevent breaking the mutex chain.
 * @param operation - The async operation to execute
 * @returns The result of the operation
 */
export async function _withMutex<T>(operation: () => Promise<T>): Promise<T> {
	// Wait for any ongoing operations to complete
	await historyOperationMutex

	// Execute the operation
	const operationPromise = operation()

	// Update the mutex and ensure it always resolves, even if the operation fails
	historyOperationMutex = operationPromise
		.catch((err) => {
			console.error(`[TaskHistory] Error in mutex-protected operation:`, err)
			// Re-throw to propagate the error to the caller
			throw err
		})
		.then(() => {})

	// Return the result of the operation
	return operationPromise
}

/**
 * Gets the base path for task HistoryItem storage in tasks/<id>/history_item.json
 * @returns The base path string for task items.
 */
export function _getTasksBasePath(): string {
	const context = getExtensionContext()
	return path.join(context.globalStorageUri.fsPath, TASK_DIR_NAME)
}

/**
 * Gets the base path for monthly index storage.
 * @returns The base path string for monthly indexes.
 */
export function _getHistoryIndexesBasePath(): string {
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
 * Gets the path for the workspaces index file.
 * @returns The file path string.
 */
function _getWorkspacesIndexFilePath(): string {
	const basePath = _getHistoryIndexesBasePath()
	return path.join(basePath, WORKSPACES_INDEX_FILE)
}

/**
 * Constructs the full file path for a history item.
 * @param taskId - The ID of the task.
 * @returns Full path to the history item's JSON file.
 */
function _getHistoryItemPath(taskId: string): string {
	const tasksBasePath = _getTasksBasePath()
	return path.join(tasksBasePath, taskId, GlobalFileNames.historyItem)
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

	// Handle special paths
	let effectiveWorkspacePath = workspacePath

	if (workspacePath === "all") {
		effectiveWorkspacePath = "all"
	} else if (workspacePath === "current" || workspacePath === undefined || workspacePath === "") {
		// Get the current workspace path from VSCode
		effectiveWorkspacePath = getWorkspacePath()
	}

	// If effectiveWorkspacePath is undefined, show all workspaces
	if (effectiveWorkspacePath === "all") {
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
	} else if (effectiveWorkspacePath !== undefined) {
		// Filter by single workspace
		const tasksInWorkspace = monthDataByWorkspace[effectiveWorkspacePath]
		if (tasksInWorkspace) {
			for (const id in tasksInWorkspace) {
				if (Object.prototype.hasOwnProperty.call(tasksInWorkspace, id)) {
					tasksToFetch.push({ id, ts: tasksInWorkspace[id] })
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
 * Clears the in-memory cache for history items.
 */
export function clearHistoryItemCache(): void {
	itemObjectCache.clear()
}

/**
 * Adds or updates multiple history items.
 * This is the primary method for saving items.
 * @param items - An array of HistoryItem objects to set.
 */
export async function setHistoryItems(items: HistoryItem[], logs?: string[]): Promise<void> {
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
			logMessage(
				logs,
				`[setHistoryItems] Invalid HistoryItem skipped (missing id, ts, or task): ${JSON.stringify(item)}`,
			)
			continue
		}

		// workspace updates - use "unknown" instead of empty string
		if (item.workspace === undefined || item.workspace === "") {
			item.workspace = "unknown"
		}

		// Group by month for index updates
		const { year, month } = _getYearMonthFromTs(item.ts)
		const monthKey = `${year}-${month}`

		if (!itemsByMonth.has(monthKey)) {
			itemsByMonth.set(monthKey, new Map<string, HistoryItem>())
		}
		itemsByMonth.get(monthKey)!.set(item.id, item)
	}

	// Use a single set to track all pending promises with a maximum of BATCH_SIZE in flight
	const pendingPromises = new Set<Promise<any>>()
	const workspaceUpdates: Record<string, number> = {}

	// Second pass: save individual item files
	for (const [monthKey, itemsInMonth] of itemsByMonth.entries()) {
		const count = itemsInMonth.size
		if (count > 1) {
			logMessage(logs, `[setHistoryItems] Processing ${itemsInMonth.size} items for month ${monthKey}`)
		}

		// Process all items in the month
		for (const [itemId, item] of itemsInMonth.entries()) {
			// Collect workspace updates; item.workspace is guaranteed to be defined in the first pass:
			const workspacePathForIndex = item.workspace!

			if (!workspaceUpdates[workspacePathForIndex] || item.ts > workspaceUpdates[workspacePathForIndex]) {
				workspaceUpdates[workspacePathForIndex] = item.ts
			}

			// Start a new operation
			const itemPath = _getHistoryItemPath(item.id)
			const promise = (async () => {
				try {
					await safeWriteJson(itemPath, item)
					// Cache the item after successful save
					itemObjectCache.set(item.id, item)
				} catch (error) {
					logMessage(logs, `[setHistoryItems] Error processing history item ${item.id}: ${error}`)
				}
			})()

			// Add to pending set first, then attach cleanup
			pendingPromises.add(promise)
			promise.then(() => {
				pendingPromises.delete(promise)
			})

			// Wait while we've reached the maximum in-flight operations
			while (pendingPromises.size >= BATCH_SIZE) {
				await Promise.race(pendingPromises)
			}
		}
	}

	// Third pass: update month indexes
	for (const [monthKey, itemsInMonth] of itemsByMonth.entries()) {
		const [year, month] = monthKey.split("-")
		const indexPath = _getMonthIndexFilePath(year, month)

		const monthUpdatePromise = (async () => {
			try {
				await safeWriteJson(indexPath, {}, async (currentMonthData) => {
					// Track if any changes were made
					let hasChanges = false

					// Update each item in this month
					for (const [itemId, item] of itemsInMonth.entries()) {
						// Use "unknown" as the index key if item.workspace is undefined or empty
						let workspacePathForIndex
						if (item.workspace === undefined || item.workspace === "") {
							workspacePathForIndex = "unknown"
						} else {
							workspacePathForIndex = item.workspace
						}

						// Initialize workspace if needed - TypeScript requires explicit initialization
						if (!currentMonthData[workspacePathForIndex]) {
							currentMonthData[workspacePathForIndex] = {}
							hasChanges = true
						}

						// Update the item reference if it's different
						if (currentMonthData[workspacePathForIndex][itemId] !== item.ts) {
							currentMonthData[workspacePathForIndex][itemId] = item.ts
							hasChanges = true
						}
					}

					// Only return data if changes were made
					return hasChanges ? currentMonthData : undefined
				})
			} catch (error) {
				logMessage(logs, `[setHistoryItems] Error updating month index for ${monthKey}: ${error}`)
			}
		})()

		// Add to pending set first, then attach cleanup
		pendingPromises.add(monthUpdatePromise)
		monthUpdatePromise.then(() => {
			pendingPromises.delete(monthUpdatePromise)
		})
	}

	// Add workspaces index update
	const workspacesIndexPath = _getWorkspacesIndexFilePath()
	const workspacesUpdatePromise = (async () => {
		try {
			await safeWriteJson(workspacesIndexPath, {}, async (currentWorkspacesData) => {
				// Track if any changes were made
				let hasChanges = false

				// Update each workspace timestamp from the collected data
				for (const [workspacePath, timestamp] of Object.entries(workspaceUpdates)) {
					// Update the workspace timestamp if it's newer
					if (!currentWorkspacesData[workspacePath] || timestamp > currentWorkspacesData[workspacePath]) {
						currentWorkspacesData[workspacePath] = timestamp
						hasChanges = true
					}
				}

				// Only return data if changes were made
				return hasChanges ? currentWorkspacesData : undefined
			})
		} catch (error) {
			logMessage(logs, `[setHistoryItems] Error updating workspaces index: ${error}`)
		}
	})()

	// Add to pending set first, then attach cleanup
	pendingPromises.add(workspacesUpdatePromise)
	workspacesUpdatePromise.then(() => {
		pendingPromises.delete(workspacesUpdatePromise)
	})

	// Wait for all remaining operations to complete
	if (pendingPromises.size > 0) {
		await Promise.all(pendingPromises)
	}
}

/**
 * Retrieves a specific history item by its ID.
 * Uses an in-memory cache first, then falls back to file storage.
 * @param taskId - The ID of the task to retrieve.
 * @returns The HistoryItem if found, otherwise undefined.
 */
export async function getHistoryItem(taskId: string, useCache: boolean = true): Promise<HistoryItem | undefined> {
	// Check cache first (fast path)
	if (useCache && itemObjectCache.has(taskId)) {
		return itemObjectCache.get(taskId)
	}

	// Cache miss - read from file using safeReadJson
	const itemPath = _getHistoryItemPath(taskId)
	try {
		const historyItem = await safeReadJson(itemPath)

		if (historyItem && historyItem.id && historyItem.ts !== undefined && historyItem.ts > 0) {
			if (useCache) {
				itemObjectCache.set(taskId, historyItem)
			}

			return historyItem
		} else {
			console.error(`[TaskHistory] [getHistoryItem] [${taskId}] ${itemPath} content is invalid:`, historyItem)
			return undefined
		}
	} catch (error: any) {
		// Suppress ENOENT (file not found) errors, but log other errors
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

				// Return monthData only if changes were made, undefined otherwise
				// This prevents unnecessary file writes when nothing changed
				if (updatedInThisMonth) {
					return monthData
				}
				return undefined
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

/**
 * Retrieves history items based on a search query, optional date range, and optional limit.
 * Items are sorted according to the sortOption parameter (defaults to "newest").
 * Calls are serialized to allow the cache to heat up from the first request.
 * @param search - The search options.
 * @returns A promise that resolves to an array of matching HistoryItem objects.
 */
export async function getHistoryItemsForSearch(search: HistorySearchOptions): Promise<HistorySearchResults> {
	// Use the mutex helper to ensure this operation doesn't run concurrently with reindex operations
	return _withMutex(() => _getHistoryItemsForSearch(search))
}

/**
 * Internal implementation of getHistoryItemsForSearch that does the actual work.
 * @param search - The search options.
 * @returns A promise that resolves to an array of matching HistoryItem objects.
 */
async function _getHistoryItemsForSearch(
	search: HistorySearchOptions,
	useCache: boolean = true,
): Promise<HistorySearchResults> {
	const { searchQuery = "", dateRange, limit, workspacePath, sortOption = "newest" } = search
	const startTime = performance.now()
	const limitStringForLog = limit !== undefined ? limit : "none"
	console.debug(
		`[TaskHistory] [getHistoryItemsForSearch] starting: query="${searchQuery}", limit=${limitStringForLog}, workspace=${workspacePath === undefined ? "(undefined)" : workspacePath}, hasDateRange=${!!dateRange}, sortOption=${sortOption || "default"}`,
	)

	// Extract timestamp values directly
	const fromTsNum = dateRange?.fromTs
	const toTsNum = dateRange?.toTs

	const resultItems: HistoryItem[] = []

	// Set to collect unique workspaces encountered during traversal
	const uniqueWorkspaces = new Set<string>()

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

		// Collect all workspace paths from this month's data
		// Always collect workspaces regardless of whether we're filtering by a specific workspace
		// This allows users to see what other workspaces are available to select
		Object.keys(monthDataByWorkspace).forEach((wsPath) => {
			uniqueWorkspaces.add(wsPath)
		})

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

			const item = await getHistoryItem(taskRef.id, useCache)
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

	// Add sorted workspaces to the result
	result.workspaces = Array.from(uniqueWorkspaces).sort()

	// Add workspace items
	const workspaceItems = await _getAllWorkspaces()
	result.workspaceItems = workspaceItems

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
 * Gets all workspaces with their metadata.
 * @returns A promise that resolves to an array of HistoryWorkspaceItem objects.
 */
async function _getAllWorkspaces(): Promise<HistoryWorkspaceItem[]> {
	const workspacesIndexPath = _getWorkspacesIndexFilePath()
	const workspaceItems: HistoryWorkspaceItem[] = []
	const homeDir = process.env.HOME || process.env.USERPROFILE || ""

	try {
		// Read the workspaces index, defaulting to empty object if file doesn't exist
		let workspacesData = {}
		try {
			workspacesData = (await safeReadJson(workspacesIndexPath)) || {}
		} catch (error: any) {
			if (error.code !== "ENOENT") {
				// Only log if it's not a "file not found" error
				console.error(`[TaskHistory] Error reading workspaces index:`, error)
			}
			// Use empty object as default if file doesn't exist
		}

		// Convert to HistoryWorkspaceItem array
		for (const [path, ts] of Object.entries(workspacesData)) {
			// Special case handling
			let name

			// Handle special paths
			if (path === "unknown") {
				name = "(unknown)"
			} else {
				// Replace home directory with ~
				if (homeDir && path.startsWith(homeDir)) {
					name = path.replace(homeDir, "~")
				} else {
					name = path
				}
			}

			// Check if the workspace directory exists
			let missing = false
			if (path !== "unknown") {
				try {
					await fs.access(path)
				} catch (error) {
					missing = true
				}
			}

			workspaceItems.push({
				path,
				name,
				missing,
				ts: ts as number,
			})
		}

		// Sort by timestamp (newest first)
		workspaceItems.sort((a, b) => b.ts - a.ts)
	} catch (error) {
		console.error(`[TaskHistory] Error reading workspaces index:`, error)
	}

	return workspaceItems
}

/**
 * Checks if task history migration is needed by comparing the stored version
 * with the current version and verifying the existence of the taskHistory directory.
 * @returns A promise that resolves to true if migration is needed, false otherwise.
 */
export async function isTaskHistoryMigrationNeeded(): Promise<boolean> {
	const context = getExtensionContext()
	const historyIndexesBasePath = _getHistoryIndexesBasePath()

	const oldHistoryArray = context.globalState.get<HistoryItem[]>("taskHistory") || []

	// If there are zero items in the history, no need to migrate
	if (oldHistoryArray.length === 0) {
		return false
	}

	// Check if the taskHistory directory exists
	let directoryExists = false
	try {
		await fs.access(historyIndexesBasePath)
		return false
	} catch (error) {
		// Directory doesn't exist, migration is needed
		return true
	}
}

/**
 * Migrates task history from the old globalState array format to the new
 * file-based storage with globalState Map indexes.
 * It also cleans up any old date-organized directory structures if they exist from testing.
 * @param logs - Optional array to capture log messages
 */
export async function migrateTaskHistoryStorage(logs?: string[]): Promise<void> {
	const migrationStartTime = performance.now()
	const context = getExtensionContext()

	// Check if migration is needed
	const migrationNeeded = await isTaskHistoryMigrationNeeded()
	if (!migrationNeeded) {
		logMessage(
			logs,
			`[TaskHistory Migration] Task history storage is up to date, directory exists. No migration needed.`,
		)
		return
	}

	// Backup the old array before processing
	const oldHistoryArrayFromGlobalState = context.globalState.get<HistoryItem[]>("taskHistory") || []
	if (oldHistoryArrayFromGlobalState.length > 0) {
		logMessage(
			logs,
			`[TaskHistory Migration] Found ${oldHistoryArrayFromGlobalState.length} items in old 'taskHistory' globalState key.`,
		)

		await _withMutex(async () => {
			await setHistoryItems(oldHistoryArrayFromGlobalState, logs)
		})
	} else {
		logMessage(logs, "[TaskHistory Migration] No old task history data found in globalState key 'taskHistory'.")
	}

	const migrationEndTime = performance.now()
	const totalMigrationTime = (migrationEndTime - migrationStartTime) / 1000
	logMessage(logs, `[TaskHistory Migration] Migration process completed in ${totalMigrationTime.toFixed(2)}s`)
}

/**
 * Helper function to log a message both to console and to an array
 * for UI display
 * @param logs Array to accumulate logs
 * @param message The message to log
 * @returns The message (for convenience)
 */
export function logMessage(logs: string[] | undefined, message: string): string {
	// Display full message including tags in console
	console.log(message)

	if (!logs) {
		return message
	}

	// Extract content after the first closing bracket
	// Use an index to appease CodeQL regarding ReDoS false positive
	const closingBracketIndex = message.indexOf("]")

	if (closingBracketIndex !== -1) {
		// If message has tags, only store the content part in logs array
		const content = message.substring(closingBracketIndex + 1).trim()
		logs.push(content)
	} else {
		// If no tags, store the whole message
		logs.push(message)
	}

	return message
}
