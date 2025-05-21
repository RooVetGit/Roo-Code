import * as fs from "fs/promises"
import * as path from "path"

const activeLocks = new Set<string>()

/**
 * Safely writes JSON data to a file.
 * - Uses an in-memory advisory lock to prevent concurrent writes to the same path.
 * - Writes to a temporary file first.
 * - If the target file exists, it's backed up before being replaced.
 * - Attempts to roll back and clean up in case of errors.
 *
 * @param {string} filePath - The absolute path to the target file.
 * @param {any} data - The data to serialize to JSON and write.
 * @returns {Promise<void>}
 */
async function safeWriteJson(filePath: string, data: any): Promise<void> {
	const absoluteFilePath = path.resolve(filePath)

	if (activeLocks.has(absoluteFilePath)) {
		throw new Error(`File operation already in progress for this path: ${absoluteFilePath}`)
	}

	activeLocks.add(absoluteFilePath)

	// Variables to hold the actual paths of temp files if they are created.
	let actualTempNewFilePath: string | null = null
	let actualTempBackupFilePath: string | null = null

	try {
		// Step 1: Write data to a new temporary file.
		actualTempNewFilePath = path.join(
			path.dirname(absoluteFilePath),
			`.${path.basename(absoluteFilePath)}.new_${Date.now()}_${Math.random().toString(36).substring(2)}.tmp`,
		)
		const jsonData = JSON.stringify(data, null, 2)
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
		// const _successfullyMovedNewFile = actualTempNewFilePath; // This variable is unused
		actualTempNewFilePath = null // Mark as "used" or "committed"

		// Step 4: If a backup was created, attempt to delete it.
		if (actualTempBackupFilePath) {
			try {
				await fs.unlink(actualTempBackupFilePath)
				// console.log(`Successfully deleted backup file: ${actualTempBackupFilePath}`);
				actualTempBackupFilePath = null // Mark backup as handled
			} catch (unlinkBackupError) {
				// Log this error, but do not re-throw. The main operation was successful.
				console.error(
					`Successfully wrote ${absoluteFilePath}, but failed to clean up backup ${actualTempBackupFilePath}:`,
					unlinkBackupError,
				)
				// actualTempBackupFilePath remains set, indicating an orphaned backup.
			}
		}
	} catch (originalError) {
		console.error(`Operation failed for ${absoluteFilePath}: [Original Error Caught]`, originalError)

		const newFileToCleanupWithinCatch = actualTempNewFilePath
		const backupFileToRollbackOrCleanupWithinCatch = actualTempBackupFilePath

		// Attempt rollback if a backup was made
		if (backupFileToRollbackOrCleanupWithinCatch) {
			try {
				// Inner try for rollback
				console.log(
					`[Catch] Attempting to restore backup ${backupFileToRollbackOrCleanupWithinCatch} to ${absoluteFilePath}`,
				)
				await fs.rename(backupFileToRollbackOrCleanupWithinCatch, absoluteFilePath)
				console.log(
					`[Catch] Successfully restored backup ${backupFileToRollbackOrCleanupWithinCatch} to ${absoluteFilePath}.`,
				)
				actualTempBackupFilePath = null // Mark as handled, prevent later unlink of this path
			} catch (rollbackError) {
				console.error(
					`[Catch] Failed to restore backup ${backupFileToRollbackOrCleanupWithinCatch} to ${absoluteFilePath}:`,
					rollbackError,
				)
				// actualTempBackupFilePath (outer scope) remains pointing to backupFileToRollbackOrCleanupWithinCatch
			}
		}

		// Cleanup the .new file if it exists
		if (newFileToCleanupWithinCatch) {
			try {
				// Inner try for new file cleanup
				await fs.unlink(newFileToCleanupWithinCatch)
				console.log(`[Catch] Cleaned up temporary new file: ${newFileToCleanupWithinCatch}`)
			} catch (cleanupError) {
				console.error(
					`[Catch] Failed to clean up temporary new file ${newFileToCleanupWithinCatch}:`,
					cleanupError,
				)
			}
		}

		// Cleanup the .bak file if it still needs to be (i.e., wasn't successfully restored)
		if (actualTempBackupFilePath) {
			// Checks outer scope var, which is null if rollback succeeded
			try {
				// Inner try for backup file cleanup
				await fs.unlink(actualTempBackupFilePath)
				console.log(`[Catch] Cleaned up temporary backup file: ${actualTempBackupFilePath}`)
			} catch (cleanupError) {
				console.error(
					`[Catch] Failed to clean up temporary backup file ${actualTempBackupFilePath}:`,
					cleanupError,
				)
			}
		}
		throw originalError // This MUST be the error that rejects the promise.
	} finally {
		activeLocks.delete(absoluteFilePath)
	}
}

export { safeWriteJson, activeLocks } // Export activeLocks for testing lock contention
