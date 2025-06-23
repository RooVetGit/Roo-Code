import * as path from "path"
import * as fs from "fs/promises"
import getFolderSize from "get-folder-size"

import { HistoryItem, HistoryScanResults, HistoryRebuildOptions } from "@roo-code/types"
import { getExtensionContext } from "../../extension"
import { safeReadJson } from "../../utils/safeReadJson"
import {
	_getHistoryIndexesBasePath,
	_getTasksBasePath,
	_withMutex,
	clearHistoryItemCache,
	getHistoryItem,
	getHistoryItemsForSearch as _getHistoryItemsForSearch,
	setHistoryItems,
	logMessage,
} from "./taskHistory"

const BATCH_SIZE = 16

/**
 * Generates a timestamp string in the format YYYY-MM-DD_HH-MM-SS
 * @returns Formatted timestamp string
 */
function _getTimestampString(): string {
	const now = new Date()
	return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}_${now.getHours().toString().padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}-${now.getSeconds().toString().padStart(2, "0")}`
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
	clearHistoryItemCache()

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
