import * as fs from "fs/promises"
import * as path from "path"
import { ApiMessage, FileLineRange, FileMetadata, ToolMetadata } from "../task-persistence/apiMessages"
import { countFileLines } from "../../integrations/misc/line-counter"
import { Task } from "../task/Task"

/**
 * Checks if a file read is required based on conversation history and current mtime.
 * Returns the ranges that still need to be read from disk.
 */
export async function checkReadRequirement(
	fullPath: string,
	filePath: string,
	requestedRanges: FileLineRange[],
	apiConversationHistory: ApiMessage[],
	initialMtime: number,
): Promise<{ rangesToRead: FileLineRange[]; validMessageIndices: number[] }> {
	console.log(`[DEBUG] checkReadRequirement START: ${fullPath}`)

	// Get current mtime to validate against history
	let currentMtime: number
	try {
		const stats = await fs.stat(fullPath)
		currentMtime = Math.floor(stats.mtimeMs)
		console.log(`[DEBUG] checkReadRequirement: fs.stat SUCCESS for ${fullPath}`)
	} catch (error) {
		console.log(`[DEBUG] checkReadRequirement: fs.stat FAILED for ${fullPath}:`, error.message)
		// File doesn't exist, so all ranges need to be read (will fail later)
		return { rangesToRead: requestedRanges, validMessageIndices: [] }
	}

	console.log(
		`[DEBUG] ${filePath}: currentMtime=${currentMtime}, initialMtime=${initialMtime}, historyEntries=${apiConversationHistory.length}`,
	)

	// If mtime changed since tool started, all ranges are invalid
	if (currentMtime !== initialMtime) {
		return { rangesToRead: requestedRanges, validMessageIndices: [] }
	}

	// Walk conversation history in reverse to find valid ranges
	const validRanges: FileLineRange[] = []
	const validMessageIndices: number[] = []

	for (let i = apiConversationHistory.length - 1; i >= 0; i--) {
		const message = apiConversationHistory[i]
		if (!message.files) continue

		const fileMetadata = message.files.find((f) => f.path === filePath)
		console.log(
			`[DEBUG] ${filePath}: checking history entry, found fileMetadata=${!!fileMetadata}, messagePaths=${message.files?.map((f) => f.path).join(",")}`,
		)

		if (!fileMetadata) continue

		console.log(
			`[DEBUG] ${filePath}: fileMetadata.mtime=${fileMetadata.mtime}, currentMtime=${currentMtime}, ranges=${fileMetadata.validRanges.length}`,
		)

		// Only use ranges if mtime matches exactly
		if (fileMetadata.mtime === currentMtime) {
			validRanges.push(...fileMetadata.validRanges)
			if (!validMessageIndices.includes(i)) {
				validMessageIndices.push(i)
			}
		}
		// If we find a different mtime, stop looking (file changed)
		else {
			break
		}
	}

	// Calculate which requested ranges are not covered by valid ranges
	const rangesToRead = subtractRanges(requestedRanges, validRanges)

	console.log(`[DEBUG] ${filePath}: validRanges=${validRanges.length}, rangesToRead=${rangesToRead.length}`)

	return { rangesToRead, validMessageIndices: validMessageIndices.sort((a, b) => a - b) }
}

/**
 * Computes which line ranges were modified by comparing original and modified content.
 */
function computeModifiedRanges(originalLines: string[], modifiedLines: string[]): FileLineRange[] {
	const ranges: FileLineRange[] = []
	let start = -1

	for (let i = 0; i < Math.max(originalLines.length, modifiedLines.length); i++) {
		if (originalLines[i] !== modifiedLines[i]) {
			if (start === -1) {
				start = i + 1
			}
		} else if (start !== -1) {
			ranges.push({ start: start, end: i })
			start = -1
		}
	}

	if (start !== -1) {
		ranges.push({ start: start, end: modifiedLines.length })
	}

	return ranges
}

/**
 * Adjusts historical ranges based on line shifts from modifications.
 */
function adjustHistoricalRanges(
	historicalRanges: FileLineRange[],
	originalContent: string,
	modifiedContent: string,
): FileLineRange[] {
	const diff = require("diff")
	const changes = diff.diffLines(originalContent, modifiedContent, { newlineIsToken: true })

	let adjustedRanges = [...historicalRanges]

	let lineOffset = 0
	let originalLine = 1

	for (const part of changes) {
		const partEnd = originalLine + part.count - 1

		if (part.added) {
			lineOffset += part.count
		} else if (part.removed) {
			lineOffset -= part.count
		}

		adjustedRanges = adjustedRanges.map((range) => {
			const rangeEnd = range.start + (range.end - range.start)
			if (part.removed && range.start <= partEnd && rangeEnd >= originalLine) {
				// Range is affected by removal
				const overlapStart = Math.max(range.start, originalLine)
				const overlapEnd = Math.min(rangeEnd, partEnd)
				const overlap = overlapEnd - overlapStart + 1
				return { start: range.start, end: range.end - overlap }
			} else if (part.added && range.start > originalLine) {
				// Range is after addition
				return { start: range.start + part.count, end: range.end + part.count }
			}
			return range
		})

		if (!part.added) {
			originalLine += part.count
		}
	}

	return adjustedRanges.filter((r) => r.start <= r.end)
}

/**
 * Calculates the line shift for a specific modification range.
 */
function getLineShiftForRange(modRange: FileLineRange, originalLines: string[], modifiedLines: string[]): number {
	const originalRangeSize = Math.min(modRange.end, originalLines.length) - modRange.start + 1
	const modifiedRangeSize = Math.min(modRange.end, modifiedLines.length) - modRange.start + 1
	return modifiedRangeSize - originalRangeSize
}

/**
 * Gets line-by-line changes between original and modified content.
 */
function getChangedLineRanges(
	originalContent: string,
	modifiedContent: string,
): { ranges: FileLineRange[]; totalShift: number } {
	const originalLines = originalContent.split("\n")
	const modifiedLines = modifiedContent.split("\n")

	const ranges = computeModifiedRanges(originalLines, modifiedLines)
	const totalShift = modifiedLines.length - originalLines.length

	return { ranges, totalShift }
}

/**
 * Calculates the final valid ranges after a write operation.
 * Compares original and modified content to determine which ranges changed.
 */
export function calculateWriteRanges(
	filePath: string,
	originalContent: string | undefined,
	modifiedContent: string,
	finalMtime: number,
	apiConversationHistory: ApiMessage[],
): FileMetadata {
	const modifiedLines = modifiedContent.split("\n")
	const totalLines = modifiedContent.trim() === "" ? 0 : modifiedLines.length

	// For new files, entire content is valid
	if (originalContent === undefined || originalContent === "") {
		return {
			path: filePath,
			mtime: finalMtime,
			validRanges: totalLines > 0 ? [{ start: 1, end: totalLines }] : [],
		}
	}

	// Get historical valid ranges with matching mtime
	const historicalRanges: FileLineRange[] = []
	for (let i = apiConversationHistory.length - 1; i >= 0; i--) {
		const message = apiConversationHistory[i]
		if (!message.files) continue

		const fileMetadata = message.files.find((f) => f.path === filePath)
		if (fileMetadata && fileMetadata.mtime === finalMtime) {
			historicalRanges.push(...fileMetadata.validRanges)
		} else if (fileMetadata) {
			// Stop if we find a different mtime (file changed)
			break
		}
	}

	// Find which ranges were modified
	const { ranges: modifiedRanges } = getChangedLineRanges(originalContent, modifiedContent)

	// If no changes detected, return historical ranges
	if (modifiedRanges.length === 0) {
		return {
			path: filePath,
			mtime: finalMtime,
			validRanges: mergeRanges(historicalRanges),
		}
	}

	// Adjust historical ranges based on modifications
	const adjustedHistoricalRanges = adjustHistoricalRanges(historicalRanges, originalContent, modifiedContent)

	// Combine modified ranges with adjusted historical ranges
	const allValidRanges = mergeRanges([...adjustedHistoricalRanges, ...modifiedRanges])

	return {
		path: filePath,
		mtime: finalMtime,
		validRanges: allValidRanges,
	}
}

/**
 * Calculates the final valid ranges after a read operation.
 * Merges newly read ranges with existing valid ranges from history.
 */
export function calculateReadRanges(
	filePath: string,
	newlyReadRanges: FileLineRange[],
	apiConversationHistory: ApiMessage[],
	currentMtime: number,
): FileMetadata {
	const existingValidRanges: FileLineRange[] = []
	for (let i = apiConversationHistory.length - 1; i >= 0; i--) {
		const message = apiConversationHistory[i]
		if (!message.files) continue
		const fileMetadata = message.files.find((f) => f.path === filePath)
		if (fileMetadata && fileMetadata.mtime === currentMtime) {
			existingValidRanges.push(...fileMetadata.validRanges)
		} else if (fileMetadata) {
			break
		}
	}

	const allValidRanges = mergeRanges([...existingValidRanges, ...newlyReadRanges])

	return {
		path: filePath,
		mtime: currentMtime,
		validRanges: allValidRanges,
	}
}

/**
 * Subtracts covered ranges from requested ranges.
 * Returns the portions of requested ranges that are not covered.
 */
export function subtractRanges(requested: FileLineRange[], covered: FileLineRange[]): FileLineRange[] {
	if (covered.length === 0) {
		return requested
	}

	const mergedCovered = mergeRanges(covered)
	const result: FileLineRange[] = []

	for (const req of requested) {
		let current = req

		for (const cov of mergedCovered) {
			if (current.end < cov.start || current.start > cov.end) {
				// No overlap, continue
				continue
			}

			// There is overlap, need to split current range
			if (current.start < cov.start) {
				// Add the part before the covered range
				result.push({ start: current.start, end: Math.min(current.end, cov.start - 1) })
			}

			if (current.end > cov.end) {
				// Update current to the part after the covered range
				current = { start: Math.max(current.start, cov.end + 1), end: current.end }
			} else {
				// Current range is completely covered
				current = { start: 0, end: -1 } // Invalid range to skip
				break
			}
		}

		// Add remaining part if valid
		if (current.start <= current.end && current.start > 0) {
			result.push(current)
		}
	}

	return result
}

/**
 * Consolidated function to check if ranges need to be read and validate against history.
 * Returns the ranges that still need to be read, or undefined if operation should be rejected.
 */
export async function getInvalidRanges(
	task: Task,
	filePath: string,
	requestedRanges: FileLineRange[],
): Promise<{ rangesToRead: FileLineRange[]; validMessageIndices: number[] } | undefined> {
	console.log(`[DEBUG] getInvalidRanges called for ${filePath}`)

	// Capture initial mtime for this file
	await task.ensureInitialMtime(filePath)
	const initialMtime = task.getInitialMtime(filePath)
	if (initialMtime === undefined) {
		throw new Error("Failed to capture initial file modification time")
	}

	let rangesToCheck = requestedRanges

	// If no specific ranges are requested, treat it as a full file read
	if (rangesToCheck.length === 0) {
		try {
			const fullPath = path.resolve(task.cwd, filePath)
			const totalLines = await countFileLines(fullPath)
			if (totalLines > 0) {
				rangesToCheck = [{ start: 1, end: totalLines }]
			}
		} catch (error) {
			// If file doesn't exist, proceed with empty ranges
			// checkReadRequirement will handle it correctly
		}
	}

	// Always check against conversation history
	let result: { rangesToRead: FileLineRange[]; validMessageIndices: number[] }
	try {
		const fullPath = path.resolve(task.cwd, filePath)
		result = await checkReadRequirement(
			fullPath,
			filePath, // Use relative path for history lookup
			rangesToCheck,
			task.apiConversationHistory,
			initialMtime,
		)
		console.log(`[DEBUG] ${filePath}: checkReadRequirement SUCCESS`)
	} catch (error) {
		console.log(`[DEBUG] ${filePath}: checkReadRequirement ERROR:`, error.message)
		throw error
	}

	console.log(`[DEBUG] ${filePath}: checkReadRequirement returned ${result.rangesToRead.length} ranges`)
	console.log(
		`[DEBUG] ${filePath}: rejection check - rangesToRead.length=${result.rangesToRead.length}, rangesToCheck.length=${rangesToCheck.length}`,
	)

	// If no ranges need to be read, reject the operation
	if (result.rangesToRead.length === 0 && rangesToCheck.length > 0) {
		return { rangesToRead: [], validMessageIndices: result.validMessageIndices }
	}

	return { rangesToRead: result.rangesToRead, validMessageIndices: result.validMessageIndices }
}

/**
 * Consolidated function to calculate file metadata after read or write operations.
 */
export async function calculateFileMetadata(
	task: Task,
	filePath: string,
	operation: "read" | "write",
	validRanges?: FileLineRange[],
): Promise<FileMetadata> {
	// Ensure initial mtime is captured
	await task.ensureInitialMtime(filePath)
	const initialMtime = task.getInitialMtime(filePath)
	if (initialMtime === undefined) {
		throw new Error("Initial mtime not captured for file")
	}

	if (operation === "write") {
		// For write operations, get the final mtime and content from diffViewProvider
		const fullPath = path.resolve(task.cwd, filePath)
		const stats = await fs.stat(fullPath)
		const finalMtime = Math.floor(stats.mtimeMs)

		// Get original and modified content from diffViewProvider
		const originalContent = task.diffViewProvider.originalContent || ""
		const modifiedContent = await fs.readFile(fullPath, "utf8")

		return calculateWriteRanges(filePath, originalContent, modifiedContent, finalMtime, task.apiConversationHistory)
	} else {
		// For read operations, use the provided valid ranges
		if (!validRanges) {
			throw new Error("Valid ranges must be provided for read operations")
		}

		return calculateReadRanges(filePath, validRanges, task.apiConversationHistory, initialMtime)
	}
}

/**
 * Merges overlapping and adjacent ranges into consolidated ranges.
 */
export function mergeRanges(ranges: FileLineRange[]): FileLineRange[] {
	if (ranges.length === 0) {
		return []
	}

	// Sort ranges by start position
	const sorted = [...ranges].sort((a, b) => a.start - b.start)
	const merged: FileLineRange[] = []
	let current = sorted[0]

	for (let i = 1; i < sorted.length; i++) {
		const next = sorted[i]

		// Check if ranges overlap or are adjacent
		if (current.end >= next.start - 1) {
			// Merge ranges
			current = {
				start: current.start,
				end: Math.max(current.end, next.end),
			}
		} else {
			// No overlap, add current and move to next
			merged.push(current)
			current = next
		}
	}

	// Add the last range
	merged.push(current)
	return merged
}
