import { Anthropic } from "@anthropic-ai/sdk"
import { Tiktoken } from "tiktoken/lite"
import o200kBase from "tiktoken/encoders/o200k_base"
import cl100kBase from "tiktoken/encoders/cl100k_base"

// Cache for encoders
const encoderCache: Record<string, Tiktoken> = {}

/**
 * Get the appropriate encoder for a given provider
 * @param provider The provider name
 * @returns The appropriate Tiktoken encoder for the provider
 */
export function getEncoderForProvider(provider: string): Tiktoken {
	// If we already have this encoder cached, return it
	if (encoderCache[provider]) {
		return encoderCache[provider]
	}

	// Select appropriate encoder based on provider
	let encoderSource: any
	switch (provider.toLowerCase()) {
		case "openai":
			encoderSource = cl100kBase // Using cl100k_base for OpenAI models including GPT-4/3.5
			break
		case "anthropic":
			encoderSource = cl100kBase
			break
		case "google":
		case "gemini":
			encoderSource = o200kBase
			break
		case "openrouter":
			encoderSource = cl100kBase // OpenRouter mostly uses OpenAI-compatible models
			break
		case "requesty":
			encoderSource = cl100kBase // Requesty is OpenAI-compatible
			break
		default:
			encoderSource = o200kBase // Default fallback
	}

	// Create and cache the encoder
	encoderCache[provider] = new Tiktoken(encoderSource.bpe_ranks, encoderSource.special_tokens, encoderSource.pat_str)

	return encoderCache[provider]
}

/**
 * Get the appropriate fudge factor for a given provider
 * @param provider The provider name
 * @returns The appropriate fudge factor for the provider
 */
export function getFudgeFactorForProvider(provider: string): number {
	// Return appropriate fudge factor based on provider
	switch (provider.toLowerCase()) {
		case "openai":
			return 1.12 // Slightly increased for cl100k_base instead of gpt-4o
		case "anthropic":
			return 1.2 // Anthropic tends to need a bit more padding
		case "google":
		case "gemini":
			return 1.3 // Google/Gemini needs more padding
		case "openrouter":
			return 1.15 // Adjusted for cl100k_base instead of gpt-4o
		case "requesty":
			return 1.15 // Adjusted for cl100k_base instead of gpt-4o
		default:
			return 1.3 // Conservative default
	}
}

/**
 * Count tokens for images based on their source and the provider
 * @param imageSource The image source
 * @param provider The provider name
 * @returns The estimated token count for the image
 */
export function countImageTokens(imageSource: any, provider: string): number {
	if (!imageSource || typeof imageSource !== "object") {
		return 300 // Conservative default
	}

	if ("data" in imageSource) {
		const base64Data = imageSource.data as string
		const imageSizeBytes = Math.floor((base64Data.length * 3) / 4)

		// Provide different token counts based on provider and image size
		switch (provider.toLowerCase()) {
			case "openai":
				// OpenAI counts ~85 tokens per 512x512 image
				return Math.ceil(imageSizeBytes / 5000)
			case "anthropic":
				// Anthropic uses different calculations based on dimensions
				return Math.ceil(imageSizeBytes / 4500)
			case "google":
			case "gemini":
				// Gemini seems to use a more token-heavy approach
				return Math.ceil(imageSizeBytes / 6000)
			default:
				// Conservative default based on square root formula
				return Math.ceil(Math.sqrt(base64Data.length))
		}
	} else if ("url" in imageSource) {
		// For URL-based images, use conservative estimates based on provider
		switch (provider.toLowerCase()) {
			case "openai":
				return 500 // OpenAI URL-based images
			case "anthropic":
				return 550 // Anthropic URL-based images
			case "google":
			case "gemini":
				return 550 // Gemini URL-based images
			default:
				return 600 // Conservative default
		}
	} else {
		return 600 // Conservative default for unknown image sources
	}
}

/**
 * Count tokens for a content array using provider-specific encoders and fudge factors
 * @param content The content array to count tokens for
 * @param provider The provider name
 * @returns The estimated token count
 */
export async function tiktoken(
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

	// Add the provider-specific fudge factor
	return Math.ceil(totalTokens * fudgeFactor)
}
