import { Anthropic } from "@anthropic-ai/sdk"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/streaming"
import { ApiHandler, SingleCompletionHandler } from "../"
import { ApiHandlerOptions, ModelInfo, vertexDefaultModelId, VertexModelId, vertexModels } from "../../shared/api"
import { ApiStream } from "../transform/stream"

// Types for Vertex SDK
interface VertexTextBlock {
	type: "text"
	text: string
	cache_control?: { type: "ephemeral" }
}

interface VertexUsage {
	input_tokens?: number
	output_tokens?: number
	cache_creation_input_tokens?: number
	cache_read_input_tokens?: number
}

interface VertexMessage extends Omit<Anthropic.Messages.MessageParam, "content"> {
	content: string | VertexTextBlock[]
}

interface VertexMessageCreateParams {
	model: string
	max_tokens: number
	temperature: number
	system: string | VertexTextBlock[]
	messages: VertexMessage[]
	stream: boolean
}

interface VertexMessageResponse {
	content: Array<{ type: "text"; text: string }>
}

interface VertexMessageStreamEvent {
	type: "message_start" | "message_delta" | "content_block_start" | "content_block_delta"
	message?: {
		usage: VertexUsage
	}
	usage?: {
		output_tokens: number
	}
	content_block?: {
		type: "text"
		text: string
	}
	index?: number
	delta?: {
		type: "text_delta"
		text: string
	}
}

// https://docs.anthropic.com/en/api/claude-on-vertex-ai
export class VertexHandler implements ApiHandler, SingleCompletionHandler {
	private options: ApiHandlerOptions
	private client: AnthropicVertex

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new AnthropicVertex({
			projectId: this.options.vertexProjectId ?? "not-provided",
			// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#regions
			region: this.options.vertexRegion ?? "us-east5",
		})
	}

	private formatMessageForCache(message: Anthropic.Messages.MessageParam, shouldCache: boolean): VertexMessage {
		if (!shouldCache) {
			return message as VertexMessage
		}

		return {
			...message,
			content:
				typeof message.content === "string"
					? [
							{
								type: "text" as const,
								text: message.content,
								cache_control: { type: "ephemeral" },
							},
						]
					: message.content.map((content, contentIndex) =>
							contentIndex === message.content.length - 1
								? {
										type: "text" as const,
										text: (content as { text: string }).text,
										cache_control: { type: "ephemeral" },
									}
								: {
										type: "text" as const,
										text: (content as { text: string }).text,
									},
						),
		}
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const model = this.getModel()
		const useCache = model.info.supportsPromptCache

		// Find user message indices for caching
		const userMsgIndices = useCache
			? messages.reduce((acc, msg, i) => (msg.role === "user" ? [...acc, i] : acc), [] as number[])
			: []
		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

		// Create the stream with appropriate caching configuration
		const params: VertexMessageCreateParams = {
			model: model.id,
			max_tokens: model.info.maxTokens || 8192,
			temperature: this.options.modelTemperature ?? 0,
			system: useCache
				? [
						{
							text: systemPrompt,
							type: "text" as const,
							cache_control: { type: "ephemeral" },
						},
					]
				: systemPrompt,
			messages: messages.map((message, index) => {
				const shouldCache = useCache && (index === lastUserMsgIndex || index === secondLastMsgUserIndex)
				return this.formatMessageForCache(message, shouldCache)
			}),
			stream: true,
		}

		const stream = (await this.client.messages.create(
			params,
		)) as unknown as AnthropicStream<VertexMessageStreamEvent>

		// Process the stream chunks
		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start": {
					const usage = chunk.message!.usage
					yield {
						type: "usage",
						inputTokens: usage.input_tokens || 0,
						outputTokens: usage.output_tokens || 0,
						cacheWriteTokens: usage.cache_creation_input_tokens,
						cacheReadTokens: usage.cache_read_input_tokens,
					}
					break
				}
				case "message_delta": {
					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage!.output_tokens || 0,
					}
					break
				}
				case "content_block_start": {
					switch (chunk.content_block!.type) {
						case "text": {
							if (chunk.index! > 0) {
								yield {
									type: "text",
									text: "\n",
								}
							}
							yield {
								type: "text",
								text: chunk.content_block!.text,
							}
							break
						}
					}
					break
				}
				case "content_block_delta": {
					switch (chunk.delta!.type) {
						case "text_delta": {
							yield {
								type: "text",
								text: chunk.delta!.text,
							}
							break
						}
					}
					break
				}
			}
		}
	}

	getModel(): { id: VertexModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in vertexModels) {
			const id = modelId as VertexModelId
			return { id, info: vertexModels[id] }
		}
		return { id: vertexDefaultModelId, info: vertexModels[vertexDefaultModelId] }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const model = this.getModel()
			const useCache = model.info.supportsPromptCache

			const params: Omit<VertexMessageCreateParams, "stream"> = {
				model: model.id,
				max_tokens: model.info.maxTokens || 8192,
				temperature: this.options.modelTemperature ?? 0,
				system: "", // No system prompt needed for single completions
				messages: [
					{
						role: "user",
						content: useCache
							? [
									{
										type: "text" as const,
										text: prompt,
										cache_control: { type: "ephemeral" },
									},
								]
							: prompt,
					},
				],
			}

			const response = (await this.client.messages.create({
				...params,
				stream: false,
			})) as unknown as VertexMessageResponse

			const content = response.content[0]
			if (content.type === "text") {
				return content.text
			}
			return ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Vertex completion error: ${error.message}`)
			}
			throw error
		}
	}
}
