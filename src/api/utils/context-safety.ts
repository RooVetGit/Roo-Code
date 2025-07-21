import { TOKEN_BUFFER_PERCENTAGE } from "../../core/sliding-window"

type SafetyNetOptions = {
	projectedTokens: number
	contextWindow: number
	effectiveThreshold?: number
	allowedTokens: number
}

/**
 * Calculates the allowed token limit for a given context window, reserving
 * space for the response and a safety buffer.
 *
 * @param contextWindow The total context window size of the model.
 * @param maxTokens The maximum number of tokens reserved for the response.
 * @returns The number of tokens allowed for the prompt context.
 */
export function getAllowedTokens(contextWindow: number, maxTokens?: number | null) {
	// Calculate the maximum tokens reserved for response
	const reservedTokens = maxTokens ?? contextWindow * 0.2

	// Calculate available tokens for conversation history
	// Truncate if we're within TOKEN_BUFFER_PERCENTAGE of the context window
	return contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens
}

/**
 * Determines if the token counting safety net should be triggered.
 *
 * The safety net is triggered if the projected token count exceeds either:
 * 1. The effective condensation threshold (as a percentage of the context window).
 * 2. The absolute allowed token limit.
 *
 * @param options The options for the safety net check.
 * @returns True if the safety net should be triggered, false otherwise.
 */
export function isSafetyNetTriggered({
	projectedTokens,
	contextWindow,
	effectiveThreshold,
	allowedTokens,
}: SafetyNetOptions): boolean {
	// Ensure a valid threshold, defaulting to a high value if not provided,
	// which effectively relies on the allowedTokens check.
	const threshold = effectiveThreshold ?? 100
	const contextPercent = (100 * projectedTokens) / contextWindow

	return contextPercent >= threshold || projectedTokens > allowedTokens
}
