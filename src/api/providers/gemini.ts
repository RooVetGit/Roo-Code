import type { Anthropic } from "@anthropic-ai/sdk"
import {
	GoogleGenAI,
	type GenerateContentResponseUsageMetadata,
	type GenerateContentParameters,
	type GenerateContentConfig,
	type GroundingMetadata,
} from "@google/genai"
import type { JWTInput } from "google-auth-library"
import delay from "delay"

import { type ModelInfo, type GeminiModelId, geminiDefaultModelId, geminiModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { safeJsonParse } from "../../shared/safeJsonParse"

import { convertAnthropicContentToGemini, convertAnthropicMessageToGemini } from "../transform/gemini-format"
import { t } from "i18next"
import type { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"

type GeminiHandlerOptions = ApiHandlerOptions & {
	isVertex?: boolean
}

// Constants for retry logic
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 30000 // 30 seconds
const RETRY_DELAY_MULTIPLIER = 2

// Error classification
enum GeminiErrorType {
	RateLimit = "RATE_LIMIT",
	ServerError = "SERVER_ERROR",
	NetworkError = "NETWORK_ERROR",
	InvalidRequest = "INVALID_REQUEST",
	AuthError = "AUTH_ERROR",
	Unknown = "UNKNOWN",
}

export class GeminiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions

	private client: GoogleGenAI

	constructor({ isVertex, ...options }: GeminiHandlerOptions) {
		super()

		this.options = options

		const project = this.options.vertexProjectId ?? "not-provided"
		const location = this.options.vertexRegion ?? "not-provided"
		const apiKey = this.options.geminiApiKey ?? "not-provided"

		this.client = this.options.vertexJsonCredentials
			? new GoogleGenAI({
					vertexai: true,
					project,
					location,
					googleAuthOptions: {
						credentials: safeJsonParse<JWTInput>(this.options.vertexJsonCredentials, undefined),
					},
				})
			: this.options.vertexKeyFile
				? new GoogleGenAI({
						vertexai: true,
						project,
						location,
						googleAuthOptions: { keyFile: this.options.vertexKeyFile },
					})
				: isVertex
					? new GoogleGenAI({ vertexai: true, project, location })
					: new GoogleGenAI({ apiKey })
	}

	private classifyError(error: any): GeminiErrorType {
		if (!error) return GeminiErrorType.Unknown

		const errorMessage = error.message?.toLowerCase() || ""
		const statusCode = error.status || error.statusCode

		// Check for rate limiting (429 status or rate limit messages)
		if (statusCode === 429 || errorMessage.includes("rate limit") || errorMessage.includes("quota")) {
			return GeminiErrorType.RateLimit
		}

		// Check for server errors (5xx status codes)
		if (statusCode >= 500 && statusCode < 600) {
			return GeminiErrorType.ServerError
		}

		// Check for authentication errors
		if (
			statusCode === 401 ||
			statusCode === 403 ||
			errorMessage.includes("auth") ||
			errorMessage.includes("permission")
		) {
			return GeminiErrorType.AuthError
		}

		// Check for invalid request errors
		if (statusCode === 400 || errorMessage.includes("invalid") || errorMessage.includes("bad request")) {
			return GeminiErrorType.InvalidRequest
		}

		// Check for network errors
		if (
			errorMessage.includes("network") ||
			errorMessage.includes("timeout") ||
			errorMessage.includes("connection")
		) {
			return GeminiErrorType.NetworkError
		}

		return GeminiErrorType.Unknown
	}

	private shouldRetry(errorType: GeminiErrorType, attempt: number): boolean {
		if (attempt >= MAX_RETRIES) return false

		// Retry on rate limits, server errors, and network errors
		return [GeminiErrorType.RateLimit, GeminiErrorType.ServerError, GeminiErrorType.NetworkError].includes(
			errorType,
		)
	}

	private calculateRetryDelay(attempt: number, error: any): number {
		// Check if error has specific retry delay (for rate limiting)
		const geminiRetryDetails = error.errorDetails?.find(
			(detail: any) => detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
		)
		if (geminiRetryDetails?.retryDelay) {
			const match = geminiRetryDetails.retryDelay.match(/^(\d+)s$/)
			if (match) {
				return Number(match[1]) * 1000 // Convert seconds to milliseconds
			}
		}

		// Use exponential backoff
		const baseDelay = INITIAL_RETRY_DELAY * Math.pow(RETRY_DELAY_MULTIPLIER, attempt)
		return Math.min(baseDelay, MAX_RETRY_DELAY)
	}

	private async retryWithBackoff<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
		let lastError: any

		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			try {
				const result = await operation()

				// Check for blank/empty responses
				if (operationName === "generateContent" && !result) {
					throw new Error("Received blank response from Gemini API")
				}

				return result
			} catch (error) {
				lastError = error
				const errorType = this.classifyError(error)

				console.warn(`[GeminiHandler] ${operationName} attempt ${attempt + 1} failed:`, {
					errorType,
					message: error.message,
					status: error.status || error.statusCode,
				})

				if (!this.shouldRetry(errorType, attempt)) {
					break
				}

				const retryDelay = this.calculateRetryDelay(attempt, error)
				console.log(`[GeminiHandler] Retrying ${operationName} in ${retryDelay}ms...`)
				await delay(retryDelay)
			}
		}

		// Enhance error message based on error type
		const errorType = this.classifyError(lastError)
		let enhancedMessage = lastError.message || "Unknown error"

		switch (errorType) {
			case GeminiErrorType.RateLimit:
				enhancedMessage = `Gemini API rate limit exceeded. Please try again later. ${enhancedMessage}`
				break
			case GeminiErrorType.ServerError:
				enhancedMessage = `Gemini API server error (500). The service may be temporarily unavailable. ${enhancedMessage}`
				break
			case GeminiErrorType.NetworkError:
				enhancedMessage = `Network error connecting to Gemini API. Please check your connection. ${enhancedMessage}`
				break
			case GeminiErrorType.AuthError:
				enhancedMessage = `Gemini API authentication failed. Please check your API key. ${enhancedMessage}`
				break
		}

		throw new Error(enhancedMessage)
	}

	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: model, info, reasoning: thinkingConfig, maxTokens } = this.getModel()

		const contents = messages.map(convertAnthropicMessageToGemini)

		const tools: GenerateContentConfig["tools"] = []
		if (this.options.enableUrlContext) {
			tools.push({ urlContext: {} })
		}

		if (this.options.enableGrounding) {
			tools.push({ googleSearch: {} })
		}

		const config: GenerateContentConfig = {
			systemInstruction,
			httpOptions: this.options.googleGeminiBaseUrl ? { baseUrl: this.options.googleGeminiBaseUrl } : undefined,
			thinkingConfig,
			maxOutputTokens: this.options.modelMaxTokens ?? maxTokens ?? undefined,
			temperature: this.options.modelTemperature ?? 0,
			...(tools.length > 0 ? { tools } : {}),
		}

		const params: GenerateContentParameters = { model, contents, config }

		try {
			const result = await this.retryWithBackoff(
				() => this.client.models.generateContentStream(params),
				"generateContentStream",
			)

			let lastUsageMetadata: GenerateContentResponseUsageMetadata | undefined
			let pendingGroundingMetadata: GroundingMetadata | undefined
			let hasContent = false

			for await (const chunk of result) {
				// Process candidates and their parts to separate thoughts from content
				if (chunk.candidates && chunk.candidates.length > 0) {
					const candidate = chunk.candidates[0]

					if (candidate.groundingMetadata) {
						pendingGroundingMetadata = candidate.groundingMetadata
					}

					if (candidate.content && candidate.content.parts) {
						for (const part of candidate.content.parts) {
							if (part.thought) {
								// This is a thinking/reasoning part
								if (part.text) {
									hasContent = true
									yield { type: "reasoning", text: part.text }
								}
							} else {
								// This is regular content
								if (part.text) {
									hasContent = true
									yield { type: "text", text: part.text }
								}
							}
						}
					}
				}

				// Fallback to the original text property if no candidates structure
				else if (chunk.text) {
					hasContent = true
					yield { type: "text", text: chunk.text }
				}

				if (chunk.usageMetadata) {
					lastUsageMetadata = chunk.usageMetadata
				}
			}

			// Check for blank response
			if (!hasContent) {
				console.warn("[GeminiHandler] Received blank response from API, retrying...")
				throw new Error("Received blank response from Gemini API")
			}

			if (pendingGroundingMetadata) {
				const citations = this.extractCitationsOnly(pendingGroundingMetadata)
				if (citations) {
					yield { type: "text", text: `\n\n${t("common:errors.gemini.sources")} ${citations}` }
				}
			}

			if (lastUsageMetadata) {
				const inputTokens = lastUsageMetadata.promptTokenCount ?? 0
				const outputTokens = lastUsageMetadata.candidatesTokenCount ?? 0
				const cacheReadTokens = lastUsageMetadata.cachedContentTokenCount
				const reasoningTokens = lastUsageMetadata.thoughtsTokenCount

				yield {
					type: "usage",
					inputTokens,
					outputTokens,
					cacheReadTokens,
					reasoningTokens,
					totalCost: this.calculateCost({ info, inputTokens, outputTokens, cacheReadTokens }),
				}
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(t("common:errors.gemini.generate_stream", { error: error.message }))
			}

			throw error
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in geminiModels ? (modelId as GeminiModelId) : geminiDefaultModelId
		let info: ModelInfo = geminiModels[id]
		const params = getModelParams({ format: "gemini", modelId: id, model: info, settings: this.options })

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Gemini's API does not have this
		// suffix.
		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}

	private extractCitationsOnly(groundingMetadata?: GroundingMetadata): string | null {
		const chunks = groundingMetadata?.groundingChunks

		if (!chunks) {
			return null
		}

		const citationLinks = chunks
			.map((chunk, i) => {
				const uri = chunk.web?.uri
				if (uri) {
					return `[${i + 1}](${uri})`
				}
				return null
			})
			.filter((link): link is string => link !== null)

		if (citationLinks.length > 0) {
			return citationLinks.join(", ")
		}

		return null
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const { id: model } = this.getModel()

			const tools: GenerateContentConfig["tools"] = []
			if (this.options.enableUrlContext) {
				tools.push({ urlContext: {} })
			}
			if (this.options.enableGrounding) {
				tools.push({ googleSearch: {} })
			}
			const promptConfig: GenerateContentConfig = {
				httpOptions: this.options.googleGeminiBaseUrl
					? { baseUrl: this.options.googleGeminiBaseUrl }
					: undefined,
				temperature: this.options.modelTemperature ?? 0,
				...(tools.length > 0 ? { tools } : {}),
			}

			const result = await this.retryWithBackoff(
				() =>
					this.client.models.generateContent({
						model,
						contents: [{ role: "user", parts: [{ text: prompt }] }],
						config: promptConfig,
					}),
				"generateContent",
			)

			let text = result.text ?? ""

			// Check for blank response
			if (!text || text.trim().length === 0) {
				console.warn("[GeminiHandler] Received blank response from completePrompt")
				throw new Error("Received blank response from Gemini API")
			}

			const candidate = result.candidates?.[0]
			if (candidate?.groundingMetadata) {
				const citations = this.extractCitationsOnly(candidate.groundingMetadata)
				if (citations) {
					text += `\n\n${t("common:errors.gemini.sources")} ${citations}`
				}
			}

			return text
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(t("common:errors.gemini.generate_complete_prompt", { error: error.message }))
			}

			throw error
		}
	}

	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			const { id: model } = this.getModel()

			const response = await this.client.models.countTokens({
				model,
				contents: convertAnthropicContentToGemini(content),
			})

			if (response.totalTokens === undefined) {
				console.warn("Gemini token counting returned undefined, using fallback")
				return super.countTokens(content)
			}

			return response.totalTokens
		} catch (error) {
			console.warn("Gemini token counting failed, using fallback", error)
			return super.countTokens(content)
		}
	}

	public calculateCost({
		info,
		inputTokens,
		outputTokens,
		cacheReadTokens = 0,
	}: {
		info: ModelInfo
		inputTokens: number
		outputTokens: number
		cacheReadTokens?: number
	}) {
		if (!info.inputPrice || !info.outputPrice || !info.cacheReadsPrice) {
			return undefined
		}

		let inputPrice = info.inputPrice
		let outputPrice = info.outputPrice
		let cacheReadsPrice = info.cacheReadsPrice

		// If there's tiered pricing then adjust the input and output token prices
		// based on the input tokens used.
		if (info.tiers) {
			const tier = info.tiers.find((tier) => inputTokens <= tier.contextWindow)

			if (tier) {
				inputPrice = tier.inputPrice ?? inputPrice
				outputPrice = tier.outputPrice ?? outputPrice
				cacheReadsPrice = tier.cacheReadsPrice ?? cacheReadsPrice
			}
		}

		// Subtract the cached input tokens from the total input tokens.
		const uncachedInputTokens = inputTokens - cacheReadTokens

		let cacheReadCost = cacheReadTokens > 0 ? cacheReadsPrice * (cacheReadTokens / 1_000_000) : 0

		const inputTokensCost = inputPrice * (uncachedInputTokens / 1_000_000)
		const outputTokensCost = outputPrice * (outputTokens / 1_000_000)
		const totalCost = inputTokensCost + outputTokensCost + cacheReadCost

		const trace: Record<string, { price: number; tokens: number; cost: number }> = {
			input: { price: inputPrice, tokens: uncachedInputTokens, cost: inputTokensCost },
			output: { price: outputPrice, tokens: outputTokens, cost: outputTokensCost },
		}

		if (cacheReadTokens > 0) {
			trace.cacheRead = { price: cacheReadsPrice, tokens: cacheReadTokens, cost: cacheReadCost }
		}

		// console.log(`[GeminiHandler] calculateCost -> ${totalCost}`, trace)

		return totalCost
	}
}
