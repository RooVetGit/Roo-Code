import { stat } from "fs/promises"

export interface LineRange {
	start: number
	end: number
}

export interface FileMetadata {
	fileName: string
	mtime: number
	loadedRanges: LineRange[]
}

export interface ConversationMessage {
	files?: FileMetadata[]
}

export interface FilteredReadRequest {
	status: "REJECT_ALL" | "ALLOW_PARTIAL" | "ALLOW_ALL"
	rangesToRead: LineRange[]
}

/**
 * Checks if two ranges overlap.
 */
function rangesOverlap(r1: LineRange, r2: LineRange): boolean {
	return r1.start <= r2.end && r1.end >= r2.start
}

/**
 * Subtracts one range from another.
 * Returns an array of ranges that are in `original` but not in `toRemove`.
 */
export function subtractRange(original: LineRange, toRemove: LineRange): LineRange[] {
	if (!rangesOverlap(original, toRemove)) {
		return [original]
	}

	const result: LineRange[] = []

	// Part of original before toRemove
	if (original.start < toRemove.start) {
		result.push({ start: original.start, end: toRemove.start - 1 })
	}

	// Part of original after toRemove
	if (original.end > toRemove.end) {
		result.push({ start: toRemove.end + 1, end: original.end })
	}

	return result
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

export async function processAndFilterReadRequest(
	requestedFile: string,
	requestedRanges: LineRange[],
	conversationHistory: ConversationMessage[],
): Promise<FilteredReadRequest> {
	let currentMtime: number
	try {
		currentMtime = (await stat(requestedFile)).mtime.getTime()
	} catch (error) {
		// File doesn't exist or other error, so we must read.
		return {
			status: "ALLOW_ALL",
			rangesToRead: requestedRanges,
		}
	}

	let rangesThatStillNeedToBeRead = [...requestedRanges]

	for (let i = conversationHistory.length - 1; i >= 0; i--) {
		const message = conversationHistory[i]
		if (!message.files) {
			continue
		}

		const relevantFileHistory = message.files.find((f) => f.fileName === requestedFile)

		if (relevantFileHistory && relevantFileHistory.mtime >= currentMtime) {
			rangesThatStillNeedToBeRead = subtractRanges(rangesThatStillNeedToBeRead, relevantFileHistory.loadedRanges)

			if (rangesThatStillNeedToBeRead.length === 0) {
				return {
					status: "REJECT_ALL",
					rangesToRead: [],
				}
			}
		}
	}

	const originalRangesString = JSON.stringify(requestedRanges.sort((a, b) => a.start - b.start))
	const finalRangesString = JSON.stringify(rangesThatStillNeedToBeRead.sort((a, b) => a.start - b.start))

	if (originalRangesString === finalRangesString) {
		return {
			status: "ALLOW_ALL",
			rangesToRead: requestedRanges,
		}
	}

	return {
		status: "ALLOW_PARTIAL",
		rangesToRead: rangesThatStillNeedToBeRead,
	}
}
