import { TokenUsageInfo } from "../shared/api"

/**
 * Formats token count information for display
 * @param tokenInfo Token usage information
 * @param provider Provider ID
 * @returns Formatted token information string
 */
export function formatTokenInfo(tokenInfo: TokenUsageInfo, provider: string): string {
	const parts = [
		`Input: ${numberWithCommas(tokenInfo.inputTokens)} tokens`,
		`Output: ${numberWithCommas(tokenInfo.outputTokens)} tokens`,
	]

	// Add provider-specific token information
	if (provider.toLowerCase() === "openrouter") {
		if (tokenInfo.reasoningTokens && tokenInfo.reasoningTokens > 0) {
			parts.push(`Reasoning: ${numberWithCommas(tokenInfo.reasoningTokens)} tokens`)
		}
		if (tokenInfo.cachedTokens && tokenInfo.cachedTokens > 0) {
			parts.push(`Cached: ${numberWithCommas(tokenInfo.cachedTokens)} tokens`)
		}
	} else if (provider.toLowerCase() === "requesty") {
		if (tokenInfo.cacheWriteTokens && tokenInfo.cacheWriteTokens > 0) {
			parts.push(`Cache Write: ${numberWithCommas(tokenInfo.cacheWriteTokens)} tokens`)
		}
		if (tokenInfo.cacheReadTokens && tokenInfo.cacheReadTokens > 0) {
			parts.push(`Cache Read: ${numberWithCommas(tokenInfo.cacheReadTokens)} tokens`)
		}
	}

	parts.push(`Cost: $${tokenInfo.totalCost.toFixed(6)}`)

	// Add estimation method indicator
	if (tokenInfo.estimationMethod === "api") {
		parts.push("(API Counted)")
	} else if (tokenInfo.estimationMethod === "estimated") {
		parts.push("(Estimated)")
	}

	return parts.join(" | ")
}

/**
 * Creates a detailed tooltip for token usage information
 * @param tokenInfo Token usage information
 * @param provider Provider ID
 * @returns Multi-line tooltip text
 */
export function createTokenTooltip(tokenInfo: TokenUsageInfo, provider: string): string {
	const tooltip = [
		`Provider: ${formatProviderName(provider)}`,
		`Input Tokens: ${numberWithCommas(tokenInfo.inputTokens)}`,
		`Output Tokens: ${numberWithCommas(tokenInfo.outputTokens)}`,
	]

	// Add provider-specific information to tooltip
	if (provider.toLowerCase() === "openrouter") {
		if (tokenInfo.reasoningTokens && tokenInfo.reasoningTokens > 0) {
			tooltip.push(`Reasoning Tokens: ${numberWithCommas(tokenInfo.reasoningTokens)}`)
		}
		if (tokenInfo.cachedTokens && tokenInfo.cachedTokens > 0) {
			tooltip.push(`Cached Tokens: ${numberWithCommas(tokenInfo.cachedTokens)}`)
		}
	} else if (provider.toLowerCase() === "requesty") {
		if (tokenInfo.cacheWriteTokens && tokenInfo.cacheWriteTokens > 0) {
			tooltip.push(`Cache Write Tokens: ${numberWithCommas(tokenInfo.cacheWriteTokens)}`)
		}
		if (tokenInfo.cacheReadTokens && tokenInfo.cacheReadTokens > 0) {
			tooltip.push(`Cache Read Tokens: ${numberWithCommas(tokenInfo.cacheReadTokens)}`)
		}
	}

	tooltip.push(`Total Cost: $${tokenInfo.totalCost.toFixed(6)}`)
	tooltip.push(`Estimation Method: ${tokenInfo.estimationMethod === "api" ? "API Counted" : "Estimated"}`)

	return tooltip.join("\n")
}

/**
 * Format provider names for display
 * @param provider Provider ID
 * @returns Formatted provider name
 */
export function formatProviderName(provider: string): string {
	switch (provider.toLowerCase()) {
		case "openai":
			return "OpenAI"
		case "anthropic":
			return "Anthropic"
		case "google":
		case "gemini":
			return "Google AI"
		case "openrouter":
			return "OpenRouter"
		case "requesty":
			return "Requesty"
		case "vscode-lm":
			return "VS Code LM"
		default:
			return provider.charAt(0).toUpperCase() + provider.slice(1)
	}
}

/**
 * Formats a number with commas for better readability
 * @param x Number to format
 * @returns Formatted number string
 */
export function numberWithCommas(x: number): string {
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
