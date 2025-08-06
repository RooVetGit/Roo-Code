import * as fs from "fs/promises"
import * as path from "path"
import { fileExistsAtPath } from "./fs"
import { GlobalFileNames } from "../shared/globalFileNames"

/**
 * Configuration for stale lock detection
 */
interface StaleLockConfig {
	/**
	 * Maximum age in milliseconds for a lock file to be considered stale
	 * Default: 10 minutes (600000ms)
	 */
	maxLockAge?: number

	/**
	 * Whether to automatically recover stale locks
	 * Default: true
	 */
	autoRecover?: boolean
}

/**
 * Result of stale lock detection for a task
 */
interface StaleLockDetectionResult {
	taskId: string
	taskPath: string
	hasLockFiles: boolean
	hasUiMessagesFile: boolean
	lockFiles: string[]
	isStale: boolean
	oldestLockAge?: number
}

/**
 * Detects stale lock conditions in task directories
 * A stale lock condition exists when:
 * 1. Lock files exist in the task directory
 * 2. ui_messages.json is missing
 * 3. Lock files are older than the configured threshold
 */
export async function detectStaleLocks(
	globalStoragePath: string,
	config: StaleLockConfig = {},
): Promise<StaleLockDetectionResult[]> {
	const { maxLockAge = 10 * 60 * 1000 } = config // Default: 10 minutes
	const results: StaleLockDetectionResult[] = []

	try {
		// Get the tasks directory
		const tasksDir = path.join(globalStoragePath, "tasks")

		// Check if tasks directory exists
		if (!(await fileExistsAtPath(tasksDir))) {
			return results
		}

		// Read all task directories
		const taskDirs = await fs.readdir(tasksDir)
		const currentTime = Date.now()

		for (const taskId of taskDirs) {
			const taskPath = path.join(tasksDir, taskId)

			// Skip if not a directory
			const stat = await fs.stat(taskPath).catch(() => null)
			if (!stat || !stat.isDirectory()) {
				continue
			}

			// Check for lock files
			const files = await fs.readdir(taskPath)
			const lockFiles = files.filter((f) => f.endsWith(".lock"))
			const hasUiMessagesFile = await fileExistsAtPath(path.join(taskPath, GlobalFileNames.uiMessages))

			if (lockFiles.length > 0) {
				// Check age of lock files
				let oldestLockAge = 0
				let isStale = false

				for (const lockFile of lockFiles) {
					const lockPath = path.join(taskPath, lockFile)
					const lockStat = await fs.stat(lockPath).catch(() => null)

					if (lockStat) {
						const age = currentTime - lockStat.mtimeMs
						oldestLockAge = Math.max(oldestLockAge, age)

						// Consider stale if missing ui_messages.json and lock is old enough
						if (!hasUiMessagesFile && age > maxLockAge) {
							isStale = true
						}
					}
				}

				results.push({
					taskId,
					taskPath,
					hasLockFiles: true,
					hasUiMessagesFile,
					lockFiles,
					isStale,
					oldestLockAge,
				})
			}
		}

		return results
	} catch (error) {
		console.error("Error detecting stale locks:", error)
		return results
	}
}

/**
 * Recovers from stale lock conditions by:
 * 1. Removing stale lock files
 * 2. Creating an empty ui_messages.json if missing
 */
export async function recoverStaleLocks(
	detectionResults: StaleLockDetectionResult[],
	config: StaleLockConfig = {},
): Promise<void> {
	const { autoRecover = true } = config

	if (!autoRecover) {
		return
	}

	for (const result of detectionResults) {
		if (!result.isStale) {
			continue
		}

		try {
			console.log(`[StaleLockRecovery] Recovering stale locks for task ${result.taskId}`)

			// Remove lock files
			for (const lockFile of result.lockFiles) {
				const lockPath = path.join(result.taskPath, lockFile)
				try {
					await fs.unlink(lockPath)
					console.log(`[StaleLockRecovery] Removed stale lock: ${lockFile}`)
				} catch (error) {
					console.error(`[StaleLockRecovery] Failed to remove lock ${lockFile}:`, error)
				}
			}

			// Create empty ui_messages.json if missing
			if (!result.hasUiMessagesFile) {
				const uiMessagesPath = path.join(result.taskPath, GlobalFileNames.uiMessages)
				try {
					// Create an empty array to represent no messages
					await fs.writeFile(uiMessagesPath, "[]", "utf8")
					console.log(`[StaleLockRecovery] Created empty ui_messages.json for task ${result.taskId}`)
				} catch (error) {
					console.error(`[StaleLockRecovery] Failed to create ui_messages.json:`, error)
				}
			}
		} catch (error) {
			console.error(`[StaleLockRecovery] Error recovering task ${result.taskId}:`, error)
		}
	}
}

/**
 * Performs stale lock detection and recovery on startup
 */
export async function performStartupStaleLockRecovery(
	globalStoragePath: string,
	config: StaleLockConfig = {},
): Promise<void> {
	try {
		console.log("[StaleLockRecovery] Starting stale lock detection...")

		const detectionResults = await detectStaleLocks(globalStoragePath, config)
		const staleCount = detectionResults.filter((r) => r.isStale).length

		if (staleCount > 0) {
			console.log(`[StaleLockRecovery] Found ${staleCount} task(s) with stale locks`)
			await recoverStaleLocks(detectionResults, config)
			console.log("[StaleLockRecovery] Recovery completed")
		} else {
			console.log("[StaleLockRecovery] No stale locks detected")
		}
	} catch (error) {
		console.error("[StaleLockRecovery] Error during startup recovery:", error)
	}
}
