import { Anthropic } from "@anthropic-ai/sdk"
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta"
import { ApiHandler, SingleCompletionHandler } from "../"
import { ApiHandlerOptions, ModelInfo, vertexDefaultModelId, VertexModelId, vertexModels } from "../../shared/api"
import { ApiStream } from "../transform/stream"

const THINKING_MODELS = ["claude-3-7-sonnet@20250219"]

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

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const modelId = this.getModel().id
		let maxTokens = this.getModel().info.maxTokens || 8192
		let temperature = this.options.modelTemperature ?? 0
		let thinking: BetaThinkingConfigParam | undefined = undefined

		if (THINKING_MODELS.includes(modelId)) {
			thinking = this.options.anthropicThinking
				? { type: "enabled", budget_tokens: this.options.anthropicThinking }
				: { type: "disabled" }

			// Only increase max_tokens if it's not already greater than thinking budget
			if (thinking.type === "enabled") {
				const minRequired = thinking.budget_tokens + 1024
				maxTokens = maxTokens < minRequired ? minRequired : maxTokens
			}

			temperature = 1.0
		}

		const stream = await this.client.messages.create({
			model: modelId,
			max_tokens: maxTokens,
			temperature: temperature,
			system: systemPrompt,
			thinking: thinking,
			messages,
			stream: true,
		})
		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start":
					const usage = chunk.message.usage
					yield {
						type: "usage",
						inputTokens: usage.input_tokens || 0,
						outputTokens: usage.output_tokens || 0,
					}
					break
				case "message_delta":
					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage.output_tokens || 0,
					}
					break

				case "content_block_start":
					switch (chunk.content_block.type) {
						case "thinking":
							// We may receive multiple thinking blocks, in which
							// case just insert a line break between them.
							if (chunk.index > 0) {
								yield { type: "reasoning", text: "\n" }
							}
							yield {
								type: "reasoning",
								text: chunk.content_block.thinking,
							}
							break
						case "text":
							if (chunk.index > 0) {
								yield {
									type: "text",
									text: "\n",
								}
							}
							yield {
								type: "text",
								text: chunk.content_block.text,
							}
							break
					}
					break
				case "content_block_delta":
					switch (chunk.delta.type) {
						case "thinking_delta":
							yield {
								type: "reasoning",
								text: chunk.delta.thinking,
							}
							break
						case "text_delta":
							yield {
								type: "text",
								text: chunk.delta.text,
							}
							break
					}
					break
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
			const modelId = this.getModel().id
			let maxTokens = this.getModel().info.maxTokens || 8192
			let temperature = this.options.modelTemperature ?? 0
			let thinking: BetaThinkingConfigParam | undefined = undefined

			if (THINKING_MODELS.includes(modelId)) {
				thinking = this.options.anthropicThinking
					? { type: "enabled", budget_tokens: this.options.anthropicThinking }
					: { type: "disabled" }

				// Only increase max_tokens if it's not already greater than thinking budget
				if (thinking.type === "enabled") {
					const minRequired = thinking.budget_tokens + 1024
					maxTokens = maxTokens < minRequired ? minRequired : maxTokens
				}

				temperature = 1.0
			}

			const response = await this.client.messages.create({
				model: modelId,
				max_tokens: maxTokens,
				temperature,
				thinking,
				messages: [{ role: "user", content: prompt }],
				stream: false,
			})

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
