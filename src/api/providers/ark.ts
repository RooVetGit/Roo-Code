import OpenAI from "openai"
import { Anthropic } from "@anthropic-ai/sdk"
import { ApiConfiguration, ApiHandlerOptions, ModelInfo, openAiModelInfoSaneDefaults } from "../../shared/api"
import { ApiHandler, SingleCompletionHandler } from "../index"
import { convertToSimpleMessages } from "../transform/simple-format"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"

export interface ArkHandlerOptions extends ApiHandlerOptions {
	defaultHeaders?: Record<string, string>
}

export class ArkHandler implements ApiHandler, SingleCompletionHandler {
	protected options: ArkHandlerOptions
	private client: OpenAI

	constructor(options: ArkHandlerOptions) {
		this.options = options
		this.client = new OpenAI({
			apiKey: this.options.apiKey,
			baseURL: this.options.openAiBaseUrl,
			defaultHeaders: this.options.defaultHeaders,
		})
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const modelInfo = this.getModel().info
		const modelId = this.options.apiModelId ?? ""

		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
			role: "system",
			content: systemPrompt,
		}

		const convertedMessages = [systemMessage, ...convertToSimpleMessages(messages)]

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature: this.options.modelTemperature ?? 0,
			messages: convertedMessages,
			stream: true as const,
		}

		if (this.options.includeMaxTokens) {
			requestOptions.max_tokens = modelInfo.maxTokens
		}

		const stream = await this.client.chat.completions.create(requestOptions)

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta ?? {}

			if (delta.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (chunk.usage) {
				yield this.processUsageMetrics(chunk.usage)
			}
		}
	}

	protected processUsageMetrics(usage: any): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.apiModelId ?? "",
			info: this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
			}

			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Ark completion error: ${error.message}`)
			}
			throw error
		}
	}

	ark = true
}

export const createArkHandler = (options: ArkHandlerOptions) => {
	return new ArkHandler(options)
}
