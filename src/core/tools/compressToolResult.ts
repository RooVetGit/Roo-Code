import { truncateOutput } from "../../integrations/misc/extract-text"
import { DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT } from "@roo-code/types"

/**
 * Default character limit for tool results to prevent context window exhaustion
 * This is set to be conservative to ensure tool results don't consume too much context
 */
export const DEFAULT_TOOL_RESULT_CHARACTER_LIMIT = 50000

/**
 * Default line limit for tool results
 */
export const DEFAULT_TOOL_RESULT_LINE_LIMIT = 1000

/**
 * Compresses a tool result if it exceeds the specified limits.
 * Uses the same truncation logic as terminal output compression to maintain consistency.
 *
 * @param result The tool result string to potentially compress
 * @param characterLimit Maximum number of characters allowed (defaults to DEFAULT_TOOL_RESULT_CHARACTER_LIMIT)
 * @param lineLimit Maximum number of lines allowed (defaults to DEFAULT_TOOL_RESULT_LINE_LIMIT)
 * @returns The original result if within limits, or a compressed version with truncation indicators
 */
export function compressToolResult(
	result: string,
	characterLimit: number = DEFAULT_TOOL_RESULT_CHARACTER_LIMIT,
	lineLimit: number = DEFAULT_TOOL_RESULT_LINE_LIMIT,
): string {
	// If result is empty or null, return as-is
	if (!result || result.length === 0) {
		return result
	}

	// Check if compression is needed
	const needsCharacterCompression = characterLimit > 0 && result.length > characterLimit
	const needsLineCompression = lineLimit > 0 && result.split("\n").length > lineLimit

	// If no compression is needed, return original result
	if (!needsCharacterCompression && !needsLineCompression) {
		return result
	}

	// Use the existing truncateOutput function which handles both character and line limits
	// and provides intelligent truncation with context preservation
	const compressedResult = truncateOutput(
		result,
		lineLimit > 0 ? lineLimit : undefined,
		characterLimit > 0 ? characterLimit : undefined,
	)

	// Add a note about compression if the result was actually truncated
	if (compressedResult !== result) {
		const originalLength = result.length
		const originalLines = result.split("\n").length
		const compressedLength = compressedResult.length
		const compressedLines = compressedResult.split("\n").length

		// Add compression info at the beginning to make it clear to the model
		const compressionNote = `[Tool result compressed: Original ${originalLength} characters, ${originalLines} lines → Compressed to ${compressedLength} characters, ${compressedLines} lines to prevent context window exhaustion]\n\n`

		return compressionNote + compressedResult
	}

	return compressedResult
}

/**
 * Determines if a tool result should be compressed based on its size and the model's context window.
 * This can be used to make compression decisions before actually compressing.
 *
 * @param result The tool result to check
 * @param characterLimit Character limit threshold
 * @param lineLimit Line limit threshold
 * @returns true if the result exceeds the limits and should be compressed
 */
export function shouldCompressToolResult(
	result: string,
	characterLimit: number = DEFAULT_TOOL_RESULT_CHARACTER_LIMIT,
	lineLimit: number = DEFAULT_TOOL_RESULT_LINE_LIMIT,
): boolean {
	if (!result || result.length === 0) {
		return false
	}

	const exceedsCharacterLimit = characterLimit > 0 && result.length > characterLimit
	const exceedsLineLimit = lineLimit > 0 && result.split("\n").length > lineLimit

	return exceedsCharacterLimit || exceedsLineLimit
}

/**
 * Gets appropriate compression limits based on the model's context window size.
 * Larger context windows can accommodate larger tool results.
 *
 * @param contextWindow The model's context window size in tokens
 * @returns Object with characterLimit and lineLimit appropriate for the context window
 */
export function getCompressionLimitsForContextWindow(contextWindow: number): {
	characterLimit: number
	lineLimit: number
} {
	// Conservative approach: tool results should not exceed a small percentage of context window
	// Assuming roughly 4 characters per token on average
	const maxToolResultTokens = Math.floor(contextWindow * 0.1) // 10% of context window
	const characterLimit = Math.min(maxToolResultTokens * 4, DEFAULT_TOOL_RESULT_CHARACTER_LIMIT * 2) // Cap at 2x default

	// Line limit scales with character limit
	const lineLimit = Math.floor(characterLimit / 50) // Assume ~50 chars per line on average

	return {
		characterLimit: Math.max(characterLimit, DEFAULT_TOOL_RESULT_CHARACTER_LIMIT), // Never go below default
		lineLimit: Math.max(lineLimit, DEFAULT_TOOL_RESULT_LINE_LIMIT), // Never go below default
	}
}
