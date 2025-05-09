import { Anthropic } from "@anthropic-ai/sdk"
import { getEncoderForProvider, getFudgeFactorForProvider, countImageTokens } from "./tiktoken"

/**
 * Debug information for token counting
 */
export interface TokenCountDebugInfo {
	/** Raw text tokens without any modifications */
	rawTextTokens: number
	/** Image tokens counted */
	imageTokens: number
	/** Overhead tokens added by the provider */
	overheadTokens: number
	/** Fudge factor applied */
	fudgeFactor: number
	/** Final token count after all adjustments */
	finalTokenCount: number
	/** Encoder used for tokenization */
	encoder: string
	/** Provider the tokens were counted for */
	provider: string
}

/**
 * Returns encoder name based on provider
 * @param provider Provider ID
 * @returns User-friendly encoder name
 */
export function getEncoderName(provider: string): string {
	switch (provider.toLowerCase()) {
		case "openai":
			return "gpt-4o"
		case "anthropic":
			return "cl100k_base"
		case "google":
		case "gemini":
			return "o200k_base"
		case "openrouter":
			return "gpt-4o"
		case "requesty":
			return "gpt-4o"
		default:
			return "o200k_base"
	}
}

/**
 * Enhanced token counting with debug information
 * @param content Content to count tokens for
 * @param provider Provider ID
 * @returns Token count and detailed debug information
 */
export async function tiktokenWithDebug(
	content: Anthropic.Messages.ContentBlockParam[],
	provider: string = "default",
): Promise<{ count: number; debug: TokenCountDebugInfo }> {
	if (content.length === 0) {
		return {
			count: 0,
			debug: {
				rawTextTokens: 0,
				imageTokens: 0,
				overheadTokens: 0,
				fudgeFactor: 1,
				finalTokenCount: 0,
				encoder: getEncoderName(provider),
				provider,
			},
		}
	}

	// Get the appropriate encoder for this provider
	const encoder = getEncoderForProvider(provider)
	const encoderName = getEncoderName(provider)
	const fudgeFactor = getFudgeFactorForProvider(provider)

	let rawTextTokens = 0
	let imageTokens = 0

	// Process each content block
	for (const block of content) {
		if (block.type === "text") {
			const text = block.text || ""
			if (text.length > 0) {
				const tokens = encoder.encode(text)
				rawTextTokens += tokens.length
			}
		} else if (block.type === "image") {
			// For images, use the provider-specific calculation
			imageTokens += countImageTokens(block.source, provider)
		}
	}

	// Get provider-specific overhead tokens
	const overheadTokens = getProviderOverheadTokens(provider)

	// Calculate total before fudge factor
	const subtotal = rawTextTokens + imageTokens + overheadTokens

	// Apply the provider-specific fudge factor
	const finalCount = Math.ceil(subtotal * fudgeFactor)

	return {
		count: finalCount,
		debug: {
			rawTextTokens,
			imageTokens,
			overheadTokens,
			fudgeFactor,
			finalTokenCount: finalCount,
			encoder: encoderName,
			provider,
		},
	}
}

/**
 * Get provider-specific overhead tokens for message formatting
 * @param provider The provider name
 * @returns Number of overhead tokens added by the provider
 */
function getProviderOverheadTokens(provider: string): number {
	// Some providers add overhead tokens for message formatting
	switch (provider.toLowerCase()) {
		case "openai":
			return 3 // OpenAI adds tokens for message formatting
		case "anthropic":
			return 2 // Anthropic adds fewer overhead tokens
		case "google":
		case "gemini":
			return 2 // Gemini adds overhead tokens too
		case "openrouter":
			return 3 // OpenRouter follows OpenAI format
		case "requesty":
			return 3 // Requesty is OpenAI-compatible
		default:
			return 0
	}
}

/**
 * Calibration data for token counting
 */
export interface CalibrationEntry {
	/** Provider ID */
	provider: string
	/** Estimated token count */
	estimatedTokens: number
	/** Actual token count reported by API */
	actualTokens: number
	/** Timestamp of the calibration entry */
	timestamp: number
}

// Maximum entries to keep in the calibration data
const MAX_CALIBRATION_ENTRIES = 100

// Store calibration data
const calibrationData: CalibrationEntry[] = []

// Provider-specific fudge factor adjustments based on calibration
const calibratedFudgeFactors: Record<string, number> = {}

/**
 * Add a calibration entry to improve token counting accuracy
 * @param provider Provider ID
 * @param estimatedTokens Estimated token count from tiktoken
 * @param actualTokens Actual token count from the provider API
 */
export function addCalibrationEntry(provider: string, estimatedTokens: number, actualTokens: number): void {
	// Add new calibration entry
	calibrationData.push({
		provider,
		estimatedTokens,
		actualTokens,
		timestamp: Date.now(),
	})

	// Keep only the most recent entries
	if (calibrationData.length > MAX_CALIBRATION_ENTRIES) {
		calibrationData.shift()
	}

	// Recalculate fudge factors based on new data
	recalculateFudgeFactors()
}

/**
 * Get the calibrated fudge factor for a provider
 * @param provider Provider ID
 * @returns Calibrated fudge factor or the default if not calibrated
 */
export function getCalibratedFudgeFactor(provider: string): number {
	return calibratedFudgeFactors[provider] || getFudgeFactorForProvider(provider)
}

/**
 * Recalculate fudge factors based on calibration data
 */
function recalculateFudgeFactors(): void {
	// Group by provider
	const groupedData = groupBy(calibrationData, (entry) => entry.provider)

	// Calculate new fudge factors for each provider
	for (const [provider, entries] of Object.entries(groupedData)) {
		// Only calculate if we have enough data
		if (entries.length >= 5) {
			// Calculate the average ratio of actual/estimated
			let totalRatio = 0
			for (const entry of entries) {
				if (entry.estimatedTokens > 0) {
					totalRatio += entry.actualTokens / entry.estimatedTokens
				}
			}
			const avgRatio = totalRatio / entries.length

			// Update the calibrated fudge factor
			if (avgRatio > 0.5 && avgRatio < 2.0) {
				// Cap the adjustment to reasonable values
				calibratedFudgeFactors[provider] = avgRatio
			}
		}
	}
}

/**
 * Group an array by a key function
 * @param array Array to group
 * @param keyFn Function to extract the key
 * @returns Record of key to array of items
 */
function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
	return array.reduce(
		(result, item) => {
			const key = keyFn(item)
			;(result[key] = result[key] || []).push(item)
			return result
		},
		{} as Record<string, T[]>,
	)
}
