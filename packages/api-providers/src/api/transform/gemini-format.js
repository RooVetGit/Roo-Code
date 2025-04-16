function convertAnthropicContentToGemini(content) {
	if (typeof content === "string") {
		return [{ text: content }]
	}
	return content.flatMap((block) => {
		switch (block.type) {
			case "text":
				return { text: block.text }
			case "image":
				if (block.source.type !== "base64") {
					throw new Error("Unsupported image source type")
				}
				return {
					inlineData: {
						data: block.source.data,
						mimeType: block.source.media_type,
					},
				}
			case "tool_use":
				return {
					functionCall: {
						name: block.name,
						args: block.input,
					},
				}
			case "tool_result":
				const name = block.tool_use_id.split("-")[0]
				if (!block.content) {
					return []
				}
				if (typeof block.content === "string") {
					return {
						functionResponse: {
							name,
							response: {
								name,
								content: block.content,
							},
						},
					}
				} else {
					// The only case when tool_result could be array is when the tool failed and we're providing ie user feedback potentially with images
					const textParts = block.content.filter((part) => part.type === "text")
					const imageParts = block.content.filter((part) => part.type === "image")
					const text = textParts.length > 0 ? textParts.map((part) => part.text).join("\n\n") : ""
					const imageText = imageParts.length > 0 ? "\n\n(See next part for image)" : ""
					return [
						{
							functionResponse: {
								name,
								response: {
									name,
									content: text + imageText,
								},
							},
						},
						...imageParts.map((part) => ({
							inlineData: {
								data: part.source.data,
								mimeType: part.source.media_type,
							},
						})),
					]
				}
			default:
				throw new Error(`Unsupported content block type: ${block.type}`)
		}
	})
}
export function convertAnthropicMessageToGemini(message) {
	return {
		role: message.role === "assistant" ? "model" : "user",
		parts: convertAnthropicContentToGemini(message.content),
	}
}
//# sourceMappingURL=gemini-format.js.map
