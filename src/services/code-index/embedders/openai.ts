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

/**
 * OpenAI implementation of the embedder interface with batching and rate limiting
 */
export class OpenAiEmbedder extends OpenAiNativeHandler implements IEmbedder {
	private embeddingsClient: OpenAI
	private readonly defaultModelId: string

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
	 * Helper method to handle batch embedding with retries and exponential backoff
	 * @param batchTexts Array of texts to embed in this batch
	 * @param model Model identifier to use
	 * @returns Promise resolving to embeddings and usage statistics
	 */
	private async _embedBatchWithRetries(
		batchTexts: string[],
		model: string,
	): Promise<{ embeddings: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
		// Use longer delays for text-embedding-3-large model due to stricter rate limits
		const isLargeModel = model.includes("text-embedding-3-large")
		const baseDelayMs = isLargeModel ? INITIAL_DELAY_MS * 4 : INITIAL_DELAY_MS // 2 seconds for large model
		
		for (let attempts = 0; attempts < MAX_RETRIES; attempts++) {
			try {
				const response = await this.embeddingsClient.embeddings.create({
					input: batchTexts,
					model: model,
				})

				return {
					embeddings: response.data.map((item) => item.embedding),
					usage: {
						promptTokens: response.usage?.prompt_tokens || 0,
						totalTokens: response.usage?.total_tokens || 0,
					},
				}
			} catch (error: any) {
				const hasMoreAttempts = attempts < MAX_RETRIES - 1

				// Enhanced rate limit detection
				const httpError = error as HttpError
				const isRateLimit = httpError?.status === 429 ||
					(error?.message && (
						error.message.includes("rate limit") ||
						error.message.includes("Rate limit") ||
						error.message.includes("too many requests") ||
						error.message.includes("quota exceeded")
					))

				if (isRateLimit && hasMoreAttempts) {
					// Use longer exponential backoff for large models and rate limit errors
					const multiplier = isLargeModel ? 3 : 2
					const delayMs = baseDelayMs * Math.pow(multiplier, attempts)
					
					console.warn(
						t("embeddings:rateLimitRetry", {
							delayMs,
							attempt: attempts + 1,
							maxRetries: MAX_RETRIES,
						}),
					)
					
					// Add jitter to prevent thundering herd
					const jitter = Math.random() * 1000
					await new Promise((resolve) => setTimeout(resolve, delayMs + jitter))
					continue
				}

				// Check for other retryable errors (network issues, timeouts)
				const isRetryableError = error?.code === 'ECONNRESET' ||
					error?.code === 'ETIMEDOUT' ||
					error?.code === 'ENOTFOUND' ||
					(httpError?.status && httpError.status >= 500)

				if (isRetryableError && hasMoreAttempts) {
					const delayMs = baseDelayMs * Math.pow(2, attempts)
					console.warn(
						`Retrying OpenAI request due to ${error?.code || httpError?.status} (attempt ${attempts + 1}/${MAX_RETRIES}) after ${delayMs}ms`,
					)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
					continue
				}

				// Capture telemetry before reformatting the error
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "OpenAiEmbedder:_embedBatchWithRetries",
					attempt: attempts + 1,
					model: model,
					batchSize: batchTexts.length,
					isRateLimit,
					isRetryableError,
				})

				// Log the error for debugging
				console.error(`OpenAI embedder error (attempt ${attempts + 1}/${MAX_RETRIES}):`, error)

				// Format and throw the error with more context
				const formattedError = formatEmbeddingError(error, MAX_RETRIES)
				
				// Add model-specific context to error message
				if (isLargeModel && isRateLimit) {
					throw new Error(`${formattedError.message} Note: text-embedding-3-large has stricter rate limits. Consider using text-embedding-3-small for large codebases.`)
				}
				
				throw formattedError
			}
		}

		throw new Error(t("embeddings:failedMaxAttempts", { attempts: MAX_RETRIES }))
	}

	/**
	 * Validates the OpenAI embedder configuration by attempting a minimal embedding request
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(async () => {
			try {
				// Test with a minimal embedding request
				const response = await this.embeddingsClient.embeddings.create({
					input: ["test"],
					model: this.defaultModelId,
				})

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
}
