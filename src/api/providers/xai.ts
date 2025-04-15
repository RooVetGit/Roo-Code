import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { ApiHandlerOptions, XAIModelId, ModelInfo, xaiDefaultModelId, xaiModels } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { SingleCompletionHandler } from ".."
import { ChatCompletionReasoningEffort } from "openai/resources/chat/completions.mjs"
import { defaultHeaders } from "./openai"

export class XAIHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.client = new OpenAI({
			baseURL: "https://api.x.ai/v1",
			apiKey: this.options.xaiApiKey ?? "not-provided",
			defaultHeaders: defaultHeaders,
		})
	}

	override getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in xaiModels) {
			const id = modelId as XAIModelId
			return { id, info: xaiModels[id] }
		}
		return {
			id: xaiDefaultModelId,
			info: xaiModels[xaiDefaultModelId],
		}
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const modelId = this.getModel().id
		const modelInfo = this.getModel().info

		// Special handling for Grok-3-mini models which support reasoning_effort
		let reasoningEffort: ChatCompletionReasoningEffort | undefined
		if (modelId.includes("3-mini") && this.options.reasoningEffort) {
			if (["low", "high"].includes(this.options.reasoningEffort)) {
				reasoningEffort = this.options.reasoningEffort as ChatCompletionReasoningEffort
			}
		}

		// Use the OpenAI-compatible API
		const stream = await this.client.chat.completions.create({
			model: modelId,
			max_tokens: modelInfo.maxTokens,
			temperature: 0,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
			...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
		})

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if ("reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: (delta.reasoning_content as string | undefined) || "",
				}
			}

			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
					// X.AI might include these fields in the future, handle them if present
					cacheReadTokens:
						"cache_read_input_tokens" in chunk.usage ? (chunk.usage as any).cache_read_input_tokens : 0,
					cacheWriteTokens:
						"cache_creation_input_tokens" in chunk.usage
							? (chunk.usage as any).cache_creation_input_tokens
							: 0,
				}
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const response = await this.client.chat.completions.create({
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
			})
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`xAI completion error: ${error.message}`)
			}
			throw error
		}
	}
}
