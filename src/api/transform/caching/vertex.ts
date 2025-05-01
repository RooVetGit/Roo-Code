import { Anthropic } from "@anthropic-ai/sdk"

interface VertexTextBlock {
	type: "text"
	text: string
	cache_control?: { type: "ephemeral" }
}

interface VertexImageBlock {
	type: "image"
	source: {
		type: "base64"
		media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
		data: string
	}
}

type VertexContentBlock = VertexTextBlock | VertexImageBlock

interface VertexMessage extends Omit<Anthropic.Messages.MessageParam, "content"> {
	content: string | VertexContentBlock[]
}

export function addCacheBreakpoints(messages: Anthropic.Messages.MessageParam[]) {
	// Find indices of user messages that we want to cache.
	// We only cache the last two user messages to stay within the 4-block limit
	// (1 block for system + 1 block each for last two user messages = 3 total).
	const indices = messages.reduce((acc, msg, i) => (msg.role === "user" ? [...acc, i] : acc), [] as number[])

	// Only cache the last two user messages.
	const lastIndex = indices[indices.length - 1] ?? -1
	const secondLastIndex = indices[indices.length - 2] ?? -1

	return messages.map((message, index) =>
		addCacheBreakpoint(message, index === lastIndex || index === secondLastIndex),
	)
}

function addCacheBreakpoint(message: Anthropic.Messages.MessageParam, shouldCache: boolean): VertexMessage {
	// Assistant messages are kept as-is since they can't be cached
	if (message.role === "assistant") {
		return message as VertexMessage
	}

	// For string content, we convert to array format with optional cache control
	if (typeof message.content === "string") {
		return {
			...message,
			content: [
				{
					type: "text" as const,
					text: message.content,
					// For string content, we only have one block so it's always the last
					...(shouldCache && { cache_control: { type: "ephemeral" } }),
				},
			],
		}
	}

	// For array content, find the last text block index once before mapping
	const lastTextBlockIndex = message.content.reduce(
		(lastIndex, content, index) => (content.type === "text" ? index : lastIndex),
		-1,
	)

	// Then use this pre-calculated index in the map function.
	return {
		...message,
		content: message.content.map((content, contentIndex) => {
			// Images and other non-text content are passed through unchanged.
			if (content.type === "image") {
				return content as VertexImageBlock
			}

			// Check if this is the last text block using our pre-calculated index.
			const isLastTextBlock = contentIndex === lastTextBlockIndex

			return {
				type: "text" as const,
				text: (content as { text: string }).text,
				...(shouldCache && isLastTextBlock && { cache_control: { type: "ephemeral" } }),
			}
		}),
	}
}
