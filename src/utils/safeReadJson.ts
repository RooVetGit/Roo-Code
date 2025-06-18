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
 *
 * @param {string} filePath - The path to the file to read
 * @returns {Promise<any>} - The parsed JSON data
 *
 * @example
 * // Read entire JSON file
 * const data = await safeReadJson('config.json');
 */
async function safeReadJson(filePath: string): Promise<any> {
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
		return await _streamDataFromFile(absoluteFilePath)
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
 * @returns Promise<any> The parsed JSON data.
 */
async function _streamDataFromFile(sourcePath: string): Promise<any> {
	// Create a readable stream from the file
	const fileReadStream = fsSync.createReadStream(sourcePath, { encoding: "utf8" })

	// Set up the pipeline components
	const jsonParser = Parser.parser()

	// Create the base pipeline
	let pipeline = fileReadStream.pipe(jsonParser)

	// Add value collection
	const valueStreamer = StreamValues.streamValues()
	pipeline = pipeline.pipe(valueStreamer)

	return new Promise<any>((resolve, reject) => {
		let errorOccurred = false
		const result: any[] = []

		const handleError = (streamName: string) => (err: unknown) => {
			if (!errorOccurred) {
				errorOccurred = true
				if (!fileReadStream.destroyed) {
					fileReadStream.destroy(err instanceof Error ? err : new Error(String(err)))
				}
				reject(err instanceof Error ? err : new Error(`${streamName} error: ${String(err)}`))
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
				resolve(result.length === 1 ? result[0] : result)
			}
		})
	})
}

export { safeReadJson, _streamDataFromFile }
