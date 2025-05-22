import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { convertToR1Format } from "../transform/r1-format"
// Removed unused imports: ApiHandler, nebiusModels, ModelInfo, NebiusModelId

import { SingleCompletionHandler } from "../index"
import { RouterProvider } from "./router-provider"

import { ApiHandlerOptions, nebiusDefaultModelId, nebiusDefaultModelInfo } from "../../shared/api"

export class NebiusHandler extends RouterProvider implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		super({
			options,
			name: "nebius",
			baseURL: "https://api.studio.nebius.ai/v1",
			apiKey: options.nebiusApiKey || "dummy-key",
			modelId: options.nebiusModelId,
			defaultModelId: nebiusDefaultModelId,
			defaultModelInfo: nebiusDefaultModelInfo,
		})
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const model = this.getModel()

		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = model.id.includes("DeepSeek-R1")
			? convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
			: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)]

		const stream = await this.client.chat.completions.create({
			model: model.id,
			messages: openAiMessages,
			temperature: 0,
			stream: true,
			stream_options: { include_usage: true },
		})
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
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			}

			if (this.supportsTemperature(modelId)) {
				requestOptions.temperature = this.options.modelTemperature ?? 0
			}

			requestOptions.max_tokens = info.maxTokens

			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`nebius completion error: ${error.message}`)
			}
			throw error
		}
	}
}
