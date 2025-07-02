import * as path from "path"
import * as fs from "fs/promises"
import getFolderSize from "get-folder-size"
import { safeWriteJson, safeReadJson } from "../../utils/safeWriteJson"
import { getWorkspacePath } from "../../utils/path"
import {
	HistoryItem,
	HistorySortOption,
	HistorySearchOptions,
	HistorySearchResults,
	HistorySearchResultItem,
	HistoryWorkspaceItem,
	HistoryScanResults,
	HistoryRebuildOptions,
} from "@roo-code/types"
import { getExtensionContext } from "../../extension"
import { taskHistorySearch } from "./taskHistorySearch"

const TASK_HISTORY_MONTH_INDEX_PREFIX = "task_history-"
const TASK_DIR_NAME = "tasks"
const TASK_HISTORY_DIR_NAME = "taskHistory"
const TASK_HISTORY_VERSION_KEY = "taskHistoryVersion"
const CURRENT_TASK_HISTORY_VERSION = 2 // Version 1: old array, Version 2: new file-based
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
async function _withMutex<T>(operation: () => Promise<T>): Promise<T> {
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
			// Use console.warn for this since it's not part of the normal operation logs
			console.warn(
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
			console.debug(`[setHistoryItems] Processing ${itemsInMonth.size} items for month ${monthKey}`)
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
			const promise = safeWriteJson(itemPath, item)

			// Add to pending set first
			pendingPromises.add(promise)

			// Then attach the cleanup handlers to prevent any possible races
			promise
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

		// Create a promise for this month's update
		const monthUpdatePromise = safeWriteJson(indexPath, {}, async (currentMonthData) => {
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
				}

				// Update the item reference
				currentMonthData[workspacePathForIndex][itemId] = item.ts
			}

			return true // Return true to write
		})

		// Add to the collection of promises first
		pendingPromises.add(monthUpdatePromise)

		// Then attach the cleanup handlers to prevent any possible races
		monthUpdatePromise
			.then(() => {
				pendingPromises.delete(monthUpdatePromise)
			})
			.catch((error) => {
				console.error(`[setHistoryItems] Error updating month index for ${monthKey}:`, error)
				pendingPromises.delete(monthUpdatePromise)
			})
	}

	// Add workspaces index update
	const workspacesIndexPath = _getWorkspacesIndexFilePath()
	const workspacesUpdatePromise = safeWriteJson(workspacesIndexPath, {}, async (currentWorkspacesData) => {
		// Update each workspace timestamp from the collected data
		for (const [workspacePath, timestamp] of Object.entries(workspaceUpdates)) {
			// Update the workspace timestamp if it's newer
			if (!currentWorkspacesData[workspacePath] || timestamp > currentWorkspacesData[workspacePath]) {
				currentWorkspacesData[workspacePath] = timestamp
			}
		}

		return true // Return true to write
	})

	// Add to the collection of promises first
	pendingPromises.add(workspacesUpdatePromise)

	// Then attach the cleanup handlers to prevent any possible races
	workspacesUpdatePromise
		.then(() => {
			pendingPromises.delete(workspacesUpdatePromise)
		})
		.catch((error) => {
			console.error(`[setHistoryItems] Error updating workspaces index:`, error)
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
 * Generates a timestamp string in the format YYYY-MM-DD_HH-MM-SS
 * @returns Formatted timestamp string
 */
function _getTimestampString(): string {
	const now = new Date()
	return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}_${now.getHours().toString().padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}-${now.getSeconds().toString().padStart(2, "0")}`
}

/**
 * Helper function to log a message both to console and to an array
 * @param logs Array to accumulate logs
 * @param message The message to log
 * @returns The message (for convenience)
 */
/**
 * Logs a message to both console and an array of logs.
 * Tags in square brackets at the beginning of the message are shown
 * in the console but omitted from the logs array.
 */
function logMessage(logs: string[], message: string): string {
	// Display full message including tags in console
	console.log(message)

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

/**
 * Rebuilds history indexes based on scan results and options.
 * @param scan - The scan results from scanTaskHistory().
 * @param options - Options for controlling the rebuild process.
 * @returns Updated HistoryScanResults reflecting any changes made during rebuilding.
 */
export async function _rebuildIndexes(scan: HistoryScanResults, options: HistoryRebuildOptions): Promise<void> {
	const { mode, mergeFromGlobal = false, mergeToGlobal = false, reconstructOrphans = false, logs = [] } = options
	const historyIndexesBasePath = _getHistoryIndexesBasePath()

	// Map to store the latest version of each task by ID
	const latestItemsMap = new Map<string, HistoryItem>()

	// Process valid items
	if (scan.tasks.valid.size > 0) {
		logMessage(logs, `[rebuildIndexes] Processing ${scan.tasks.valid.size} valid tasks`)
		for (const item of scan.tasks.valid.values()) {
			// Add or update only if this is a newer version
			if (!latestItemsMap.has(item.id) || item.ts > latestItemsMap.get(item.id)!.ts) {
				latestItemsMap.set(item.id, item)
			}
		}
	}

	// Process missing items from globalState if mergeFromGlobal is true
	if (mergeFromGlobal && scan.tasks.tasksOnlyInGlobalState.size > 0) {
		logMessage(
			logs,
			`[rebuildIndexes] Processing ${scan.tasks.tasksOnlyInGlobalState.size} missing tasks from globalState`,
		)
		for (const item of scan.tasks.tasksOnlyInGlobalState.values()) {
			// Add or update only if this is a newer version
			if (!latestItemsMap.has(item.id) || item.ts > latestItemsMap.get(item.id)!.ts) {
				latestItemsMap.set(item.id, item)
			}
		}
	}

	// Process orphaned items if reconstructOrphans is true
	if (reconstructOrphans && scan.tasks.orphans.size > 0) {
		logMessage(logs, `[rebuildIndexes] Processing ${scan.tasks.orphans.size} orphaned tasks`)
		for (const item of scan.tasks.orphans.values()) {
			// Add or update only if this is a newer version
			if (!latestItemsMap.has(item.id) || item.ts > latestItemsMap.get(item.id)!.ts) {
				latestItemsMap.set(item.id, item)
			}
		}

		// Note: Writing orphaned items to disk happens through setHistoryItems, not here
		// This is consistent with how we handle valid and missing tasks
	}

	// Convert map to array for setHistoryItems
	const itemsToSet = Array.from(latestItemsMap.values())

	// Skip rebuilding indexes if there's nothing to do
	if (itemsToSet.length === 0) {
		logMessage(logs, `[rebuildIndexes] No items to index, skipping index rebuild`)
		return
	}

	// Create backup of taskHistory directory before rebuilding indexes
	const timestamp = _getTimestampString()
	let backupPath = ""

	if (mode === "replace") {
		// In replace mode, we always create a backup
		const backupDirName = `taskHistory-before-rebuild-${timestamp}`
		backupPath = path.join(path.dirname(historyIndexesBasePath), backupDirName)

		try {
			// Check if taskHistory directory exists
			try {
				await fs.access(historyIndexesBasePath)
				// Move existing taskHistory directory to backup
				await fs.rename(historyIndexesBasePath, backupPath)
				logMessage(logs, `[rebuildIndexes] Moved taskHistory to backup at ${backupPath}`)
			} catch (error) {
				// taskHistory directory doesn't exist, no backup needed
				logMessage(logs, `[rebuildIndexes] No existing taskHistory directory to backup`)
			}
		} catch (backupError) {
			logMessage(logs, `[rebuildIndexes] Error creating backup: ${backupError}`)
			throw backupError
		}
	}

	// Rebuild indexes
	try {
		await setHistoryItems(itemsToSet)
		logMessage(logs, `[rebuildIndexes] Successfully indexed ${itemsToSet.length} tasks in ${mode} mode`)

		// Update globalState if mergeToGlobal is enabled
		if (mergeToGlobal && itemsToSet.length > 0) {
			const context = getExtensionContext()
			await context.globalState.update("taskHistory", itemsToSet)
			logMessage(logs, `[rebuildIndexes] Updated globalState with ${itemsToSet.length} history items`)
		}
	} catch (error) {
		logMessage(logs, `[rebuildIndexes] Error in setHistoryItems: ${error}`)

		// If in replace mode and a backup was created, attempt to restore it
		if (mode === "replace" && backupPath) {
			try {
				// If setHistoryItems created a new taskHistory directory, rename it
				const brokenDirName = `taskHistory-broken-rebuild-${timestamp}`
				const brokenPath = path.join(path.dirname(historyIndexesBasePath), brokenDirName)

				try {
					await fs.access(historyIndexesBasePath)
					// Rename the potentially broken taskHistory directory
					await fs.rename(historyIndexesBasePath, brokenPath)
					logMessage(logs, `[rebuildIndexes] Renamed broken taskHistory to ${brokenPath}`)
				} catch (accessError) {
					logMessage(logs, `[rebuildIndexes] No taskHistory directory created during failed operation`)
				}

				// Check if backup exists and restore it
				try {
					await fs.access(backupPath)
					await fs.rename(backupPath, historyIndexesBasePath)
					logMessage(logs, `[rebuildIndexes] Restored backup from ${backupPath} to ${historyIndexesBasePath}`)
				} catch (restoreError) {
					logMessage(logs, `[rebuildIndexes] Could not restore backup: ${restoreError}`)
				}
			} catch (recoveryError) {
				logMessage(logs, `[rebuildIndexes] Error during recovery: ${recoveryError}`)
			}
		}

		throw error
	}
}

/**
 * Synchronizes history items between globalState and the filesystem.
 * This function has been refactored to use scanTaskHistory and rebuildIndexes.
 * @param options - Required options for controlling the rebuild process
 * @returns A multi-line string containing all log messages
 */

/**
 * Rebuilds history indexes based on scan results and options.
 * This function holds the historySearchQueue so that search requests cannot proceed until indexing is complete.
 * @param options - Options for controlling the rebuild process.
 * @returns Updated HistoryScanResults reflecting any changes made during rebuilding.
 */
export async function reindexHistoryItems(options: HistoryRebuildOptions): Promise<HistoryScanResults | undefined> {
	// Use the mutex helper to ensure this operation doesn't run concurrently with search operations
	return _withMutex(() => _reindexHistoryItems(options))
}

/**
 * Private implementation of reindexHistoryItems.
 * This function contains the actual reindexing logic.
 */
async function _reindexHistoryItems(options: HistoryRebuildOptions): Promise<HistoryScanResults | undefined> {
	// Use the logs array from options if provided, or create a new one
	// We're using the original options object to ensure logs are shared with the caller
	const logs = options.logs || []
	let verificationScan: HistoryScanResults | undefined

	try {
		// Step 1: Scan the task history to get the current state
		logMessage(logs, `[reindexHistoryItems] Starting task history scan...`)
		const scan = await scanTaskHistory(options.scanHistoryFiles)

		// Step 2: Rebuild indexes with the scan results
		logMessage(logs, `[reindexHistoryItems] Rebuilding indexes in ${options.mode} mode...`)
		await _rebuildIndexes(scan, options)

		// Step 3: Verify the results with another scan (unless noVerify is true)
		if (!options.noVerify) {
			logMessage(logs, `[reindexHistoryItems] Verifying results with another scan...`)
			verificationScan = await scanTaskHistory(options.scanHistoryFiles)

			// Log verification results
			logMessage(logs, `[reindexHistoryItems] Verification scan completed:`)
			logMessage(logs, `[reindexHistoryItems] - Valid tasks: ${verificationScan.tasks.valid.size}`)
			logMessage(logs, `[reindexHistoryItems] - Orphaned tasks: ${verificationScan.tasks.orphans.size}`)
			logMessage(
				logs,
				`[reindexHistoryItems] - Failed tasks: ${verificationScan.tasks.failedReconstructions.size}`,
			)
			logMessage(
				logs,
				`[reindexHistoryItems] - Missing tasks: ${verificationScan.tasks.tasksOnlyInGlobalState.size}`,
			)
		} else {
			logMessage(logs, `[reindexHistoryItems] Verification scan skipped (noVerify=true)`)
		}

		logMessage(logs, `[reindexHistoryItems] Index rebuild completed successfully`)
	} catch (error) {
		logMessage(logs, `[reindexHistoryItems] Error during reindex operation: ${error}`)
		throw error
	}

	return verificationScan
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

	const storedVersion = context.globalState.get<number>(TASK_HISTORY_VERSION_KEY)
	const oldHistoryArray = context.globalState.get<HistoryItem[]>("taskHistory") || []

	// If there are zero items in the history, no need to migrate
	if (oldHistoryArray.length === 0) {
		return false
	}

	// Check if the taskHistory directory exists
	let directoryExists = false
	try {
		await fs.access(historyIndexesBasePath)
		directoryExists = true
	} catch (error) {
		// Directory doesn't exist, migration is needed
	}

	// Force migration if directory doesn't exist or version mismatch
	if (directoryExists && storedVersion && storedVersion >= CURRENT_TASK_HISTORY_VERSION) {
		return false
	} else {
		return true
	}
}

/**
 * Migrates task history from the old globalState array format to the new
 * file-based storage with globalState Map indexes.
 * It also cleans up any old date-organized directory structures if they exist from testing.
 * @param logs - Optional array to capture log messages
 */
export async function migrateTaskHistoryStorage(logs: string[] = []): Promise<void> {
	const migrationStartTime = performance.now()
	const context = getExtensionContext()
	const tasksBasePath = _getTasksBasePath()
	const historyIndexesBasePath = _getHistoryIndexesBasePath()
	logMessage(logs, "[TaskHistory Migration] Checking task history storage version and directory...")

	// Get the stored version first
	const storedVersion = context.globalState.get<number>(TASK_HISTORY_VERSION_KEY)

	// Check if migration is needed
	const migrationNeeded = await isTaskHistoryMigrationNeeded()
	if (!migrationNeeded) {
		logMessage(
			logs,
			`[TaskHistory Migration] Task history storage is up to date (version ${storedVersion}) and directory exists. No migration needed.`,
		)
		return
	}

	logMessage(
		logs,
		`[TaskHistory Migration] Task history storage version is ${storedVersion === undefined ? "not set (pre-versioning)" : storedVersion}. Current version is ${CURRENT_TASK_HISTORY_VERSION}. Migration check required.`,
	)

	// Backup the old array before processing
	const oldHistoryArrayFromGlobalState = context.globalState.get<HistoryItem[]>("taskHistory") || []
	if (oldHistoryArrayFromGlobalState.length > 0) {
		logMessage(
			logs,
			`[TaskHistory Migration] Found ${oldHistoryArrayFromGlobalState.length} items in old 'taskHistory' globalState key. Creating backup...`,
		)

		const now = new Date()
		const timestampString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}_${now.getHours().toString().padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now.getSeconds().toString().padStart(2, "0")}`
		const backupFileName = `${timestampString}-backup_globalState_taskHistory_array.json`
		const backupBasePath = _getBackupBasePath()
		const backupPath = path.join(backupBasePath, backupFileName)

		try {
			// Ensure the backup directory exists
			await fs.mkdir(backupBasePath, { recursive: true })
			await safeWriteJson(backupPath, oldHistoryArrayFromGlobalState)
			logMessage(logs, `[TaskHistory Migration] Successfully backed up old task history array to: ${backupPath}`)
		} catch (backupError: any) {
			logMessage(logs, `[TaskHistory Migration] Error backing up old task history array: ${backupError.message}`)
		}
	} else {
		logMessage(logs, "[TaskHistory Migration] No old task history data found in globalState key 'taskHistory'.")
	}

	// Use reindexHistoryItems with merge mode to handle the migration
	try {
		logMessage(logs, "[TaskHistory Migration] Starting reindexing with merge mode...")
		await reindexHistoryItems({
			mode: "merge",
			mergeFromGlobal: true,
			mergeToGlobal: false,
			reconstructOrphans: false,
			scanHistoryFiles: false, // Use index-based approach for better performance
			noVerify: true, // Skip verification for better migration performance
			logs,
		})

		// Update the version in globalState
		await context.globalState.update(TASK_HISTORY_VERSION_KEY, CURRENT_TASK_HISTORY_VERSION)
		logMessage(
			logs,
			`[TaskHistory Migration] Task history version updated to ${CURRENT_TASK_HISTORY_VERSION} in globalState.`,
		)
	} catch (error) {
		logMessage(logs, `[TaskHistory Migration] Error during reindexing: ${error}`)
		throw error
	}

	const migrationEndTime = performance.now()
	const totalMigrationTime = (migrationEndTime - migrationStartTime) / 1000
	logMessage(logs, `[TaskHistory Migration] Migration process completed in ${totalMigrationTime.toFixed(2)}s`)
}

/**
 * Reconstructs a task from its history item or UI messages.
 * @param taskId - The ID of the task to reconstruct.
 * @returns A promise that resolves to a HistoryItem if successful, otherwise undefined.
 */
export async function reconstructTask(taskId: string): Promise<HistoryItem | undefined> {
	// First try to get the history item directly
	const historyItem = await getHistoryItem(taskId, false)
	if (historyItem) {
		return historyItem
	}

	// If history item doesn't exist, try to reconstruct from UI messages
	try {
		const tasksBasePath = _getTasksBasePath()
		const taskDir = path.join(tasksBasePath, taskId)
		const uiMessagesPath = path.join(taskDir, "ui_messages.json")

		const uiMessages = await safeReadJson(uiMessagesPath)
		if (!uiMessages || !Array.isArray(uiMessages) || uiMessages.length === 0) {
			console.error(`[Reconstruct Task] Invalid or empty UI messages for task ${taskId}`)
			return undefined
		}

		const firstMessage = uiMessages[0]
		const lastMessage = uiMessages[uiMessages.length - 1]

		if (!firstMessage || !firstMessage.text || !lastMessage || !lastMessage.ts) {
			console.error(`[Reconstruct Task] Missing required fields in UI messages for task ${taskId}`)
			return undefined
		}

		// Calculate counters by summing values from api_req_started messages
		let tokensIn = 0
		let tokensOut = 0
		let cacheWrites = 0
		let cacheReads = 0
		let totalCost = 0

		for (const message of uiMessages) {
			if (message.type === "say" && message.say === "api_req_started" && message.text) {
				try {
					const data = JSON.parse(message.text)
					if (data && typeof data === "object") {
						tokensIn += data.tokensIn || 0
						tokensOut += data.tokensOut || 0
						cacheWrites += data.cacheWrites || 0
						cacheReads += data.cacheReads || 0
						totalCost += data.cost || 0
					}
				} catch (parseError) {
					// Skip invalid JSON
					console.warn(`[Reconstruct Task] Could not parse message text for task ${taskId}:`, parseError)
				}
			}
		}

		// Calculate directory size
		let size = 0
		try {
			size = await getFolderSize.loose(taskDir)
		} catch (sizeError) {
			console.warn(`[Reconstruct Task] Could not calculate size for task ${taskId}:`, sizeError)
		}

		const historyItem: HistoryItem = {
			id: taskId,
			number: 1, // Common default value as per user analysis
			ts: lastMessage.ts,
			task: firstMessage.text,
			tokensIn,
			tokensOut,
			cacheWrites,
			cacheReads,
			totalCost,
			size,
			workspace: "unknown",
		}

		return historyItem
	} catch (error) {
		console.error(`[Reconstruct Task] Error reconstruct task ${taskId}:`, error)
		return undefined
	}
}

/**
 * Scans the task history on disk and in global state without making any modifications.
 * This function categorizes tasks into valid, tasks only in global state, orphaned, and failed reconstructions,
 * providing a comprehensive overview of the task history state.
 *
 * Always uses the search function first, and then conditionally scans the filesystem
 * if scanHistoryFiles is true to find additional tasks that are only in files.
 *
 * @param scanHistoryFiles - Whether to scan the filesystem for task directories (true) or use the index only (false)
 * @param logs - Optional array to capture log messages
 * @returns A promise that resolves to HistoryScanResults containing categorized tasks
 */
export async function scanTaskHistory(scanHistoryFiles = false, logs: string[] = []): Promise<HistoryScanResults> {
	logMessage(logs, "[TaskHistory] Starting task history scan...")
	logMessage(logs, `[TaskHistory] Using ${scanHistoryFiles ? "filesystem scan" : "index-based approach"}`)

	// Flush the item object cache before scanning
	itemObjectCache.clear()

	// Initialize the scan results object with empty collections
	const scan: HistoryScanResults = {
		validCount: 0, // Initialize to 0, will be updated at the end
		tasks: {
			valid: new Map<string, HistoryItem>(),
			tasksOnlyInGlobalState: new Map<string, HistoryItem>(),
			tasksOnlyInTaskHistoryIndexes: new Map<string, HistoryItem>(),
			orphans: new Map<string, HistoryItem>(),
			failedReconstructions: new Set<string>(),
		},
	}

	// Get the context for global state access
	const context = getExtensionContext()

	// Get the base path for tasks
	const tasksBasePath = _getTasksBasePath()

	try {
		//////////////////////////////////////////////////////////////////////
		// STEP 1: Load all items from globalState
		logMessage(logs, "[TaskHistory] Loading items from globalState...")
		const globalStateItems = context.globalState.get<HistoryItem[]>("taskHistory") || []

		// Create a map of all globalState items, keeping only the latest version of each
		const globalStateMap = new Map<string, HistoryItem>()

		for (const item of globalStateItems) {
			if (item && item.id) {
				// Only add or update if this is a newer version
				if (!globalStateMap.has(item.id) || item.ts > globalStateMap.get(item.id)!.ts) {
					globalStateMap.set(item.id, item)
				}
			}
		}

		logMessage(logs, `[TaskHistory] Found ${globalStateMap.size} tasks in globalState`)

		// Map to store all valid file items
		const fileScanItemsMap = new Map<string, HistoryItem>()

		// Set to track tasks that need reconstruction
		const mayNeedReconstruction = new Set<string>()

		// Map to store reconstructed items
		const reconstructedItemsMap = new Map<string, HistoryItem>()

		// Set to track failed tasks
		const failedReconstruction = new Set<string>()

		//////////////////////////////////////////////////////////////////////
		// STEP 2: Always use the search function (index-based approach) first
		logMessage(logs, "[TaskHistory] Using index-based approach to find tasks...")

		// Get all items from the index
		const searchResults = await _getHistoryItemsForSearch({ workspacePath: "all" })

		// Create a taskIndexItemsMap from search results
		const taskIndexItemsMap = new Map<string, HistoryItem>()

		// Add all items to the taskIndexItemsMap - id is guaranteed to be valid
		searchResults.items.map((item) => taskIndexItemsMap.set(item.id, item))

		// Add all items from taskIndexItemsMap to fileItemsMap
		for (const [id, item] of taskIndexItemsMap.entries()) {
			fileScanItemsMap.set(id, item)
		}

		logMessage(logs, `[TaskHistory] Found ${taskIndexItemsMap.size} tasks from index`)

		//////////////////////////////////////////////////////////////////////
		// STEP 3A: Conditionally use file scans if requested
		if (scanHistoryFiles) {
			logMessage(logs, "[TaskHistory] Also using filesystem scan to find additional task directories...")
			let taskDirs: string[] = []

			// Get dirs, each dir is the task id:
			try {
				// Get all directories in the tasks folder
				const entries = await fs.readdir(tasksBasePath, { withFileTypes: true })
				taskDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

				logMessage(logs, `[TaskHistory] Found ${taskDirs.length} task directories on disk`)
			} catch (error) {
				logMessage(logs, `[TaskHistory] Error reading tasks directory: ${error}`)
				// Continue with empty taskDirs
			}

			// Load all history items from filesystem
			logMessage(logs, "[TaskHistory] Loading history items from filesystem...")

			// Use a Set to track pending promises with a maximum batch size
			const pendingPromises = new Set<Promise<any>>()

			// Each dir is the task id:
			for (const taskId of taskDirs) {
				const historyItemPath = path.join(tasksBasePath, taskId, "history_item.json")

				// Create a promise for this task
				const promise = (async () => {
					try {
						// Check if history item exists - read and validate it
						const historyItem = await getHistoryItem(taskId, false)

						if (historyItem) {
							fileScanItemsMap.set(taskId, historyItem)
						} else {
							// Invalid history item - mark for reconstruction
							mayNeedReconstruction.add(taskId)
						}
					} catch (error: any) {
						// Suppress ENOENT (file not found) errors, but log other errors
						if (error.code !== "ENOENT") {
							logMessage(logs, `[TaskHistory] Error processing task ${taskId}: ${error}`)
						}

						// Mark for reconstruction regardless of error type
						mayNeedReconstruction.add(taskId)
					}
				})()

				// Add to pending set
				pendingPromises.add(promise)

				// Attach cleanup handler
				promise.finally(() => {
					pendingPromises.delete(promise)
				})

				// Wait if we've reached the maximum in-flight operations
				while (pendingPromises.size >= BATCH_SIZE) {
					await Promise.race(pendingPromises)
				}
			}

			// Wait for all remaining task processing to complete
			if (pendingPromises.size > 0) {
				await Promise.all(pendingPromises)
			}

			//////////////////////////////////////////////////////////////////////
			// STEP 3B: Reconstructed items
			logMessage(logs, `[TaskHistory] Reconstructing ${mayNeedReconstruction.size} tasks...`)

			// Process reconstructions in batches
			const reconstructionPromises = new Set<Promise<any>>()

			for (const taskId of mayNeedReconstruction) {
				// Skip reconstruction if task exists in globalState
				if (globalStateMap.has(taskId)) {
					continue
				}

				const promise = (async () => {
					try {
						const reconstructedItem = await reconstructTask(taskId)
						if (reconstructedItem) {
							reconstructedItemsMap.set(taskId, reconstructedItem)
						} else {
							failedReconstruction.add(taskId)
						}
					} catch (error) {
						logMessage(logs, `[TaskHistory] Error reconstructing task ${taskId}: ${error}`)
						failedReconstruction.add(taskId)
					}
				})()

				// Add to pending set
				reconstructionPromises.add(promise)

				// Attach cleanup handler
				promise.finally(() => {
					reconstructionPromises.delete(promise)
				})

				// Wait if we've reached the maximum in-flight operations
				while (reconstructionPromises.size >= BATCH_SIZE) {
					await Promise.race(reconstructionPromises)
				}
			}

			// Wait for all remaining reconstructions to complete
			if (reconstructionPromises.size > 0) {
				await Promise.all(reconstructionPromises)
			}
		}

		// STEP 4: Populate the result sets based on the collected data
		logMessage(logs, "[TaskHistory] Populating result sets...")

		// Process all task IDs from all sources
		const allTaskIds = new Set<string>([
			...globalStateMap.keys(),
			...taskIndexItemsMap.keys(),
			...fileScanItemsMap.keys(),
			...reconstructedItemsMap.keys(),
			...failedReconstruction,
		])

		for (const taskId of allTaskIds) {
			const taskIndexItem = taskIndexItemsMap.get(taskId)
			const globalItem = globalStateMap.get(taskId)
			const fileScanItem = fileScanItemsMap.get(taskId)
			const reconstructedItem = reconstructedItemsMap.get(taskId)

			// Categorize tasks based on where they exist:
			// 1. Valid if in both taskIndex and globalState (use most recent)
			// 2. tasksOnlyInTaskHistoryIndexes if in taskIndex but not in globalState
			// 3. tasksOnlyInGlobalState if in globalState but not in taskIndex
			// 4. orphans if only in fileScan or reconstructed
			// 5. failedReconstructions if reconstruction failed

			if (taskIndexItem && globalItem) {
				// Both exist - use the newer one
				const newerItem = globalItem.ts > taskIndexItem.ts ? globalItem : taskIndexItem
				scan.tasks.valid.set(taskId, newerItem)
			} else if (taskIndexItem) {
				// Only in file indexes, not in globalState
				scan.tasks.tasksOnlyInTaskHistoryIndexes.set(taskId, taskIndexItem)

				// Also consider it valid since it's in the index
				scan.tasks.valid.set(taskId, taskIndexItem)
			} else if (globalItem) {
				// Only globalItem exists
				scan.tasks.tasksOnlyInGlobalState.set(taskId, globalItem)
			} else if (fileScanItem) {
				// Only found in filesystem scan, needs re-indexing
				scan.tasks.orphans.set(taskId, fileScanItem)
			} else if (reconstructedItem) {
				// Only reconstructed from UI messages, needs re-indexing
				scan.tasks.orphans.set(taskId, reconstructedItem)
			}
		}

		scan.tasks.failedReconstructions = failedReconstruction
	} catch (error) {
		logMessage(logs, `[TaskHistory] Error during task history scan: ${error}`)
	}

	// Update counters based on map sizes
	const validCount = scan.tasks.valid.size
	const orphanCount = scan.tasks.orphans.size
	const failedCount = scan.tasks.failedReconstructions.size
	const missingCount = scan.tasks.tasksOnlyInGlobalState.size
	const indexOnlyCount = scan.tasks.tasksOnlyInTaskHistoryIndexes.size

	// Log summary
	logMessage(logs, "[TaskHistory] Scan completed:")
	logMessage(logs, `[TaskHistory]   - Valid tasks: ${validCount}`)
	logMessage(logs, `[TaskHistory]   - Tasks in globalState only: ${missingCount}`)
	logMessage(logs, `[TaskHistory]   - Tasks in fileIndexes only: ${indexOnlyCount}`)
	logMessage(logs, `[TaskHistory]   - Orphaned tasks (reconstructed): ${orphanCount}`)
	logMessage(logs, `[TaskHistory]   - Failed reconstructions: ${failedCount}`)

	// Set the validCount field based on the size of the valid tasks map
	scan.validCount = scan.tasks.valid.size

	return scan
}
