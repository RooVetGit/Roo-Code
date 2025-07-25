import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"

import { type ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { RouterProvider } from "./router-provider"

// Default model info for fallback
const huggingFaceDefaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 131072,
	supportsImages: false,
	supportsPromptCache: false,
}

export class HuggingFaceHandler extends RouterProvider implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			options,
			name: "huggingface",
			baseURL: "https://router.huggingface.co/v1",
			apiKey: options.huggingFaceApiKey,
			modelId: options.huggingFaceModelId,
			defaultModelId: "meta-llama/Llama-3.3-70B-Instruct",
			defaultModelInfo: huggingFaceDefaultModelInfo,
		})

		if (!this.options.huggingFaceApiKey) {
			throw new Error("Hugging Face API key is required")
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info } = await this.fetchModel()
		const temperature = this.options.modelTemperature ?? 0.7

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
		}

		// Add max_tokens if the model info specifies it
		if (info.maxTokens && info.maxTokens > 0) {
			params.max_tokens = info.maxTokens
		}

		const stream = await this.client.chat.completions.create(params)

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
				}
			}
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info } = await this.fetchModel()

		try {
			const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			}

			// Add max_tokens if the model info specifies it
			if (info.maxTokens && info.maxTokens > 0) {
				params.max_tokens = info.maxTokens
			}

			const response = await this.client.chat.completions.create(params)

			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Hugging Face completion error: ${error.message}`)
			}

			throw error
		}
	}
}
