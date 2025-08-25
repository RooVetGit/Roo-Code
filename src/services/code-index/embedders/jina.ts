import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces"
import { getModelQueryPrefix } from "../../../shared/embeddingModels"
import { t } from "../../../i18n"
import {
	withValidationErrorHandling,
	formatEmbeddingError,
	getErrorMessageForStatus,
} from "../shared/validation-helpers"
import type { HttpError } from "../shared/validation-helpers"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import {
	MAX_BATCH_TOKENS,
	MAX_ITEM_TOKENS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
} from "../constants"

interface JinaEmbeddingRequest {
	model: string
	input: string[]
	encoding_type?: "float" | "base64"
	task?: string
	dimensions?: number
	late_chunking?: boolean
	embedding_type?: "float" | "base64" | "binary" | "ubinary"
}

interface JinaEmbeddingResponse {
	model: string
	object: "list"
	usage: {
		total_tokens: number
		prompt_tokens: number
	}
	data: Array<{
		object: "embedding"
		index: number
		embedding: number[] | string
	}>
}

/**
 * Jina implementation of the embedder interface with batching and rate limiting
 * Uses jina-embeddings-v4 with multi-vector embeddings for code search
 */
export class JinaEmbedder implements IEmbedder {
	private readonly apiKey: string
	private readonly baseUrl = "https://api.jina.ai/v1"
	private readonly defaultModelId: string

	/**
	 * Creates a new Jina embedder
	 * @param apiKey Jina API key
	 * @param modelId Optional model identifier (defaults to jina-embeddings-v4)
	 */
	constructor(apiKey: string, modelId?: string) {
		this.apiKey = apiKey
		this.defaultModelId = modelId || "jina-embeddings-v4"
	}

	get embedderInfo(): EmbedderInfo {
		return { name: "jina" }
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
		const queryPrefix = getModelQueryPrefix("jina", modelToUse)
		const processedTexts = queryPrefix
			? texts.map((text) => {
					// Prevent double-prefixing
					if (text.startsWith(queryPrefix)) {
						return text
					}
					return queryPrefix + text
				})
			: texts

		let attempt = 0
		let lastError: Error | null = null

		while (attempt < MAX_RETRIES) {
			attempt++

			try {
				const batches = this.createBatches(processedTexts)
				const allEmbeddings: number[][] = []
				let totalPromptTokens = 0
				let totalTokens = 0

				for (const batch of batches) {
					const response = await this.fetchEmbeddings(batch, modelToUse)

					// Extract embeddings from response
					const embeddings = response.data
						.sort((a, b) => a.index - b.index)
						.map((item) => {
							if (typeof item.embedding === "string") {
								throw new Error("Base64/binary embeddings are not supported")
							}
							return item.embedding
						})

					allEmbeddings.push(...embeddings)
					totalPromptTokens += response.usage.prompt_tokens
					totalTokens += response.usage.total_tokens
				}

				return {
					embeddings: allEmbeddings,
					usage: {
						promptTokens: totalPromptTokens,
						totalTokens: totalTokens,
					},
				}
			} catch (error) {
				lastError = error as Error

				if (error && typeof error === "object" && "status" in error) {
					const errorStatus = (error as any).status
					if (errorStatus === 401) {
						throw new Error(t("embeddings:authenticationFailed"))
					} else if (errorStatus === 429) {
						// Rate limit - retry with exponential backoff
						const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1)
						console.warn(
							t("embeddings:rateLimitRetry", {
								delayMs: delay,
								attempt,
								maxRetries: MAX_RETRIES,
							}),
						)
						await new Promise((resolve) => setTimeout(resolve, delay))
						continue
					} else {
						throw new Error(
							t("embeddings:failedWithStatus", {
								attempts: attempt,
								statusCode: error.status,
								errorMessage: error.message,
							}),
						)
					}
				} else if (error instanceof Error) {
					throw new Error(
						t("embeddings:failedWithError", {
							attempts: attempt,
							errorMessage: error.message,
						}),
					)
				}
			}
		}

		// If we've exhausted all retries
		if (lastError) {
			throw new Error(
				t("embeddings:failedMaxAttempts", {
					attempts: MAX_RETRIES,
				}),
			)
		}

		throw new Error(t("embeddings:unknownError"))
	}

	/**
	 * Validates the embedder configuration by testing connectivity and credentials
	 * @returns Promise resolving to validation result
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(async () => {
			const testText = "function hello() { return 'world'; }"
			const response = await this.fetchEmbeddings([testText], this.defaultModelId)

			// Validate response structure
			if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
				throw new Error(t("embeddings:validation.invalidResponse"))
			}

			const embedding = response.data[0].embedding
			if (!Array.isArray(embedding) || embedding.length === 0) {
				throw new Error(t("embeddings:validation.invalidResponse"))
			}

			return { valid: true }
		}, "jina")
	}

	/**
	 * Creates batches of texts based on token limits
	 */
	private createBatches(texts: string[]): string[][] {
		const batches: string[][] = []
		let currentBatch: string[] = []
		let currentBatchTokens = 0

		for (const text of texts) {
			// Rough token estimation (1 token ≈ 4 characters)
			const estimatedTokens = Math.ceil(text.length / 4)

			// Check if this item exceeds the max item tokens
			if (estimatedTokens > MAX_ITEM_TOKENS) {
				console.warn(
					t("embeddings:textExceedsTokenLimit", {
						index: texts.indexOf(text),
						itemTokens: estimatedTokens,
						maxTokens: MAX_ITEM_TOKENS,
					}),
				)
				continue
			}

			// If adding this text would exceed batch limits, start a new batch
			if (currentBatch.length > 0 && currentBatchTokens + estimatedTokens > MAX_BATCH_TOKENS) {
				batches.push(currentBatch)
				currentBatch = []
				currentBatchTokens = 0
			}

			currentBatch.push(text)
			currentBatchTokens += estimatedTokens
		}

		// Don't forget the last batch
		if (currentBatch.length > 0) {
			batches.push(currentBatch)
		}

		return batches
	}

	/**
	 * Fetches embeddings from Jina API
	 */
	private async fetchEmbeddings(texts: string[], model: string): Promise<JinaEmbeddingResponse> {
		const request: JinaEmbeddingRequest = {
			model,
			input: texts,
			encoding_type: "float",
			// Use code.query task for code search embeddings
			task: "code.query",
			// Request full 2048 dimensions for jina-embeddings-v4
			dimensions: model === "jina-embeddings-v4" ? 2048 : undefined,
		}

		const response = await fetch(`${this.baseUrl}/embeddings`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify(request),
		})

		if (!response.ok) {
			const errorData = await response.text().catch(() => "Unknown error")
			const error = { status: response.status, message: errorData } as any
			throw formatEmbeddingError(error, MAX_RETRIES)
		}

		const data = (await response.json()) as JinaEmbeddingResponse

		// Capture telemetry
		// Log telemetry for successful embedding creation
		// Note: Currently only CODE_INDEX_ERROR event is available for code indexing

		return data
	}
}
