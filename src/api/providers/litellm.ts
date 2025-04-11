/**
 * LiteLLM provider implementation for Roo Code
 * Ported and adapted from Cline's LiteLLM provider implementation
 * Original PR: https://github.com/cline-app/cline/pull/1618
 * Original author: @him0
 */
import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import axios from "axios" // Using axios for the cost calculation request

import {
	ApiHandlerOptions,
	liteLlmDefaultModelId,
	liteLlmModelInfoSaneDefaults,
	ModelInfo,
} from "../../shared/api"
import { ApiHandler } from ".."
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/litellm-format" // Use the copied transformer
import { BaseProvider } from "./base-provider"

export class LiteLLMHandler extends BaseProvider implements ApiHandler {
	private options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		// Default to localhost:4000 if no URL is provided, as per Cline's implementation
		const baseURL = this.options.litellmApiUrl || "http://localhost:4000"
		// Use a placeholder API key if none is provided, as per Cline's implementation
		const apiKey = this.options.litellmApiKey || "noop"

		this.client = new OpenAI({
			baseURL,
			apiKey,
			// Add default headers similar to other providers if necessary, e.g.,
			// defaultHeaders: { ... }
		})
	}

	/**
	 * Calculates the cost based on token usage by querying the LiteLLM /spend/calculate endpoint.
	 * @param prompt_tokens Number of input tokens.
	 * @param completion_tokens Number of output tokens.
	 * @returns The calculated cost as a number, or undefined if calculation fails.
	 */
	private async calculateCost(prompt_tokens: number, completion_tokens: number): Promise<number | undefined> {
		const modelId = this.options.litellmModelId || liteLlmDefaultModelId
		const apiKey = this.options.litellmApiKey || "noop"
		const baseURL = this.options.litellmApiUrl || "http://localhost:4000"
		const calculateUrl = `${baseURL}/spend/calculate`

		try {
			const response = await axios.post<{ cost: number }>(
				calculateUrl,
				{
					completion_response: {
						model: modelId,
						usage: {
							prompt_tokens,
							completion_tokens,
						},
					},
				},
				{
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${apiKey}`,
					},
				},
			)

			if (response.status === 200 && typeof response.data?.cost === "number") {
				return response.data.cost
			} else {
				console.error("Error calculating LiteLLM spend:", response.status, response.statusText, response.data)
				return undefined
			}
		} catch (error) {
			console.error("Error calculating LiteLLM spend:", error)
			return undefined
		}
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const modelId = this.options.litellmModelId || liteLlmDefaultModelId
		const modelInfo = this.getModel().info

		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
			role: "system",
			content: systemPrompt,
		}
		const formattedMessages = convertToOpenAiMessages(messages)

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			messages: [systemMessage, ...formattedMessages],
			temperature: this.options.modelTemperature ?? 0, // Use configured temp or default
			stream: true as const,
			stream_options: { include_usage: true },
		}

		if (this.options.includeMaxTokens) {
			requestOptions.max_tokens = modelInfo.maxTokens
		}

		const stream = await this.client.chat.completions.create(requestOptions)

		// Pre-calculate cost per million tokens for efficiency in the loop
		const inputCostPerMillion = (await this.calculateCost(1_000_000, 0)) ?? 0
		const outputCostPerMillion = (await this.calculateCost(0, 1_000_000)) ?? 0

		let lastUsage: OpenAI.Completions.CompletionUsage | undefined

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta ?? {}

			if (delta.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			// Note: LiteLLM might not support the 'reasoning' field like some Anthropic models.
			// If specific LiteLLM features need handling, add logic here.

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			const totalCost =
				(inputCostPerMillion * (lastUsage.prompt_tokens ?? 0)) / 1_000_000 +
				(outputCostPerMillion * (lastUsage.completion_tokens ?? 0)) / 1_000_000

			const usageChunk: ApiStreamUsageChunk = {
				type: "usage",
				inputTokens: lastUsage.prompt_tokens ?? 0,
				outputTokens: lastUsage.completion_tokens ?? 0,
				totalCost: totalCost > 0 ? totalCost : undefined, // Only include cost if calculable
			}
			yield usageChunk
		}
	}

	override getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.litellmModelId || liteLlmDefaultModelId,
			// Use custom model info if provided, otherwise use sane defaults
			info: this.options.litellmModelInfo ?? liteLlmModelInfoSaneDefaults,
		}
	}

	// countTokens will use the default implementation from BaseProvider (tiktoken)
}
