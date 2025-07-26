import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
	OPEN_ROUTER_PROMPT_CACHING_MODELS,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
} from "@roo-code/types"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStreamChunk } from "../transform/stream"
import { convertToR1Format } from "../transform/r1-format"
import { addCacheBreakpoints as addAnthropicCacheBreakpoints } from "../transform/caching/anthropic"
import { addCacheBreakpoints as addGeminiCacheBreakpoints } from "../transform/caching/gemini"
import type { OpenRouterReasoningParams } from "../transform/reasoning"
import { getModelParams } from "../transform/model-params"

import { getModels } from "./fetchers/modelCache"
import { getModelEndpoints } from "./fetchers/modelEndpointCache"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler } from "../index"

// Add custom interface for OpenRouter params.
type OpenRouterChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParams & {
	transforms?: string[]
	include_reasoning?: boolean
	// https://openrouter.ai/docs/use-cases/reasoning-tokens
	reasoning?: OpenRouterReasoningParams
}

// See `OpenAI.Chat.Completions.ChatCompletionChunk["usage"]`
// `CompletionsAPI.CompletionUsage`
// See also: https://openrouter.ai/docs/use-cases/usage-accounting
interface CompletionUsage {
	completion_tokens?: number
	completion_tokens_details?: {
		reasoning_tokens?: number
	}
	prompt_tokens?: number
	prompt_tokens_details?: {
		cached_tokens?: number
	}
	total_tokens?: number
	cost?: number
	cost_details?: {
		upstream_inference_cost?: number
	}
}

export class OpenRouterHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	protected models: ModelRecord = {}
	protected endpoints: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
		const apiKey = this.options.openRouterApiKey ?? "not-provided"

		this.client = new OpenAI({ baseURL, apiKey, defaultHeaders: DEFAULT_HEADERS })
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): AsyncGenerator<ApiStreamChunk> {
		const model = await this.fetchModel()

		let { id: modelId, maxTokens, temperature, topP, reasoning } = model

		// OpenRouter sends reasoning tokens by default for Gemini 2.5 Pro
		// Preview even if you don't request them. This is not the default for
		// other providers (including Gemini), so we need to explicitly disable
		// i We should generalize this using the logic in `getModelParams`, but
		// this is easier for now.
		if (
			(modelId === "google/gemini-2.5-pro-preview" || modelId === "google/gemini-2.5-pro") &&
			typeof reasoning === "undefined"
		) {
			reasoning = { exclude: true }
		}

		// Convert Anthropic messages to OpenAI format.
		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// DeepSeek highly recommends using user instead of system role.
		if (modelId.startsWith("deepseek/deepseek-r1") || modelId === "perplexity/sonar-reasoning") {
			openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
		}

		// https://openrouter.ai/docs/features/prompt-caching
		// TODO: Add a `promptCacheStratey` field to `ModelInfo`.
		if (OPEN_ROUTER_PROMPT_CACHING_MODELS.has(modelId)) {
			if (modelId.startsWith("google")) {
				addGeminiCacheBreakpoints(systemPrompt, openAiMessages)
			} else {
				addAnthropicCacheBreakpoints(systemPrompt, openAiMessages)
			}
		}

		const transforms = (this.options.openRouterUseMiddleOutTransform ?? true) ? ["middle-out"] : undefined

		// https://openrouter.ai/docs/transforms
		const completionParams: OpenRouterChatCompletionParams = {
			model: modelId,
			...(maxTokens && maxTokens > 0 && { max_tokens: maxTokens }),
			temperature,
			top_p: topP,
			messages: openAiMessages,
			stream: true,
			stream_options: { include_usage: true },
			// Only include provider if openRouterSpecificProvider is not "[default]".
			...(this.options.openRouterSpecificProvider &&
				this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME && {
					provider: {
						order: [this.options.openRouterSpecificProvider],
						only: [this.options.openRouterSpecificProvider],
						allow_fallbacks: false,
					},
				}),
			...(transforms && { transforms }),
			...(reasoning && { reasoning }),
		}

		const stream = await this.client.chat.completions.create(completionParams)

		let lastUsage: CompletionUsage | undefined = undefined
		let lastChunkTime = Date.now()
		const CHUNK_TIMEOUT_MS = 30000 // 30 seconds timeout between chunks

		// Set up a timeout check
		const timeoutCheck = setInterval(() => {
			const timeSinceLastChunk = Date.now() - lastChunkTime
			if (timeSinceLastChunk > CHUNK_TIMEOUT_MS) {
				clearInterval(timeoutCheck)
				console.error(`OpenRouter stream timeout: No chunks received for ${CHUNK_TIMEOUT_MS}ms`, {
					modelId,
					timeSinceLastChunk,
				})
			}
		}, 5000) // Check every 5 seconds

		try {
			for await (const chunk of stream) {
				lastChunkTime = Date.now() // Reset timeout on each chunk
				// OpenRouter returns an error object instead of the OpenAI SDK throwing an error.
				if ("error" in chunk) {
					const error = chunk.error as { message?: string; code?: number; type?: string }
					const errorMessage = error?.message || "Unknown error"
					const errorCode = error?.code || "unknown"
					const errorType = error?.type || "unknown"

					// Log detailed error information
					console.error(`OpenRouter API Error:`, {
						code: errorCode,
						type: errorType,
						message: errorMessage,
						modelId,
						chunk: JSON.stringify(chunk),
					})

					// Provide more specific error messages for common issues
					let userFriendlyMessage = `OpenRouter API Error ${errorCode}: ${errorMessage}`

					if (
						errorMessage.toLowerCase().includes("model not found") ||
						errorMessage.toLowerCase().includes("invalid model") ||
						errorCode === 404
					) {
						userFriendlyMessage = `Model "${modelId}" is not available on OpenRouter. Please check if the model ID is correct and if you have access to this model.`
					} else if (errorMessage.toLowerCase().includes("rate limit")) {
						userFriendlyMessage = `OpenRouter rate limit exceeded. Please wait a moment and try again.`
					} else if (errorMessage.toLowerCase().includes("unauthorized") || errorCode === 401) {
						userFriendlyMessage = `OpenRouter authentication failed. Please check your API key.`
					}

					throw new Error(userFriendlyMessage)
				}

				const delta = chunk.choices[0]?.delta

				if ("reasoning" in delta && delta.reasoning && typeof delta.reasoning === "string") {
					yield { type: "reasoning", text: delta.reasoning }
				}

				if (delta?.content) {
					yield { type: "text", text: delta.content }
				}

				if (chunk.usage) {
					lastUsage = chunk.usage
				}
			}

			if (lastUsage) {
				yield {
					type: "usage",
					inputTokens: lastUsage.prompt_tokens || 0,
					outputTokens: lastUsage.completion_tokens || 0,
					cacheReadTokens: lastUsage.prompt_tokens_details?.cached_tokens,
					reasoningTokens: lastUsage.completion_tokens_details?.reasoning_tokens,
					totalCost: (lastUsage.cost_details?.upstream_inference_cost || 0) + (lastUsage.cost || 0),
				}
			}
		} finally {
			clearInterval(timeoutCheck)
		}
	}

	public async fetchModel() {
		const [models, endpoints] = await Promise.all([
			getModels({ provider: "openrouter" }),
			getModelEndpoints({
				router: "openrouter",
				modelId: this.options.openRouterModelId,
				endpoint: this.options.openRouterSpecificProvider,
			}),
		])

		this.models = models
		this.endpoints = endpoints

		return this.getModel()
	}

	override getModel() {
		const id = this.options.openRouterModelId ?? openRouterDefaultModelId
		let info = this.models[id] ?? openRouterDefaultModelInfo

		// If a specific provider is requested, use the endpoint for that provider.
		if (this.options.openRouterSpecificProvider && this.endpoints[this.options.openRouterSpecificProvider]) {
			info = this.endpoints[this.options.openRouterSpecificProvider]
		}

		const isDeepSeekR1 = id.startsWith("deepseek/deepseek-r1") || id === "perplexity/sonar-reasoning"

		const params = getModelParams({
			format: "openrouter",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0,
		})

		return { id, info, topP: isDeepSeekR1 ? 0.95 : undefined, ...params }
	}

	async completePrompt(prompt: string) {
		let { id: modelId, maxTokens, temperature, reasoning } = await this.fetchModel()

		const completionParams: OpenRouterChatCompletionParams = {
			model: modelId,
			max_tokens: maxTokens,
			temperature,
			messages: [{ role: "user", content: prompt }],
			stream: false,
			// Only include provider if openRouterSpecificProvider is not "[default]".
			...(this.options.openRouterSpecificProvider &&
				this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME && {
					provider: {
						order: [this.options.openRouterSpecificProvider],
						only: [this.options.openRouterSpecificProvider],
						allow_fallbacks: false,
					},
				}),
			...(reasoning && { reasoning }),
		}

		const response = await this.client.chat.completions.create(completionParams)

		if ("error" in response) {
			const error = response.error as { message?: string; code?: number; type?: string }
			const errorMessage = error?.message || "Unknown error"
			const errorCode = error?.code || "unknown"
			const errorType = error?.type || "unknown"

			// Log detailed error information
			console.error(`OpenRouter API Error:`, {
				code: errorCode,
				type: errorType,
				message: errorMessage,
				modelId,
				response: JSON.stringify(response),
			})

			// Provide more specific error messages for common issues
			let userFriendlyMessage = `OpenRouter API Error ${errorCode}: ${errorMessage}`

			if (
				errorMessage.toLowerCase().includes("model not found") ||
				errorMessage.toLowerCase().includes("invalid model") ||
				errorCode === 404
			) {
				userFriendlyMessage = `Model "${modelId}" is not available on OpenRouter. Please check if the model ID is correct and if you have access to this model.`
			} else if (errorMessage.toLowerCase().includes("rate limit")) {
				userFriendlyMessage = `OpenRouter rate limit exceeded. Please wait a moment and try again.`
			} else if (errorMessage.toLowerCase().includes("unauthorized") || errorCode === 401) {
				userFriendlyMessage = `OpenRouter authentication failed. Please check your API key.`
			}

			throw new Error(userFriendlyMessage)
		}

		const completion = response as OpenAI.Chat.ChatCompletion
		return completion.choices[0]?.message?.content || ""
	}
}
