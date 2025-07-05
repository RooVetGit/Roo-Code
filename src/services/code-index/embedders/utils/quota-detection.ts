/**
 * Utility functions for detecting quota-related errors from OpenAI API
 */

/**
 * Detects if an error is due to insufficient quota/credits
 * @param error The error object to check
 * @returns True if the error indicates insufficient quota
 */
export function isInsufficientQuotaError(error: any): boolean {
	if (error?.status !== 429) return false

	const errorMessage =
		error?.message?.toLowerCase() ||
		error?.response?.data?.error?.message?.toLowerCase() ||
		error?.error?.message?.toLowerCase() ||
		""

	const quotaKeywords = [
		"insufficient_quota",
		"insufficient quota",
		"quota exceeded",
		"insufficient funds",
		"billing",
		"payment required",
		"credits",
	]

	return quotaKeywords.some((keyword) => errorMessage.includes(keyword))
}
