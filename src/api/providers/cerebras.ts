import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandlerOptions, ModelInfo, cerebrasModels } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import Cerebras from "@cerebras/cerebras_cloud_sdk"

interface CerebrasHandlerOptions extends ApiHandlerOptions {
	cerebrasBaseUrl?: string
	cerebrasApiKey?: string
}

export class CerebrasHandler extends BaseProvider {
	private options: CerebrasHandlerOptions
	private baseUrl: string
	private modelId: string
	private client: Cerebras

	constructor(options: CerebrasHandlerOptions) {
		super()
		this.options = options
		this.baseUrl = options.cerebrasBaseUrl ?? "https://api.cerebras.ai/v1"
		this.modelId = options.apiModelId ?? "llama-4-scout-17b-16e-instruct"
		this.client = new Cerebras({ apiKey: this.options.cerebrasApiKey })
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const openAiMessages = [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)]

		try {
			const stream = await this.client.chat.completions.create({
				model: this.modelId,
				messages: openAiMessages as any,
				temperature: this.options.modelTemperature ?? 0,
				top_p: 1.0,
				max_tokens: -1,
				stream: true,
				seed: 0,
			})

			for await (const chunk of stream) {
				if (chunk && Array.isArray(chunk.choices) && chunk.choices.length > 0) {
					const choice = chunk.choices[0]
					const content = choice?.delta?.content
					if (content) {
						yield {
							type: "text",
							text: content,
						}
					}
				}
			}
		} catch (error: any) {
			let errorMessage = "Cerebras SDK error"
			if (error.message) {
				errorMessage += `: ${error.message}`
			}
			throw new Error(errorMessage)
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		if (!(this.modelId in cerebrasModels)) {
			throw new Error(`Invalid Cerebras model ID: ${this.modelId}`)
		}
		return {
			id: this.modelId,
			info: cerebrasModels[this.modelId as keyof typeof cerebrasModels],
		}
	}
}
