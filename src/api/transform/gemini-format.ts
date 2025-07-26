import { Anthropic } from "@anthropic-ai/sdk"
import { Content, Part } from "@google/genai"

/**
 * Extended content block type to support video content that isn't in the standard Anthropic SDK.
 * This interface extends the standard Anthropic content blocks to include video support for Gemini models.
 *
 * @interface VideoContentBlock
 * @property {string} type - Must be "video" to identify this as a video content block
 * @property {Object} source - The video source information
 * @property {string} source.type - Must be "base64" for base64-encoded video data
 * @property {string} source.data - The base64-encoded video data
 * @property {string} source.media_type - The MIME type of the video (e.g., "video/mp4", "video/webm")
 */
interface VideoContentBlock {
	type: "video"
	source: {
		type: "base64"
		data: string
		media_type: string
	}
}

/**
 * Extended content block parameter type that includes both standard Anthropic content blocks
 * and our custom video content block for Gemini model support.
 */
type ExtendedContentBlockParam = Anthropic.ContentBlockParam | VideoContentBlock

export function convertAnthropicContentToGemini(content: string | ExtendedContentBlockParam[]): Part[] {
	if (typeof content === "string") {
		return [{ text: content }]
	}

	const parts = content.flatMap((block): Part | Part[] => {
		switch (block.type) {
			case "text":
				return { text: block.text }
			case "image":
				if (block.source.type !== "base64") {
					throw new Error("Unsupported image source type")
				}

				return { inlineData: { data: block.source.data, mimeType: block.source.media_type } }
			case "video": {
				if (block.source.type !== "base64") {
					throw new Error("Unsupported video source type. Only base64 encoded videos are supported.")
				}

				// Validate video MIME type
				const supportedVideoTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"]
				if (!supportedVideoTypes.includes(block.source.media_type)) {
					throw new Error(
						`Unsupported video format: ${block.source.media_type}. Supported formats: ${supportedVideoTypes.join(", ")}`,
					)
				}

				// Check if video data exists
				if (!block.source.data || block.source.data.trim() === "") {
					throw new Error("Video data is empty or missing")
				}

				// Validate base64 format
				try {
					// Basic validation - check if it's valid base64
					const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
					if (!base64Regex.test(block.source.data.replace(/\s/g, ""))) {
						throw new Error("Invalid base64 format for video data")
					}
				} catch (e) {
					throw new Error(
						`Failed to validate video data: ${e instanceof Error ? e.message : "Unknown error"}`,
					)
				}

				return { inlineData: { data: block.source.data, mimeType: block.source.media_type } }
			}
			case "tool_use":
				return {
					functionCall: {
						name: block.name,
						args: block.input as Record<string, unknown>,
					},
				}
			case "tool_result": {
				if (!block.content) {
					return []
				}

				// Extract tool name from tool_use_id (e.g., "calculator-123" -> "calculator")
				const toolName = block.tool_use_id.split("-")[0]

				if (typeof block.content === "string") {
					return {
						functionResponse: { name: toolName, response: { name: toolName, content: block.content } },
					}
				}

				if (!Array.isArray(block.content)) {
					return []
				}

				const textParts: string[] = []
				const imageParts: Part[] = []

				for (const item of block.content) {
					if (item.type === "text") {
						textParts.push(item.text)
					} else if (item.type === "image" && item.source.type === "base64") {
						const { data, media_type } = item.source
						imageParts.push({ inlineData: { data, mimeType: media_type } })
					}
				}

				// Create content text with a note about images if present
				const contentText =
					textParts.join("\n\n") + (imageParts.length > 0 ? "\n\n(See next part for image)" : "")

				// Return function response followed by any images
				return [
					{ functionResponse: { name: toolName, response: { name: toolName, content: contentText } } },
					...imageParts,
				]
			}
			default:
				// Currently unsupported: "thinking" | "redacted_thinking" | "document"
				throw new Error(`Unsupported content block type: ${block.type}`)
		}
	})

	// Sort parts to ensure inlineData comes before text
	return parts.sort((a, b) => {
		if ("inlineData" in a && "text" in b) {
			return -1
		}
		if ("text" in a && "inlineData" in b) {
			return 1
		}
		return 0
	})
}

export function convertAnthropicMessageToGemini(message: Anthropic.Messages.MessageParam): Content {
	return {
		role: message.role === "assistant" ? "model" : "user",
		parts: convertAnthropicContentToGemini(message.content),
	}
}
