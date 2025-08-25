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
	provider?: {
		order?: string[]
		only?: string[]
		allow_fallbacks?: boolean
	}
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

	/**
	 * Get the list of providers to use, supporting both new multi-provider and legacy single provider config
	 */
	private getProvidersToUse(): string[] {
		// New multi-provider configuration takes precedence
		if (this.options.openRouterProviders && this.options.openRouterProviders.length > 0) {
			return this.options.openRouterProviders.filter(
				(provider) => provider && provider !== OPENROUTER_DEFAULT_PROVIDER_NAME,
			)
		}

		// Fallback to legacy single provider configuration
		if (
			this.options.openRouterSpecificProvider &&
			this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME
		) {
			return [this.options.openRouterSpecificProvider]
		}

		// No specific providers configured - use OpenRouter's default routing
		return []
	}

	/**
	 * Check if an error should trigger failover to the next provider
	 */
	private shouldFailover(error: any): boolean {
		if (!error) return false

		// Rate limit errors (429)
		if (error.status === 429) return true

		// Service unavailable errors
		if (error.status === 503 || error.status === 502) return true

		// Context window errors (400 with specific messages)
		if (error.status === 400) {
			const message = error.message?.toLowerCase() || ""
			const contextErrorPatterns = [
				"context length",
				"context window",
				"maximum context",
				"tokens exceed",
				"too many tokens",
				"input tokens exceed",
			]
			return contextErrorPatterns.some((pattern) => message.includes(pattern))
		}

		// Timeout errors
		if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) return true

		return false
	}

	/**
	 * Create completion parameters for a specific provider attempt
	 */
	private createCompletionParams(
		modelId: string,
		maxTokens: number | undefined,
		temperature: number | undefined,
		topP: number | undefined,
		openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
		transforms: string[] | undefined,
		reasoning: OpenRouterReasoningParams | undefined,
		providers: string[],
		providerIndex: number,
	): OpenRouterChatCompletionParams {
		const params: OpenRouterChatCompletionParams = {
			model: modelId,
			...(maxTokens && maxTokens > 0 && { max_tokens: maxTokens }),
			temperature,
			top_p: topP,
			messages: openAiMessages,
			stream: true,
			stream_options: { include_usage: true },
			...(transforms && { transforms }),
			...(reasoning && { reasoning }),
		}

		// Configure provider routing based on available providers and attempt
		if (providers.length > 0) {
			if (providers.length === 1 || providerIndex >= providers.length - 1) {
				// Single provider or last provider - use strict routing
				params.provider = {
					order: [providers[Math.min(providerIndex, providers.length - 1)]],
					only: [providers[Math.min(providerIndex, providers.length - 1)]],
					allow_fallbacks: false,
				}
			} else {
				// Multiple providers available - allow fallbacks to remaining providers
				const remainingProviders = providers.slice(providerIndex)
				params.provider = {
					order: remainingProviders,
					only: remainingProviders,
					allow_fallbacks: true,
				}
			}
		}

		return params
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

		// Get providers to use for failover
		const providers = this.getProvidersToUse()
		const failoverEnabled = this.options.openRouterFailoverEnabled ?? true

		// If failover is disabled or only one provider, use legacy behavior
		if (!failoverEnabled || providers.length <= 1) {
			return yield* this.createMessageWithSingleProvider(
				modelId,
				maxTokens,
				temperature,
				topP,
				openAiMessages,
				transforms,
				reasoning,
				providers[0],
			)
		}

		// Multi-provider failover logic
		let lastError: any = null
		for (let providerIndex = 0; providerIndex < providers.length; providerIndex++) {
			try {
				const currentProvider = providers[providerIndex]
				console.log(
					`[OpenRouter] Attempting request with provider: ${currentProvider} (${providerIndex + 1}/${providers.length})`,
				)

				// Create completion parameters for this provider attempt
				const completionParams = this.createCompletionParams(
					modelId,
					maxTokens,
					temperature,
					topP,
					openAiMessages,
					transforms,
					reasoning,
					providers,
					providerIndex,
				)

				const stream = (await this.client.chat.completions.create(
					completionParams,
				)) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
				let lastUsage: CompletionUsage | undefined = undefined

				for await (const chunk of stream) {
					// OpenRouter returns an error object instead of the OpenAI SDK throwing an error.
					if ("error" in chunk) {
						const error = chunk.error as { message?: string; code?: number }
						console.error(
							`OpenRouter API Error with provider ${currentProvider}: ${error?.code} - ${error?.message}`,
						)
						throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
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

				// Success - no need to try additional providers
				console.log(`[OpenRouter] Request succeeded with provider: ${currentProvider}`)
				return
			} catch (error) {
				lastError = error
				const isLastProvider = providerIndex >= providers.length - 1

				if (this.shouldFailover(error) && !isLastProvider) {
					console.warn(
						`[OpenRouter] Provider ${providers[providerIndex]} failed with error: ${error.message}. Trying next provider...`,
					)
					continue // Try next provider
				} else {
					// Either not a failover-eligible error, or this was the last provider
					console.error(
						`[OpenRouter] ${isLastProvider ? "All providers failed" : "Non-failover error"} with provider ${providers[providerIndex]}: ${error.message}`,
					)
					throw error
				}
			}
		}

		// This should never be reached, but just in case
		throw lastError || new Error("All OpenRouter providers failed")
	}

	/**
	 * Legacy single provider implementation for backward compatibility
	 */
	private async *createMessageWithSingleProvider(
		modelId: string,
		maxTokens: number | undefined,
		temperature: number | undefined,
		topP: number | undefined,
		openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[],
		transforms: string[] | undefined,
		reasoning: OpenRouterReasoningParams | undefined,
		specificProvider?: string,
	): AsyncGenerator<ApiStreamChunk> {
		// https://openrouter.ai/docs/transforms
		const completionParams: OpenRouterChatCompletionParams = {
			model: modelId,
			...(maxTokens && maxTokens > 0 && { max_tokens: maxTokens }),
			temperature,
			top_p: topP,
			messages: openAiMessages,
			stream: true,
			stream_options: { include_usage: true },
			// Only include provider if specificProvider is provided and not "[default]".
			...(specificProvider && {
				provider: {
					order: [specificProvider],
					only: [specificProvider],
					allow_fallbacks: false,
				},
			}),
			...(transforms && { transforms }),
			...(reasoning && { reasoning }),
		}

		const stream = (await this.client.chat.completions.create(
			completionParams,
		)) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>

		let lastUsage: CompletionUsage | undefined = undefined

		for await (const chunk of stream) {
			// OpenRouter returns an error object instead of the OpenAI SDK throwing an error.
			if ("error" in chunk) {
				const error = chunk.error as { message?: string; code?: number }
				console.error(`OpenRouter API Error: ${error?.code} - ${error?.message}`)
				throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
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

		// Get providers to use for failover
		const providers = this.getProvidersToUse()
		const failoverEnabled = this.options.openRouterFailoverEnabled ?? true

		// If failover is disabled or only one provider, use legacy behavior
		if (!failoverEnabled || providers.length <= 1) {
			return this.completePromptWithSingleProvider(
				prompt,
				modelId,
				maxTokens,
				temperature,
				reasoning,
				providers[0],
			)
		}

		// Multi-provider failover logic for completePrompt
		let lastError: any = null
		for (let providerIndex = 0; providerIndex < providers.length; providerIndex++) {
			try {
				const currentProvider = providers[providerIndex]
				console.log(
					`[OpenRouter] Attempting completePrompt with provider: ${currentProvider} (${providerIndex + 1}/${providers.length})`,
				)

				const completionParams: OpenRouterChatCompletionParams = {
					model: modelId,
					max_tokens: maxTokens,
					temperature,
					messages: [{ role: "user", content: prompt }],
					stream: false,
					...(currentProvider && {
						provider: {
							order: [currentProvider],
							only: [currentProvider],
							allow_fallbacks: false,
						},
					}),
					...(reasoning && { reasoning }),
				}

				const response = await this.client.chat.completions.create(completionParams)

				if ("error" in response) {
					const error = response.error as { message?: string; code?: number }
					throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
				}

				const completion = response as OpenAI.Chat.ChatCompletion
				console.log(`[OpenRouter] completePrompt succeeded with provider: ${currentProvider}`)
				return completion.choices[0]?.message?.content || ""
			} catch (error) {
				lastError = error
				const isLastProvider = providerIndex >= providers.length - 1

				if (this.shouldFailover(error) && !isLastProvider) {
					console.warn(
						`[OpenRouter] Provider ${providers[providerIndex]} failed in completePrompt: ${error.message}. Trying next provider...`,
					)
					continue // Try next provider
				} else {
					// Either not a failover-eligible error, or this was the last provider
					console.error(
						`[OpenRouter] ${isLastProvider ? "All providers failed" : "Non-failover error"} in completePrompt with provider ${providers[providerIndex]}: ${error.message}`,
					)
					throw error
				}
			}
		}

		// This should never be reached, but just in case
		throw lastError || new Error("All OpenRouter providers failed in completePrompt")
	}

	/**
	 * Legacy completePrompt implementation for single provider
	 */
	private async completePromptWithSingleProvider(
		prompt: string,
		modelId: string,
		maxTokens: number | undefined,
		temperature: number | undefined,
		reasoning: OpenRouterReasoningParams | undefined,
		specificProvider?: string,
	): Promise<string> {
		const completionParams: OpenRouterChatCompletionParams = {
			model: modelId,
			max_tokens: maxTokens,
			temperature,
			messages: [{ role: "user", content: prompt }],
			stream: false,
			// Only include provider if specificProvider is provided and not "[default]".
			...(specificProvider && {
				provider: {
					order: [specificProvider],
					only: [specificProvider],
					allow_fallbacks: false,
				},
			}),
			...(reasoning && { reasoning }),
		}

		const response = await this.client.chat.completions.create(completionParams)

		if ("error" in response) {
			const error = response.error as { message?: string; code?: number }
			throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
		}

		const completion = response as OpenAI.Chat.ChatCompletion
		return completion.choices[0]?.message?.content || ""
	}
}
