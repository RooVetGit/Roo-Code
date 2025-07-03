import * as fs from "fs/promises"
import * as fsSync from "fs"
import * as path from "path"
import * as lockfile from "proper-lockfile"
import Disassembler from "stream-json/Disassembler"
import Stringer from "stream-json/Stringer"
import { parser } from "stream-json/Parser"
import { pick } from "stream-json/filters/Pick"
import { streamValues } from "stream-json/streamers/StreamValues"

/**
 * Acquires a lock on a file.
 *
 * @param {string} filePath - The path to the file to lock
 * @param {lockfile.LockOptions} [options] - Optional lock options
 * @returns {Promise<() => Promise<void>>} - The lock release function
 * @private
 */
async function _acquireLock(filePath: string, options?: lockfile.LockOptions): Promise<() => Promise<void>> {
	const absoluteFilePath = path.resolve(filePath)

	return await lockfile.lock(absoluteFilePath, {
		stale: 31000, // Stale after 31 seconds
		update: 10000, // Update mtime every 10 seconds
		realpath: false, // The file may not exist yet
		retries: {
			retries: 5,
			factor: 2,
			minTimeout: 100,
			maxTimeout: 1000,
		},
		onCompromised: (err) => {
			console.error(`Lock at ${absoluteFilePath} was compromised:`, err)
			throw err
		},
		...options,
	})
}

/**
 * Safely writes JSON data to a file.
 * - Creates parent directories if they don't exist
 * - Uses 'proper-lockfile' for inter-process advisory locking to prevent concurrent writes to the same path.
 * - Writes to a temporary file first.
 * - If the target file exists, it's backed up before being replaced.
 * - Attempts to roll back and clean up in case of errors.
 * - Supports atomic read-modify-write transactions via the readModifyFn parameter.
 *
 * @param {string} filePath - The path to the target file.
 * @param {any} data - The data to serialize to JSON and write. When using readModifyFn, this becomes the default value if file doesn't exist.
 * @param {(data: any) => Promise<boolean>} [readModifyFn] - Optional function to modify data in place as part of an atomic transaction. Returns true to continue with write, false to abort (no error).
 * @returns {Promise<any>} - The structure that was written to the file
 */
async function safeWriteJson(
	filePath: string,
	data: any,
	readModifyFn?: (data: any) => Promise<boolean>,
): Promise<any> {
	if (!readModifyFn && data === undefined) {
		throw new Error("When not using readModifyFn, data must be provided")
	}

	// If data is provided with readModifyFn, ensure it's a modifiable type
	if (readModifyFn && data !== undefined) {
		// JSON can serialize objects, arrays, strings, numbers, booleans, and null,
		// but only objects and arrays can be modified in-place
		const isModifiable = data !== null && (typeof data === "object" || Array.isArray(data))

		if (!isModifiable) {
			throw new Error("When using readModifyFn with default data, it must be a modifiable type (object or array)")
		}
	}

	if (readModifyFn && data !== undefined) {
		// If data is provided with readModifyFn, ensure it's a modifiable type
		if (data !== null && typeof data !== "object") {
			throw new Error(
				"When using readModifyFn with default data, data must be a modifiable type (object or array)",
			)
		}
	}

	const absoluteFilePath = path.resolve(filePath)
	let releaseLock = async () => {} // Initialized to a no-op

	// For directory creation
	const dirPath = path.dirname(absoluteFilePath)

	// Ensure directory structure exists with improved reliability
	try {
		// Create directory with recursive option
		await fs.mkdir(dirPath, { recursive: true })

		// Verify directory exists after creation attempt
		await fs.access(dirPath)
	} catch (dirError: any) {
		console.error(`Failed to create or access directory for ${absoluteFilePath}:`, dirError)
		throw dirError
	}

	// Acquire the lock before any file operations
	try {
		releaseLock = await _acquireLock(absoluteFilePath)
	} catch (lockError) {
		// If lock acquisition fails, we throw immediately.
		// The releaseLock remains a no-op, so the finally block in the main file operations
		// try-catch-finally won't try to release an unacquired lock if this path is taken.
		console.error(`Failed to acquire lock for ${absoluteFilePath}:`, lockError)
		// Propagate the lock acquisition error
		throw lockError
	}

	// Variables to hold the actual paths of temp files if they are created.
	let actualTempNewFilePath: string | null = null
	let actualTempBackupFilePath: string | null = null

	try {
		// If readModifyFn is provided, read the file and call the function
		if (readModifyFn) {
			// Read the current data
			let currentData
			try {
				currentData = await _streamDataFromFile(absoluteFilePath)
			} catch (error: any) {
				if (error?.code === "ENOENT") {
					currentData = undefined
				} else {
					throw error
				}
			}

			// Use either the existing data or the provided default
			const dataToModify = currentData === undefined ? data : currentData

			// If the file doesn't exist (currentData is undefined) and data is undefined, throw an error
			if (dataToModify === undefined) {
				throw new Error(`File ${absoluteFilePath} does not exist and no default data was provided`)
			}

			// Call the modify function with the current data or default
			const shouldWrite = await readModifyFn(dataToModify)

			// If readModifyFn returns false, abort the write without error
			// The lock will still be released in the finally block
			if (shouldWrite === false) {
				return dataToModify // Return the data even if we don't write it
			}

			// Use the modified data for writing
			data = dataToModify
		}

		// Step 1: Write data to a new temporary file.
		actualTempNewFilePath = path.join(
			path.dirname(absoluteFilePath),
			`.${path.basename(absoluteFilePath)}.new_${Date.now()}_${Math.random().toString(36).substring(2)}.tmp`,
		)

		await _streamDataToFile(actualTempNewFilePath, data)

		// Step 2: Check if the target file exists. If so, rename it to a backup path.
		try {
			// Check for target file existence
			await fs.access(absoluteFilePath)
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
		// Mark as "used" or "committed"
		actualTempNewFilePath = null

		// Step 4: If a backup was created, attempt to delete it.
		if (actualTempBackupFilePath) {
			try {
				await fs.unlink(actualTempBackupFilePath)
				// Mark backup as handled
				actualTempBackupFilePath = null
			} catch (unlinkBackupError) {
				// Log this error, but do not re-throw. The main operation was successful.
				// actualTempBackupFilePath remains set, indicating an orphaned backup.
				console.error(
					`Successfully wrote ${absoluteFilePath}, but failed to clean up backup ${actualTempBackupFilePath}:`,
					unlinkBackupError,
				)
			}
		}

		// Return the data that was written
		return data
	} catch (originalError) {
		console.error(`Operation failed for ${absoluteFilePath}: [Original Error Caught]`, originalError)

		const newFileToCleanupWithinCatch = actualTempNewFilePath
		const backupFileToRollbackOrCleanupWithinCatch = actualTempBackupFilePath

		// Attempt rollback if a backup was made
		if (backupFileToRollbackOrCleanupWithinCatch) {
			try {
				await fs.rename(backupFileToRollbackOrCleanupWithinCatch, absoluteFilePath)
				// Mark as handled, prevent later unlink of this path
				actualTempBackupFilePath = null
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
			console.error(`Failed to release lock for ${absoluteFilePath}:`, unlockError)
		}
	}
}

/**
 * Helper function to stream JSON data to a file.
 * @param targetPath The path to write the stream to.
 * @param data The data to stream.
 * @returns Promise<void>
 */
async function _streamDataToFile(targetPath: string, data: any): Promise<void> {
	// Stream data to avoid high memory usage for large JSON objects.
	const fileWriteStream = fsSync.createWriteStream(targetPath, { encoding: "utf8" })
	const disassembler = Disassembler.disassembler()
	// Output will be compact JSON as standard Stringer is used.
	const stringer = Stringer.stringer()

	return new Promise<void>((resolve, reject) => {
		let errorOccurred = false
		const handleError = (_streamName: string) => (err: Error) => {
			if (!errorOccurred) {
				errorOccurred = true
				if (!fileWriteStream.destroyed) {
					fileWriteStream.destroy(err)
				}
				reject(err)
			}
		}

		disassembler.on("error", handleError("Disassembler"))
		stringer.on("error", handleError("Stringer"))
		fileWriteStream.on("error", (err: Error) => {
			if (!errorOccurred) {
				errorOccurred = true
				reject(err)
			}
		})

		fileWriteStream.on("finish", () => {
			if (!errorOccurred) {
				resolve()
			}
		})

		disassembler.pipe(stringer).pipe(fileWriteStream)

		// stream-json's Disassembler might error if `data` is undefined.
		// JSON.stringify(undefined) would produce the string "undefined" if it's the root value.
		// Writing 'null' is a safer JSON representation for a root undefined value.
		if (data === undefined) {
			disassembler.write(null)
		} else {
			disassembler.write(data)
		}
		disassembler.end()
	})
}

/**
 * Helper function to stream JSON data from a file.
 * @param sourcePath The path to read the stream from.
 * @param jsonPath Optional JSON path to extract specific data.
 * @returns Promise<any> The parsed JSON data.
 */
async function _streamDataFromFile(sourcePath: string, jsonPath?: string | string[]): Promise<any> {
	// Create a readable stream from the file
	const fileReadStream = fsSync.createReadStream(sourcePath, { encoding: "utf8" })

	// Set up the pipeline components
	const jsonParser = parser()

	// Create the base pipeline
	let pipeline = fileReadStream.pipe(jsonParser)

	// Add path selection if specified
	if (jsonPath) {
		// For single path as string
		if (!Array.isArray(jsonPath)) {
			const pathFilter = pick({ filter: jsonPath })
			pipeline = pipeline.pipe(pathFilter)
		}
		// For array paths, we'll handle them differently below
	}

	// Add value collection
	const valueStreamer = streamValues()
	pipeline = pipeline.pipe(valueStreamer)

	return new Promise<any>((resolve, reject) => {
		let errorOccurred = false
		const result: any[] = []

		const handleError = (streamName: string) => (err: Error) => {
			if (!errorOccurred) {
				errorOccurred = true
				if (!fileReadStream.destroyed) {
					fileReadStream.destroy(err)
				}
				reject(err)
			}
		}

		// Set up error handlers for all stream components
		fileReadStream.on("error", handleError("FileReadStream"))
		jsonParser.on("error", handleError("Parser"))
		valueStreamer.on("error", handleError("StreamValues"))

		// Collect data
		valueStreamer.on("data", (data: any) => {
			result.push(data.value)
		})

		// Handle end of stream
		valueStreamer.on("end", () => {
			if (!errorOccurred) {
				// If we're not extracting a specific path
				if (!jsonPath) {
					resolve(result.length === 1 ? result[0] : result)
				}
				// If we're extracting multiple paths
				else if (Array.isArray(jsonPath)) {
					// For multiple paths, we need to process the full result and extract each path
					const fullData = result.length === 1 ? result[0] : result
					const extractedValues = []

					// Extract each path from the full data
					for (const path of jsonPath) {
						const parts = path.split(".")
						let current = fullData

						// Navigate through the path
						for (const part of parts) {
							if (current && typeof current === "object" && part in current) {
								current = current[part]
							} else {
								current = undefined
								break
							}
						}

						extractedValues.push(current)
					}

					resolve(extractedValues)
				}
				// If we're extracting a single path
				else {
					// Return the first result or undefined if no results were found
					resolve(result.length > 0 ? result[0] : undefined)
				}
			}
		})
	})
}

/**
 * Safely reads JSON data from a file using streaming.
 * - Uses 'proper-lockfile' for advisory locking to prevent concurrent access
 * - Streams the file contents to efficiently handle large JSON files
 * - Supports both full object reading and selective path extraction
 *
 * @param {string} filePath - The path to the file to read
 * @param {string|string[]} [jsonPath] - Optional JSON path to extract specific data
 * @returns {Promise<any>} - The parsed JSON data
 *
 * @example
 * // Read entire JSON file
 * const data = await safeReadJson('config.json');
 *
 * @example
 * // Extract a specific property using a path
 * const username = await safeReadJson('user.json', 'profile.username');
 *
 * @example
 * // Extract multiple properties using an array of paths
 * const [username, email] = await safeReadJson('user.json', ['profile.username', 'contact.email']);
 */
async function safeReadJson(filePath: string, jsonPath?: string | string[]): Promise<any> {
	const absoluteFilePath = path.resolve(filePath)
	let releaseLock = async () => {} // Initialized to a no-op

	try {
		// Check if file exists
		await fs.access(absoluteFilePath)

		// Acquire lock
		try {
			releaseLock = await _acquireLock(absoluteFilePath)
		} catch (lockError) {
			console.error(`Failed to acquire lock for reading ${absoluteFilePath}:`, lockError)
			throw lockError
		}

		// Stream and parse the file
		return await _streamDataFromFile(absoluteFilePath, jsonPath)
	} finally {
		// Release the lock in the finally block
		try {
			await releaseLock()
		} catch (unlockError) {
			console.error(`Failed to release lock for ${absoluteFilePath}:`, unlockError)
		}
	}
}

export { safeWriteJson, safeReadJson }
