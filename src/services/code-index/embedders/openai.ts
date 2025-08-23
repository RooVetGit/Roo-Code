import { OpenAI } from "openai"
import { OpenAiNativeHandler } from "../../../api/providers/openai-native"
import { ApiHandlerOptions } from "../../../shared/api"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces"
import {
	MAX_BATCH_TOKENS,
	MAX_ITEM_TOKENS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
} from "../constants"
import { getModelQueryPrefix } from "../../../shared/embeddingModels"
import { t } from "../../../i18n"
import { withValidationErrorHandling, formatEmbeddingError, HttpError } from "../shared/validation-helpers"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { Mutex } from "async-mutex"

/**
 * Rate limit headers returned by OpenAI API
 */
interface RateLimitHeaders {
	limitRequests?: number
	limitTokens?: number
	remainingRequests?: number
	remainingTokens?: number
	resetRequests?: string
	resetTokens?: string
}

/**
 * OpenAI implementation of the embedder interface with batching and rate limiting
 */
export class OpenAiEmbedder extends OpenAiNativeHandler implements IEmbedder {
	private embeddingsClient: OpenAI
	private readonly defaultModelId: string

	// Global rate limiting state shared across all instances
	private static globalRateLimitState = {
		isRateLimited: false,
		rateLimitResetTime: 0,
		rateLimitHeaders: {} as RateLimitHeaders,
		// Mutex to ensure thread-safe access to rate limit state
		mutex: new Mutex(),
	}

	/**
	 * Creates a new OpenAI embedder
	 * @param options API handler options
	 */
	constructor(options: ApiHandlerOptions & { openAiEmbeddingModelId?: string }) {
		super(options)
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		this.embeddingsClient = new OpenAI({ apiKey })
		this.defaultModelId = options.openAiEmbeddingModelId || "text-embedding-3-small"
	}

	/**
	 * Creates embeddings for the given texts with batching and rate limiting
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.defaultModelId

		// Apply model-specific query prefix if required
		const queryPrefix = getModelQueryPrefix("openai", modelToUse)
		const processedTexts = queryPrefix
			? texts.map((text, index) => {
					// Prevent double-prefixing
					if (text.startsWith(queryPrefix)) {
						return text
					}
					const prefixedText = `${queryPrefix}${text}`
					const estimatedTokens = Math.ceil(prefixedText.length / 4)
					if (estimatedTokens > MAX_ITEM_TOKENS) {
						console.warn(
							t("embeddings:textWithPrefixExceedsTokenLimit", {
								index,
								estimatedTokens,
								maxTokens: MAX_ITEM_TOKENS,
							}),
						)
						// Return original text if adding prefix would exceed limit
						return text
					}
					return prefixedText
				})
			: texts

		const allEmbeddings: number[][] = []
		const usage = { promptTokens: 0, totalTokens: 0 }
		const remainingTexts = [...processedTexts]

		while (remainingTexts.length > 0) {
			const currentBatch: string[] = []
			let currentBatchTokens = 0
			const processedIndices: number[] = []

			for (let i = 0; i < remainingTexts.length; i++) {
				const text = remainingTexts[i]
				const itemTokens = Math.ceil(text.length / 4)

				if (itemTokens > MAX_ITEM_TOKENS) {
					console.warn(
						t("embeddings:textExceedsTokenLimit", {
							index: i,
							itemTokens,
							maxTokens: MAX_ITEM_TOKENS,
						}),
					)
					processedIndices.push(i)
					continue
				}

				if (currentBatchTokens + itemTokens <= MAX_BATCH_TOKENS) {
					currentBatch.push(text)
					currentBatchTokens += itemTokens
					processedIndices.push(i)
				} else {
					break
				}
			}

			// Remove processed items from remainingTexts (in reverse order to maintain correct indices)
			for (let i = processedIndices.length - 1; i >= 0; i--) {
				remainingTexts.splice(processedIndices[i], 1)
			}

			if (currentBatch.length > 0) {
				const batchResult = await this._embedBatchWithRetries(currentBatch, modelToUse)
				allEmbeddings.push(...batchResult.embeddings)
				usage.promptTokens += batchResult.usage.promptTokens
				usage.totalTokens += batchResult.usage.totalTokens
			}
		}

		return { embeddings: allEmbeddings, usage }
	}

	/**
	 * Extracts rate limit headers from the response
	 * @param headers Response headers
	 * @returns Parsed rate limit headers
	 */
	private extractRateLimitHeaders(headers: Headers): RateLimitHeaders {
		return {
			limitRequests: headers.get("x-ratelimit-limit-requests")
				? parseInt(headers.get("x-ratelimit-limit-requests")!)
				: undefined,
			limitTokens: headers.get("x-ratelimit-limit-tokens")
				? parseInt(headers.get("x-ratelimit-limit-tokens")!)
				: undefined,
			remainingRequests: headers.get("x-ratelimit-remaining-requests")
				? parseInt(headers.get("x-ratelimit-remaining-requests")!)
				: undefined,
			remainingTokens: headers.get("x-ratelimit-remaining-tokens")
				? parseInt(headers.get("x-ratelimit-remaining-tokens")!)
				: undefined,
			resetRequests: headers.get("x-ratelimit-reset-requests") || undefined,
			resetTokens: headers.get("x-ratelimit-reset-tokens") || undefined,
		}
	}

	/**
	 * Calculates the optimal delay based on rate limit headers
	 * @param headers Rate limit headers
	 * @param attempt Current attempt number
	 * @returns Delay in milliseconds
	 */
	private calculateSmartBackoff(headers: RateLimitHeaders, attempt: number): number {
		// If we have reset times, use them to calculate optimal delay
		if (headers.resetRequests || headers.resetTokens) {
			const delays: number[] = []

			// Parse reset times (format: "1s", "6m0s", etc.)
			if (headers.resetRequests) {
				const requestResetMs = this.parseResetTime(headers.resetRequests)
				if (requestResetMs > 0) delays.push(requestResetMs)
			}

			if (headers.resetTokens) {
				const tokenResetMs = this.parseResetTime(headers.resetTokens)
				if (tokenResetMs > 0) delays.push(tokenResetMs)
			}

			// Use the maximum delay to ensure both limits are respected
			if (delays.length > 0) {
				const maxDelay = Math.max(...delays)
				// Add a small buffer (10%) to account for clock differences
				return Math.ceil(maxDelay * 1.1)
			}
		}

		// Fall back to exponential backoff if no headers available
		return INITIAL_DELAY_MS * Math.pow(2, attempt)
	}

	/**
	 * Parses reset time string to milliseconds
	 * @param resetTime Reset time string (e.g., "1s", "6m0s")
	 * @returns Time in milliseconds
	 */
	private parseResetTime(resetTime: string): number {
		let totalMs = 0

		// Match patterns like "6m", "30s", "6m0s"
		const matches = resetTime.matchAll(/(\d+)([hms])/g)

		for (const match of matches) {
			const value = parseInt(match[1])
			const unit = match[2]

			switch (unit) {
				case "h":
					totalMs += value * 60 * 60 * 1000
					break
				case "m":
					totalMs += value * 60 * 1000
					break
				case "s":
					totalMs += value * 1000
					break
			}
		}

		return totalMs
	}

	/**
	 * Helper method to handle batch embedding with retries and exponential backoff
	 * @param batchTexts Array of texts to embed in this batch
	 * @param model Model identifier to use
	 * @returns Promise resolving to embeddings and usage statistics
	 */
	private async _embedBatchWithRetries(
		batchTexts: string[],
		model: string,
	): Promise<{ embeddings: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
		let lastRateLimitHeaders: RateLimitHeaders = {}
		let attempts = 0

		while (true) {
			// Check global rate limit before attempting request
			await this.waitForGlobalRateLimit()

			try {
				// Use withResponse() to get both data and response headers
				const { data: response, response: httpResponse } = await this.embeddingsClient.embeddings
					.create({
						input: batchTexts,
						model: model,
					})
					.withResponse()

				return {
					embeddings: response.data.map((item) => item.embedding),
					usage: {
						promptTokens: response.usage?.prompt_tokens || 0,
						totalTokens: response.usage?.total_tokens || 0,
					},
				}
			} catch (error: any) {
				attempts++

				// Try to extract headers from the error response if available
				if (error?.response?.headers) {
					lastRateLimitHeaders = this.extractRateLimitHeaders(error.response.headers)
				}

				// Check if it's a rate limit error - retry indefinitely for 429
				const httpError = error as HttpError
				if (httpError?.status === 429) {
					// Update global rate limit state
					await this.updateGlobalRateLimitState(lastRateLimitHeaders)

					const delayMs = this.calculateSmartBackoff(lastRateLimitHeaders, attempts - 1)

					// Only log on first retry to avoid flooding logs
					if (attempts === 1) {
						console.warn(
							t("embeddings:rateLimitRetry", {
								delayMs,
								attempt: attempts,
								maxRetries: "∞", // Infinite retries for rate limits
							}),
						)

						if (
							lastRateLimitHeaders.remainingRequests !== undefined ||
							lastRateLimitHeaders.remainingTokens !== undefined
						) {
							console.warn(
								`Rate limits - Requests: ${lastRateLimitHeaders.remainingRequests ?? "N/A"}/${lastRateLimitHeaders.limitRequests ?? "N/A"}, ` +
									`Tokens: ${lastRateLimitHeaders.remainingTokens ?? "N/A"}/${lastRateLimitHeaders.limitTokens ?? "N/A"}`,
							)
						}
					}

					await new Promise((resolve) => setTimeout(resolve, delayMs))
					continue
				}

				// For non-rate-limit errors, apply the retry limit
				if (attempts >= MAX_RETRIES) {
					// Capture telemetry before reformatting the error
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
						location: "OpenAiEmbedder:_embedBatchWithRetries",
						attempt: attempts,
						rateLimitHeaders: lastRateLimitHeaders,
					})

					// Log the error for debugging
					console.error(`OpenAI embedder error (attempt ${attempts}/${MAX_RETRIES}):`, error)

					// Format and throw the error
					throw formatEmbeddingError(error, MAX_RETRIES)
				}

				// For other errors, retry with exponential backoff up to MAX_RETRIES
				const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempts - 1)

				console.warn(
					`OpenAI embedder error (attempt ${attempts}/${MAX_RETRIES}), retrying in ${delayMs}ms:`,
					error instanceof Error ? error.message : String(error),
				)

				await new Promise((resolve) => setTimeout(resolve, delayMs))
			}
		}
	}

	/**
	 * Validates the OpenAI embedder configuration by attempting a minimal embedding request
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(async () => {
			try {
				// Test with a minimal embedding request using withResponse to check headers
				const { data: response } = await this.embeddingsClient.embeddings
					.create({
						input: ["test"],
						model: this.defaultModelId,
					})
					.withResponse()

				// Check if we got a valid response
				if (!response.data || response.data.length === 0) {
					return {
						valid: false,
						error: t("embeddings:openai.invalidResponseFormat"),
					}
				}

				return { valid: true }
			} catch (error) {
				// Capture telemetry for validation errors
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "OpenAiEmbedder:validateConfiguration",
				})
				throw error
			}
		}, "openai")
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "openai",
		}
	}

	/**
	 * Waits if there's an active global rate limit
	 */
	private async waitForGlobalRateLimit(): Promise<void> {
		const release = await OpenAiEmbedder.globalRateLimitState.mutex.acquire()
		try {
			const state = OpenAiEmbedder.globalRateLimitState

			if (state.isRateLimited && state.rateLimitResetTime > Date.now()) {
				const waitTime = state.rateLimitResetTime - Date.now()
				// Silent wait - no logging to prevent flooding
				release() // Release mutex before waiting
				await new Promise((resolve) => setTimeout(resolve, waitTime))
				return
			}

			// Reset rate limit if time has passed
			if (state.isRateLimited && state.rateLimitResetTime <= Date.now()) {
				state.isRateLimited = false
				state.rateLimitHeaders = {}
			}
		} finally {
			// Only release if we haven't already
			try {
				release()
			} catch {
				// Already released
			}
		}
	}

	/**
	 * Updates global rate limit state when a 429 error occurs
	 */
	private async updateGlobalRateLimitState(headers: RateLimitHeaders): Promise<void> {
		const release = await OpenAiEmbedder.globalRateLimitState.mutex.acquire()
		try {
			const state = OpenAiEmbedder.globalRateLimitState

			// Calculate delay based on headers
			const delayMs = this.calculateSmartBackoff(headers, 0)

			// Set global rate limit
			state.isRateLimited = true
			state.rateLimitResetTime = Date.now() + delayMs
			state.rateLimitHeaders = headers
		} finally {
			release()
		}
	}
}
