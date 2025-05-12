import { Anthropic } from "@anthropic-ai/sdk"
import {
	ApiHandlerOptions,
	ModelInfo,
	ModelRecord,
	requestyDefaultModelId,
	requestyDefaultModelInfo,
} from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { calculateApiCostOpenAI } from "../../utils/cost"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { SingleCompletionHandler } from "../"
import { BaseProvider } from "./base-provider"
import { DEFAULT_HEADERS } from "./constants"
import { getModels } from "./fetchers/cache"
import OpenAI from "openai"

// Requesty usage includes an extra field for Anthropic use cases.
// Safely cast the prompt token details section to the appropriate structure.
interface RequestyUsage extends OpenAI.CompletionUsage {
	prompt_tokens_details?: {
		caching_tokens?: number
		cached_tokens?: number
	}
	total_cost?: number
}

type RequestyChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParams & {}

export class RequestyHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	protected models: ModelRecord = {}
	private client: OpenAI
	// Token usage cache for the last API call
	// Use base class property for token usage information

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const apiKey = this.options.requestyApiKey ?? "not-provided"
		const baseURL = "https://router.requesty.ai/v1"

		const defaultHeaders = DEFAULT_HEADERS

		this.client = new OpenAI({ baseURL, apiKey, defaultHeaders })
	}

	public async fetchModel() {
		this.models = await getModels("requesty")
		return this.getModel()
	}

	override getModel(): { id: string; info: ModelInfo } {
		const id = this.options.requestyModelId ?? requestyDefaultModelId
		const info = this.models[id] ?? requestyDefaultModelInfo
		return { id, info }
	}

	protected processUsageMetrics(usage: any, modelInfo?: ModelInfo): ApiStreamUsageChunk {
		const requestyUsage = usage as RequestyUsage
		const inputTokens = requestyUsage?.prompt_tokens || 0
		const outputTokens = requestyUsage?.completion_tokens || 0
		const cacheWriteTokens = requestyUsage?.prompt_tokens_details?.caching_tokens || 0
		const cacheReadTokens = requestyUsage?.prompt_tokens_details?.cached_tokens || 0
		const totalCost = modelInfo
			? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
			: 0

		return {
			type: "usage",
			inputTokens: inputTokens,
			outputTokens: outputTokens,
			cacheWriteTokens: cacheWriteTokens,
			cacheReadTokens: cacheReadTokens,
			totalCost: totalCost,
		}
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const model = await this.fetchModel()

		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		let maxTokens = undefined
		if (this.options.includeMaxTokens) {
			maxTokens = model.info.maxTokens
		}

		const temperature = this.options.modelTemperature

		const completionParams: RequestyChatCompletionParams = {
			model: model.id,
			max_tokens: maxTokens,
			messages: openAiMessages,
			temperature: temperature,
			stream: true,
			stream_options: { include_usage: true },
		}

		const stream = await this.client.chat.completions.create(completionParams)

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					text: (delta.reasoning_content as string | undefined) || "",
				}
			}

			if (chunk.usage) {
				yield this.processUsageMetrics(chunk.usage, model.info)
			}
		}
	}

	/**
	 * Requesty-specific token counting implementation
	 * @param content Content to count tokens for
	 * @returns Estimated token count from Requesty API
	 */
	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			// Get the current model
			const { id: modelId, info: modelInfo } = this.getModel()

			// Convert content blocks to a simple text message for token counting
			let textContent = ""

			// Extract text content from Anthropic content blocks
			for (const block of content) {
				if (block.type === "text") {
					textContent += block.text || ""
				} else if (block.type === "image") {
					// For images, add a placeholder text to account for some tokens
					textContent += "[IMAGE]"
				}
			}

			// Create a simple message with the text content
			const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "user", content: textContent }]

			// Request token count from Requesty API
			const response = await this.client.chat.completions.create({
				model: modelId,
				messages,
				stream: false,
				max_tokens: 0, // Don't generate any tokens, just count them
			})

			// Extract token count from response
			if (response.usage) {
				// Store token usage for future reference
				const requestyUsage = response.usage as RequestyUsage
				const inputTokens = requestyUsage.prompt_tokens || 0
				const cacheWriteTokens = requestyUsage.prompt_tokens_details?.caching_tokens || 0
				const cacheReadTokens = requestyUsage.prompt_tokens_details?.cached_tokens || 0
				const totalCost = modelInfo
					? calculateApiCostOpenAI(modelInfo, inputTokens, 0, cacheWriteTokens, cacheReadTokens)
					: 0

				this.lastTokenUsage = {
					inputTokens: inputTokens,
					outputTokens: 0, // No output since max_tokens is 0
					cacheWriteTokens: cacheWriteTokens,
					cacheReadTokens: cacheReadTokens,
					totalCost: totalCost,
					provider: "requesty",
					estimationMethod: "api",
				}

				return inputTokens
			}

			// Fallback to base implementation if the response doesn't include usage info
			console.warn("Requesty token counting didn't return usage info, using fallback")
			return super.countTokens(content)
		} catch (error) {
			console.warn("Requesty token counting failed, using fallback", error)
			return super.countTokens(content)
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const model = await this.fetchModel()

		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: prompt }]

		let maxTokens = undefined
		if (this.options.includeMaxTokens) {
			maxTokens = model.info.maxTokens
		}

		const temperature = this.options.modelTemperature

		const completionParams: RequestyChatCompletionParams = {
			model: model.id,
			max_tokens: maxTokens,
			messages: openAiMessages,
			temperature: temperature,
		}

		const response: OpenAI.Chat.ChatCompletion = await this.client.chat.completions.create(completionParams)
		return response.choices[0]?.message.content || ""
	}
}
