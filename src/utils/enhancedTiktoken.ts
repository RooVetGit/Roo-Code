import { Anthropic } from "@anthropic-ai/sdk"
import { getEncoderForProvider, getFudgeFactorForProvider, countImageTokens } from "./tiktoken"

/**
 * Get provider-specific overhead tokens for message formatting
 * @param provider The provider name
 * @returns Number of overhead tokens added by the provider
 */
export function getProviderOverheadTokens(provider: string): number {
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
 * Enhanced token counting that accounts for provider-specific overhead
 * @param content The content array to count tokens for
 * @param provider The provider name
 * @returns The estimated token count with provider-specific adjustments
 */
export async function enhancedTiktoken(
	content: Anthropic.Messages.ContentBlockParam[],
	provider: string = "default",
): Promise<number> {
	if (content.length === 0) {
		return 0
	}

	let totalTokens = 0

	// Get provider-specific encoder and fudge factor
	const encoder = getEncoderForProvider(provider)
	const fudgeFactor = getFudgeFactorForProvider(provider)

	// Process each content block using the provider-specific encoder
	for (const block of content) {
		if (block.type === "text") {
			const text = block.text || ""

			if (text.length > 0) {
				const tokens = encoder.encode(text)
				totalTokens += tokens.length
			}
		} else if (block.type === "image") {
			// For images, use the provider-specific calculation
			totalTokens += countImageTokens(block.source, provider)
		}
	}

	// Add provider-specific overhead tokens
	totalTokens += getProviderOverheadTokens(provider)

	// Apply the provider-specific fudge factor
	return Math.ceil(totalTokens * fudgeFactor)
}
