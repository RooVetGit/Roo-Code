import { stat } from "fs/promises"
import { lruCache } from "../utils/lruCache"
import { ROO_AGENT_CONFIG } from "../config/envConfig"

const CACHE_SIZE = ROO_AGENT_CONFIG.fileReadCacheSize()
const MAX_CACHE_MEMORY_MB = 100 // Maximum memory usage in MB for file content cache
const MAX_CACHE_MEMORY_BYTES = MAX_CACHE_MEMORY_MB * 1024 * 1024

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

// Cache entry with size tracking
interface CacheEntry {
	mtime: string
	size: number // Size in bytes
}

// Memory-aware cache for tracking file metadata
class MemoryAwareCache {
	private cache: Map<string, CacheEntry> = new Map()
	private totalSize: number = 0
	private maxSize: number

	constructor(maxSizeBytes: number) {
		this.maxSize = maxSizeBytes
	}

	get(key: string): string | undefined {
		const entry = this.cache.get(key)
		if (!entry) return undefined

		// Move to end (most recently used)
		this.cache.delete(key)
		this.cache.set(key, entry)
		return entry.mtime
	}

	set(key: string, mtime: string, size: number): void {
		// Remove existing entry if present
		if (this.cache.has(key)) {
			const oldEntry = this.cache.get(key)!
			this.totalSize -= oldEntry.size
			this.cache.delete(key)
		}

		// Evict oldest entries if needed
		while (this.totalSize + size > this.maxSize && this.cache.size > 0) {
			const oldestKey = this.cache.keys().next().value
			if (oldestKey !== undefined) {
				const oldestEntry = this.cache.get(oldestKey)!
				this.totalSize -= oldestEntry.size
				this.cache.delete(oldestKey)
				console.log(`[FileReadCache] Evicted ${oldestKey} to free ${oldestEntry.size} bytes`)
			}
		}

		// Add new entry
		this.cache.set(key, { mtime, size })
		this.totalSize += size
	}

	delete(key: string): boolean {
		const entry = this.cache.get(key)
		if (!entry) return false

		this.totalSize -= entry.size
		this.cache.delete(key)
		return true
	}

	clear(): void {
		this.cache.clear()
		this.totalSize = 0
	}

	getStats() {
		return {
			entries: this.cache.size,
			totalSizeBytes: this.totalSize,
			totalSizeMB: (this.totalSize / 1024 / 1024).toFixed(2),
			maxSizeBytes: this.maxSize,
			maxSizeMB: (this.maxSize / 1024 / 1024).toFixed(2),
			utilizationPercent: ((this.totalSize / this.maxSize) * 100).toFixed(1),
		}
	}
}

// Initialize memory-aware cache
const memoryAwareCache = new MemoryAwareCache(MAX_CACHE_MEMORY_BYTES)

// Export as mtimeCache for compatibility with tests and existing code
export const mtimeCache = memoryAwareCache

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
		try {
			const stats = await stat(filePath)
			if (stats.mtime.toISOString() === cachedMtime) {
				return cachedMtime
			}
			// Update cache with new mtime and size
			const mtime = stats.mtime.toISOString()
			mtimeCache.set(filePath, mtime, stats.size)
			return mtime
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") {
				// File was deleted, remove from cache
				mtimeCache.delete(filePath)
				return null
			}
			// For other errors like permission issues, log and rethrow
			console.error(`[FileReadCache] Error checking file ${filePath}:`, error)
			throw error
		}
	}
	try {
		const stats = await stat(filePath)
		const mtime = stats.mtime.toISOString()
		mtimeCache.set(filePath, mtime, stats.size)
		return mtime
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return null // File does not exist, so no mtime.
		}
		// For other errors, we want to know about them.
		console.error(`[FileReadCache] Error accessing file ${filePath}:`, error)
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
		// First attempt to get file mtime
		let currentMtime: string | null
		try {
			currentMtime = await getFileMtime(requestedFilePath)
		} catch (error) {
			// Handle file system errors gracefully
			if (error instanceof Error && "code" in error) {
				const code = (error as any).code
				if (code === "EACCES" || code === "EPERM") {
					console.warn(`[FileReadCache] Permission denied accessing ${requestedFilePath}`)
					return { status: "ALLOW_ALL", rangesToRead: requestedRanges }
				}
			}
			throw error // Re-throw other unexpected errors
		}

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
			if (!message.files?.length) continue
			for (const file of message.files) {
				if (file.fileName !== requestedFilePath) continue
				// Normalise the mtime coming from the history because it could be
				// a number (ms since epoch) or already an ISO string.
				const fileMtimeMs = typeof file.mtime === "number" ? file.mtime : Date.parse(String(file.mtime))
				if (Number.isNaN(fileMtimeMs)) {
					// If the mtime cannot be parsed, skip this history entry – we cannot
					// rely on it for cache validation.
					continue
				}
				// Only treat the history entry as valid if it is at least as fresh as
				// the file on disk.
				if (fileMtimeMs >= Date.parse(currentMtime)) {
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

		// Decide the cache policy based on how the requested ranges compare to the
		// ranges that still need to be read after checking the conversation history.
		if (rangesToRead.length === 0) {
			// The entire request is already satisfied by the cache.
			return { status: "REJECT_ALL", rangesToRead: [] }
		}

		// A partial hit occurs when *any* of the requested ranges were served by the
		// cache. Comparing only the array length is not sufficient because the number
		// of ranges can stay the same even though their boundaries have changed
		// (e.g. `[ {1-20} ]` -> `[ {11-20} ]`). Instead, detect partial hits by
		// checking deep equality with the original request.
		const isPartial =
			rangesToRead.length !== requestedRanges.length ||
			JSON.stringify(rangesToRead) !== JSON.stringify(requestedRanges)

		if (isPartial) {
			return { status: "ALLOW_PARTIAL", rangesToRead }
		}

		// No overlap with cache – allow the full request through.
		return { status: "ALLOW_ALL", rangesToRead: requestedRanges }
	} catch (error) {
		console.error(`Error processing file read request for ${requestedFilePath}:`, error)
		// On other errors, allow the read to proceed to let the tool handle it.
		return { status: "ALLOW_ALL", rangesToRead: requestedRanges }
	}
}
