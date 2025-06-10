import fs from "fs"
import { lruCache } from "../utils/lruCache"
import { ROO_AGENT_CONFIG } from "../config/envConfig"

const CACHE_SIZE = ROO_AGENT_CONFIG.fileReadCacheSize()

// Types
export interface LineRange {
	start: number
	end: number
}

export interface FileMetadata {
	fileName: string
	mtime: number
	lineRanges: LineRange[]
}

export interface ConversationMessage {
	role: "user" | "assistant"
	content: any
	ts: number
	tool?: {
		name: string
		options: any
	}
	files?: FileMetadata[]
}

type CacheResult =
	| { status: "ALLOW_ALL"; rangesToRead: LineRange[] }
	| { status: "ALLOW_PARTIAL"; rangesToRead: LineRange[] }
	| { status: "REJECT_ALL"; rangesToRead: LineRange[] }

// Initialize a new LRU cache for file modification times.
const mtimeCache = new lruCache<string, string>(CACHE_SIZE)

/**
 * Checks if two line ranges overlap.
 * @param r1 - The first line range.
 * @param r2 - The second line range.
 * @returns True if the ranges overlap, false otherwise.
 */
function rangesOverlap(r1: LineRange, r2: LineRange): boolean {
	return r1.start <= r2.end && r1.end >= r2.start
}

/**
 * Subtracts one line range from another.
 * @param from - The range to subtract from.
 * @param toSubtract - The range to subtract.
 * @returns An array of ranges remaining after subtraction.
 */
export function subtractRange(from: LineRange, toSubtract: LineRange): LineRange[] {
	// No overlap
	if (from.end < toSubtract.start || from.start > toSubtract.end) {
		return [from]
	}
	const remainingRanges: LineRange[] = []
	// Part of 'from' is before 'toSubtract'
	if (from.start < toSubtract.start) {
		remainingRanges.push({ start: from.start, end: toSubtract.start - 1 })
	}
	// Part of 'from' is after 'toSubtract'
	if (from.end > toSubtract.end) {
		remainingRanges.push({ start: toSubtract.end + 1, end: from.end })
	}
	return remainingRanges
}

/**
 * Subtracts a set of ranges from another set of ranges.
 */
export function subtractRanges(originals: LineRange[], toRemoves: LineRange[]): LineRange[] {
	let remaining = [...originals]

	for (const toRemove of toRemoves) {
		remaining = remaining.flatMap((original) => subtractRange(original, toRemove))
	}

	return remaining
}

/**
 *
 * @param filePath The path to the file to get the mtime for.
 * @returns The mtime of the file as an ISO string, or null if the file does not exist.
 * @throws An error if there is an error getting the file stats, other than the file not existing.
 */
async function getFileMtime(filePath: string): Promise<string | null> {
	const cachedMtime = mtimeCache.get(filePath)
	if (cachedMtime) {
		return cachedMtime
	}
	try {
		const stats = await fs.promises.stat(filePath)
		const mtime = stats.mtime.toISOString()
		mtimeCache.set(filePath, mtime)
		return mtime
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return null // File does not exist, so no mtime.
		}
		// For other errors, we want to know about them.
		throw error
	}
}

/**
 * Processes a read request against cached file data in conversation history.
 * @param requestedFilePath - The full path of the file being requested.
 * @param requestedRanges - The line ranges being requested.
 * @param conversationHistory - The history of conversation messages.
 * @returns A CacheResult indicating whether to allow, partially allow, or reject the read.
 */
export async function processAndFilterReadRequest(
	requestedFilePath: string,
	requestedRanges: LineRange[],
	conversationHistory: ConversationMessage[],
): Promise<CacheResult> {
	try {
		const currentMtime = await getFileMtime(requestedFilePath)
		if (currentMtime === null) {
			// If file does not exist, there's nothing to read from cache. Let the tool handle it.
			return { status: "ALLOW_ALL", rangesToRead: requestedRanges }
		}

		let rangesToRead = [...requestedRanges]

		// If no specific ranges are requested, treat it as a request for the whole file.
		if (rangesToRead.length === 0) {
			// We need to know the number of lines to create a full range.
			// This logic is simplified; in a real scenario, you'd get the line count.
			// For this example, we'll assume we can't determine the full range without reading the file,
			// so we proceed with ALLOW_ALL if no ranges are specified.
			return { status: "ALLOW_ALL", rangesToRead: requestedRanges }
		}

		for (const message of conversationHistory) {
			if (message.files) {
				for (const file of message.files) {
					if (file.fileName === requestedFilePath && new Date(file.mtime) >= new Date(currentMtime)) {
						// File in history is up-to-date. Check ranges.
						for (const cachedRange of file.lineRanges) {
							rangesToRead = rangesToRead.flatMap((reqRange) => {
								if (rangesOverlap(reqRange, cachedRange)) {
									return subtractRange(reqRange, cachedRange)
								}
								return [reqRange]
							})
						}
					}
				}
			}
		}

		if (rangesToRead.length === 0) {
			return { status: "REJECT_ALL", rangesToRead: [] }
		} else if (rangesToRead.length < requestedRanges.length) {
			return { status: "ALLOW_PARTIAL", rangesToRead }
		} else {
			return { status: "ALLOW_ALL", rangesToRead: requestedRanges }
		}
	} catch (error) {
		console.error(`Error processing file read request for ${requestedFilePath}:`, error)
		// On other errors, allow the read to proceed to let the tool handle it.
		return { status: "ALLOW_ALL", rangesToRead: requestedRanges }
	}
}
