import * as path from "path"
import * as fs from "fs/promises"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { HistoryItem } from "../../shared/HistoryItem"
import { getExtensionContext } from "../../extension"

// Constants
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
 * Constructs the full file path for a history item.
 * @param taskId - The ID of the task.
 * @returns Full path to the history item's JSON file.
 */
function _getHistoryItemPath(taskId: string): string {
	const currentBasePath = _getBasePath()
	return path.join(currentBasePath, taskId, "history_item.json")
}

/**
 * Reads the index Map for a given month from globalState.
 * @param year - YYYY string.
 * @param month - MM string.
 * @returns The Map of {taskId: timestamp}, or an empty Map if not found.
 */
async function _readGlobalStateMonthIndex(year: string, month: string): Promise<Map<string, number>> {
	const context = getExtensionContext()
	const monthKey = _getGlobalStateMonthKey(year, month)
	const storedData = context.globalState.get<Record<string, number>>(monthKey)
	if (storedData && typeof storedData === "object" && !Array.isArray(storedData)) {
		return new Map(Object.entries(storedData))
	}
	return new Map<string, number>()
}

/**
 * Writes the index Map for a given month to globalState.
 * @param year - YYYY string.
 * @param month - MM string.
 * @param indexData - The Map of {taskId: timestamp} to write.
 */
async function _writeGlobalStateMonthIndex(year: string, month: string, indexData: Map<string, number>): Promise<void> {
	const context = getExtensionContext()
	const monthKey = _getGlobalStateMonthKey(year, month)
	const objectToStore: Record<string, number> = {}
	for (const [key, value] of indexData) {
		objectToStore[key] = value
	}
	await context.globalState.update(monthKey, objectToStore)
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

	const affectedMonthIndexes = new Map<string, Map<string, number>>()

	for (const item of items) {
		if (!item || !item.id || typeof item.ts !== "number" || typeof item.task !== "string") {
			console.warn(`[Roo Update] Invalid HistoryItem skipped: ${JSON.stringify(item)}`)
			continue
		}

		const itemPath = _getHistoryItemPath(item.id)
		const dirPath = path.dirname(itemPath)

		try {
			await fs.mkdir(dirPath, { recursive: true })
			await safeWriteJson(itemPath, item)
			itemObjectCache.set(item.id, item)

			const { year, month } = _getYearMonthFromTs(item.ts)
			const monthKeyString = `${year}-${month}`

			let monthMap = affectedMonthIndexes.get(monthKeyString)
			if (!monthMap) {
				monthMap = await _readGlobalStateMonthIndex(year, month)
				affectedMonthIndexes.set(monthKeyString, monthMap)
			}
			monthMap.set(item.id, item.ts)
		} catch (error) {
			console.error(`[Roo Update] Error processing history item ${item.id}:`, error)
		}
	}

	for (const [monthKeyString, monthMap] of affectedMonthIndexes) {
		const [year, month] = monthKeyString.split("-")
		try {
			await _writeGlobalStateMonthIndex(year, month, monthMap)
		} catch (error) {
			console.error(`[Roo Update] Error writing globalState index for ${monthKeyString}:`, error)
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
	if (itemObjectCache.has(taskId)) {
		return itemObjectCache.get(taskId)
	}

	const itemPath = _getHistoryItemPath(taskId)
	try {
		const fileContent = await fs.readFile(itemPath, "utf8")
		const historyItem: HistoryItem = JSON.parse(fileContent)
		itemObjectCache.set(taskId, historyItem)
		return historyItem
	} catch (error: any) {
		if (error.code !== "ENOENT") {
			console.error(`[Roo Update] Error reading history item file ${itemPath} for task ${taskId}:`, error)
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
				`[Roo Update] Error deleting history item directory ${itemDir} (may be benign if already deleted):`,
				error,
			)
		}
	}

	itemObjectCache.delete(taskId)

	const localContext = getExtensionContext()
	const allGlobalStateKeys = await localContext.globalState.keys()
	const monthIndexKeys = allGlobalStateKeys.filter((key) => key.startsWith(TASK_HISTORY_MONTH_INDEX_PREFIX))

	for (const monthKey of monthIndexKeys) {
		const keyParts = monthKey.substring(TASK_HISTORY_MONTH_INDEX_PREFIX.length).split("-")
		if (keyParts.length !== 2) continue
		const year = keyParts[0]
		const month = keyParts[1]

		const monthMap = await _readGlobalStateMonthIndex(year, month)
		if (monthMap.delete(taskId)) {
			await _writeGlobalStateMonthIndex(year, month, monthMap)
		}
	}
}

/**
 * Retrieves all history items for a specific year and month.
 * @param yearParam - The year (e.g., 2025).
 * @param monthParam - The month (1-12).
 * @returns A promise that resolves to an array of HistoryItem objects, sorted by timestamp descending.
 */
export async function getHistoryItemsForMonth(yearParam: number, monthParam: number): Promise<HistoryItem[]> {
	const yearStr = yearParam.toString()
	const monthStr = monthParam.toString().padStart(2, "0")

	const monthIndexMap = await _readGlobalStateMonthIndex(yearStr, monthStr)
	if (monthIndexMap.size === 0) {
		return []
	}

	const results: HistoryItem[] = []
	for (const taskId of monthIndexMap.keys()) {
		const item = await getHistoryItem(taskId)
		if (item) {
			const { year: itemYear, month: itemMonth } = _getYearMonthFromTs(item.ts)
			if (itemYear === yearStr && itemMonth === monthStr) {
				results.push(item)
			}
		}
	}

	results.sort((a, b) => b.ts - a.ts)
	return results
}

/**
 * Retrieves history items based on a search query and optional date range.
 * @param searchQuery - The string to search for in task descriptions.
 * @param dateRange - Optional date range { fromTs?: number; toTs?: number }.
 * @returns A promise that resolves to an array of matching HistoryItem objects, sorted by timestamp descending.
 */
export async function getHistoryItemsForSearch(
	searchQuery: string,
	dateRange?: { fromTs?: number; toTs?: number },
): Promise<HistoryItem[]> {
	const context = getExtensionContext()
	const allTaskIdsFromHints = new Set<string>()

	// Collect all unique task IDs from all globalState month hints
	const allGlobalStateKeys = await context.globalState.keys()
	const monthIndexKeys = allGlobalStateKeys.filter((key) => key.startsWith(TASK_HISTORY_MONTH_INDEX_PREFIX))

	for (const monthKey of monthIndexKeys) {
		const keyParts = monthKey.substring(TASK_HISTORY_MONTH_INDEX_PREFIX.length).split("-")
		if (keyParts.length !== 2) continue
		const year = keyParts[0]
		const month = keyParts[1]
		const monthMap = await _readGlobalStateMonthIndex(year, month)
		for (const taskId of monthMap.keys()) {
			allTaskIdsFromHints.add(taskId)
		}
	}

	if (allTaskIdsFromHints.size === 0 && searchQuery.trim() === "" && !dateRange) {
		return []
	}

	const candidateItems: HistoryItem[] = []
	for (const taskId of allTaskIdsFromHints) {
		const item = await getHistoryItem(taskId)
		if (item) {
			candidateItems.push(item)
		}
	}

	const lowerCaseSearchQuery = searchQuery.trim().toLowerCase()
	const filteredItems = candidateItems.filter((item) => {
		if (dateRange) {
			if (dateRange.fromTs && item.ts < dateRange.fromTs) {
				return false
			}
			if (dateRange.toTs && item.ts > dateRange.toTs) {
				return false
			}
		}
		if (lowerCaseSearchQuery) {
			const taskMatch = item.task && item.task.toLowerCase().includes(lowerCaseSearchQuery)
			if (!taskMatch) {
				return false
			}
		}
		return true
	})

	filteredItems.sort((a, b) => b.ts - a.ts)
	return filteredItems
}

/**
 * Retrieves a list of available year/month combinations for which history data might exist,
 * based on the globalState index keys.
 * The list is sorted with the newest month first.
 * @returns A promise that resolves to an array of { year: number, month: number } objects.
 */
export async function getAvailableHistoryMonths(): Promise<Array<{ year: number; month: number }>> {
	const context = getExtensionContext()
	const allGlobalStateKeys = await context.globalState.keys()
	const monthKeyRegex = new RegExp(`^${TASK_HISTORY_MONTH_INDEX_PREFIX}(\\d{4})-(\\d{2})$`)
	const availableMonths: Array<{ year: number; month: number }> = []

	for (const key of allGlobalStateKeys) {
		const match = key.match(monthKeyRegex)
		if (match && match.length === 3) {
			const year = parseInt(match[1], 10)
			const monthNum = parseInt(match[2], 10)
			availableMonths.push({ year, month: monthNum })
		}
	}

	availableMonths.sort((a, b) => {
		if (a.year !== b.year) {
			return b.year - a.year
		}
		return b.month - a.month
	})
	return availableMonths
}

/**
 * Migrates task history from the old globalState array format to the new
 * file-based storage with globalState Map indexes.
 * It also cleans up any old date-organized directory structures if they exist from testing.
 */
export async function migrateTaskHistoryStorage(): Promise<void> {
	const context = getExtensionContext()
	const currentBasePath = _getBasePath()
	console.log("[Roo Update] Checking task history storage version...")

	const storedVersion = context.globalState.get<number>(TASK_HISTORY_VERSION_KEY)

	if (storedVersion && storedVersion >= CURRENT_TASK_HISTORY_VERSION) {
		console.log(`[Roo Update] Task history storage is up to date (version ${storedVersion}). No migration needed.`)
		return
	}

	console.log(
		`[Roo Update] Task history storage version is ${storedVersion === undefined ? "not set (pre-versioning)" : storedVersion}. Current version is ${CURRENT_TASK_HISTORY_VERSION}. Migration check required.`,
	)

	// Cleanup old test artifact directories (can run regardless of migration outcome)
	try {
		const entries = await fs.readdir(currentBasePath, { withFileTypes: true })
		for (const entry of entries) {
			if (entry.isDirectory() && /^\d{4}$/.test(entry.name)) {
				const yearPath = path.join(currentBasePath, entry.name)
				console.log(`[Roo Update] Found old test artifact directory: ${yearPath}. Attempting to remove.`)
				await fs.rm(yearPath, { recursive: true, force: true })
			}
		}
	} catch (error: any) {
		if (error.code !== "ENOENT") {
			console.warn(
				`[Roo Update] Error during cleanup of old test artifact directories in ${currentBasePath}:`,
				error,
			)
		}
	}

	// Attempt to migrate data from the old "taskHistory" array if it exists
	// This part only runs if the version is old or not set.
	const oldHistoryArrayFromGlobalState = context.globalState.get<HistoryItem[]>("taskHistory")
	let migrationPerformed = false

	if (oldHistoryArrayFromGlobalState && oldHistoryArrayFromGlobalState.length > 0) {
		console.log(
			`[Roo Update] Found ${oldHistoryArrayFromGlobalState.length} items in old 'taskHistory' globalState key. Attempting migration from version ${storedVersion === undefined ? "1 (implicit)" : storedVersion} to ${CURRENT_TASK_HISTORY_VERSION}.`,
		)

		const now = new Date()
		const year = now.getFullYear()
		const month = (now.getMonth() + 1).toString().padStart(2, "0")
		const day = now.getDate().toString().padStart(2, "0")
		const hours = now.getHours().toString().padStart(2, "0")
		const minutes = now.getMinutes().toString().padStart(2, "0")
		const seconds = now.getSeconds().toString().padStart(2, "0")
		const timestampString = `${year}-${month}-${day}_${hours}${minutes}${seconds}`
		const backupFileName = `${timestampString}-backup_globalState_taskHistory_array.json`

		const backupPath = path.join(currentBasePath, backupFileName)
		try {
			await fs.mkdir(currentBasePath, { recursive: true })
			await safeWriteJson(backupPath, oldHistoryArrayFromGlobalState)
			console.log(`[Roo Update] Successfully backed up old task history array to: ${backupPath}`)
		} catch (backupError: any) {
			console.warn(`[Roo Update] Error backing up old task history array: ${backupError.message}`)
		}

		const itemsToMigrate: HistoryItem[] = oldHistoryArrayFromGlobalState
			.map((oldItem) => {
				const taskContent = (oldItem as any).task || (oldItem as any).userInput || ""
				return {
					...oldItem,
					task: taskContent,
					id: oldItem.id,
					ts: oldItem.ts,
				}
			})
			.filter((item) => item.id && typeof item.ts === "number")

		if (itemsToMigrate.length > 0) {
			console.log(`[Roo Update] Migrating ${itemsToMigrate.length} valid HistoryItems...`)
			await setHistoryItems(itemsToMigrate)
			migrationPerformed = true
		} else {
			console.log("[Roo Update] No valid items found in old globalState array to migrate after filtering.")
		}

		// NOTICE: taskHistory MUST NOT BE MODIFIED.  It may become stale but it will be left behind in case it is necessary.
		//         Someday we may prune it.
		console.log("[Roo Update] Processing of old 'taskHistory' globalState array complete.")
	} else {
		console.log("[Roo Update] No old task history data found in globalState key 'taskHistory'.")
	}

	// Update the version in globalState if migration was attempted or if it's a fresh setup
	// This ensures we don't re-run the migration check unnecessarily.
	if (migrationPerformed || storedVersion === undefined || storedVersion < CURRENT_TASK_HISTORY_VERSION) {
		try {
			await context.globalState.update(TASK_HISTORY_VERSION_KEY, CURRENT_TASK_HISTORY_VERSION)
			console.log(`[Roo Update] Task history version updated to ${CURRENT_TASK_HISTORY_VERSION} in globalState.`)
		} catch (error) {
			console.error(`[Roo Update] Error updating task history version in globalState:`, error)
			// If version update fails, we might re-run migration next time, which is acceptable.
		}
	}
}
