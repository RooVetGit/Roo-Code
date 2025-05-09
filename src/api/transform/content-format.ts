import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

/**
 * Convert Anthropic content blocks to OpenAI format
 * @param content Array of Anthropic content blocks
 * @returns A formatted content string or array usable with OpenAI
 */
export function convertAnthropicContentToOpenAI(
	content: Anthropic.Messages.ContentBlockParam[],
): OpenAI.Chat.ChatCompletionContentPart[] | string {
	if (content.length === 0) {
		return ""
	}

	const result: OpenAI.Chat.ChatCompletionContentPart[] = []

	for (const block of content) {
		if (block.type === "text") {
			result.push({
				type: "text",
				text: block.text || "",
			})
		} else if (block.type === "image" && block.source) {
			// Handle base64 images
			if (typeof block.source === "object" && "data" in block.source) {
				result.push({
					type: "image_url",
					image_url: {
						url: `data:image/jpeg;base64,${block.source.data}`,
					},
				})
			}
			// Handle URL-based images
			else if (typeof block.source === "object" && "url" in block.source) {
				// Use type assertion to tell TypeScript that url exists
				const sourceWithUrl = block.source as { url: string }
				result.push({
					type: "image_url",
					image_url: {
						url: sourceWithUrl.url,
					},
				})
			}
		}
	}

	// If there's only one text block, just return the text string for simpler messages
	if (result.length === 1 && result[0].type === "text") {
		return result[0].text
	}

	return result
}
