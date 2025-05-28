import * as fs from "fs/promises"
import * as path from "path"
import * as lockfile from "proper-lockfile"

/**
 * Safely writes JSON data to a file.
 * - Uses 'proper-lockfile' for inter-process advisory locking to prevent concurrent writes to the same path.
 * - Writes to a temporary file first.
 * - If the target file exists, it's backed up before being replaced.
 * - Attempts to roll back and clean up in case of errors.
 *
 * @param {string} filePath - The absolute path to the target file.
 * @param {any} data - The data to serialize to JSON and write.
 * @returns {Promise<void>}
 */
async function safeWriteJson(
	filePath: string,
	data: any,
	replacer?: (key: string, value: any) => any,
	space: string | number = 2,
): Promise<void> {
	const absoluteFilePath = path.resolve(filePath)
	const lockPath = `${absoluteFilePath}.lock`
	let releaseLock = async () => {} // Initialized to a no-op

	// Acquire the lock before any file operations
	try {
		releaseLock = await lockfile.lock(lockPath, {
			stale: 31000, // Stale after 31 seconds
			update: 10000, // Update mtime every 10 seconds to prevent staleness if operation is long
			retries: {
				// Configuration for retrying lock acquisition
				retries: 5, // Number of retries after the initial attempt
				factor: 2, // Exponential backoff factor (e.g., 100ms, 200ms, 400ms, ...)
				minTimeout: 100, // Minimum time to wait before the first retry (in ms)
				maxTimeout: 1000, // Maximum time to wait for any single retry (in ms)
			},
			realpath: false, // Skip realpath check as we've already resolved absoluteFilePath
			onCompromised: (err) => {
				console.error(`Lock at ${lockPath} was compromised:`, err)
				throw err
			},
		})
	} catch (lockError) {
		// If lock acquisition fails, we throw immediately.
		// The releaseLock remains a no-op, so the finally block in the main file operations
		// try-catch-finally won't try to release an unacquired lock if this path is taken.
		console.error(`Failed to acquire lock for ${lockPath}:`, lockError)
		throw lockError // Propagate the lock acquisition error
	}

	// Variables to hold the actual paths of temp files if they are created.
	let actualTempNewFilePath: string | null = null
	let actualTempBackupFilePath: string | null = null

	try {
		// Step 1: Write data to a new temporary file.
		actualTempNewFilePath = path.join(
			path.dirname(absoluteFilePath),
			`.${path.basename(absoluteFilePath)}.new_${Date.now()}_${Math.random().toString(36).substring(2)}.tmp`,
		)
		const jsonData = JSON.stringify(data, replacer, space)
		await fs.writeFile(actualTempNewFilePath, jsonData, "utf8")

		// Step 2: Check if the target file exists. If so, rename it to a backup path.
		try {
			await fs.access(absoluteFilePath) // Check for target file existence
			// Target exists, create a backup path and rename.
			actualTempBackupFilePath = path.join(
				path.dirname(absoluteFilePath),
				`.${path.basename(absoluteFilePath)}.bak_${Date.now()}_${Math.random().toString(36).substring(2)}.tmp`,
			)
			await fs.rename(absoluteFilePath, actualTempBackupFilePath)
		} catch (accessError: any) {
			// Explicitly type accessError
			if (accessError.code !== "ENOENT") {
				// An error other than "file not found" occurred during access check.
				throw accessError
			}
			// Target file does not exist, so no backup is made. actualTempBackupFilePath remains null.
		}

		// Step 3: Rename the new temporary file to the target file path.
		// This is the main "commit" step.
		await fs.rename(actualTempNewFilePath, absoluteFilePath)

		// If we reach here, the new file is successfully in place.
		// The original actualTempNewFilePath is now the main file, so we shouldn't try to clean it up as "temp".
		actualTempNewFilePath = null // Mark as "used" or "committed"

		// Step 4: If a backup was created, attempt to delete it.
		if (actualTempBackupFilePath) {
			try {
				await fs.unlink(actualTempBackupFilePath)
				actualTempBackupFilePath = null // Mark backup as handled
			} catch (unlinkBackupError) {
				// Log this error, but do not re-throw. The main operation was successful.
				// actualTempBackupFilePath remains set, indicating an orphaned backup.
				console.error(
					`Successfully wrote ${absoluteFilePath}, but failed to clean up backup ${actualTempBackupFilePath}:`,
					unlinkBackupError,
				)
			}
		}
	} catch (originalError) {
		console.error(`Operation failed for ${absoluteFilePath}: [Original Error Caught]`, originalError)

		const newFileToCleanupWithinCatch = actualTempNewFilePath
		const backupFileToRollbackOrCleanupWithinCatch = actualTempBackupFilePath

		// Attempt rollback if a backup was made
		if (backupFileToRollbackOrCleanupWithinCatch) {
			try {
				await fs.rename(backupFileToRollbackOrCleanupWithinCatch, absoluteFilePath)
				actualTempBackupFilePath = null // Mark as handled, prevent later unlink of this path
			} catch (rollbackError) {
				// actualTempBackupFilePath (outer scope) remains pointing to backupFileToRollbackOrCleanupWithinCatch
				console.error(
					`[Catch] Failed to restore backup ${backupFileToRollbackOrCleanupWithinCatch} to ${absoluteFilePath}:`,
					rollbackError,
				)
			}
		}

		// Cleanup the .new file if it exists
		if (newFileToCleanupWithinCatch) {
			try {
				await fs.unlink(newFileToCleanupWithinCatch)
			} catch (cleanupError) {
				console.error(
					`[Catch] Failed to clean up temporary new file ${newFileToCleanupWithinCatch}:`,
					cleanupError,
				)
			}
		}

		// Cleanup the .bak file if it still needs to be (i.e., wasn't successfully restored)
		if (actualTempBackupFilePath) {
			try {
				await fs.unlink(actualTempBackupFilePath)
			} catch (cleanupError) {
				console.error(
					`[Catch] Failed to clean up temporary backup file ${actualTempBackupFilePath}:`,
					cleanupError,
				)
			}
		}
		throw originalError // This MUST be the error that rejects the promise.
	} finally {
		// Release the lock in the main finally block.
		try {
			// releaseLock will be the actual unlock function if lock was acquired,
			// or the initial no-op if acquisition failed.
			await releaseLock()
		} catch (unlockError) {
			// Do not re-throw here, as the originalError from the try/catch (if any) is more important.
			console.error(`Failed to release lock for ${lockPath}:`, unlockError)
		}
	}
}

export { safeWriteJson }
