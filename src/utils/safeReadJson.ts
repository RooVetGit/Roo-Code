import * as fs from "fs/promises"
import * as fsSync from "fs"
import * as path from "path"
import * as Parser from "stream-json/Parser"
import * as Pick from "stream-json/filters/Pick"
import * as StreamValues from "stream-json/streamers/StreamValues"

import { _acquireLock } from "./safeWriteJson"

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
	const jsonParser = Parser.parser()

	// Create the base pipeline
	let pipeline = fileReadStream.pipe(jsonParser)

	// Add path selection if specified
	if (jsonPath) {
		// For single path as string
		if (!Array.isArray(jsonPath)) {
			const pathFilter = Pick.pick({ filter: jsonPath })
			pipeline = pipeline.pipe(pathFilter)
		}
		// For array paths, we'll handle them differently below
	}

	// Add value collection
	const valueStreamer = StreamValues.streamValues()
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

export { safeReadJson, _streamDataFromFile }
