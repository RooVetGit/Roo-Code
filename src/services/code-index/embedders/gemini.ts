import { ApiHandlerOptions } from "../../../shared/api"
import { EmbedderInfo, EmbeddingResponse, IEmbedder } from "../interfaces"
import { GeminiHandler } from "../../../api/providers/gemini"
import { EMBEDDING_MODEL_PROFILES } from "../../../shared/embeddingModels"
import { GEMINI_RATE_LIMIT_DELAY_MS, MAX_BATCH_RETRIES, INITIAL_RETRY_DELAY_MS } from "../constants"
/**
 * Implements the IEmbedder interface using Google Gemini's embedding API.
 */
export class CodeIndexGeminiEmbedder extends GeminiHandler implements IEmbedder {
	private readonly defaultModelId: string
	private readonly defaultTaskType: string

	/**
	 * Creates a new Gemini embedder instance.
	 * @param options API handler options containing Gemini configurations
	 */
	constructor(options: ApiHandlerOptions) {
		super(options)
		this.defaultModelId = options.apiModelId || "gemini-embedding-exp-03-07"
		this.defaultTaskType = options.geminiEmbeddingTaskType || "CODE_RETRIEVAL_QUERY"
	}

	/**
	 * Creates embeddings for the given texts using the Gemini API, ensuring sequential processing.
	 * @param texts - An array of strings to embed.
	 * @param model - Optional model ID to override the default.
	 * @returns A promise that resolves to an EmbeddingResponse containing the embeddings.
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		try {
			const modelId = model || this.defaultModelId
			const result = await this.embedWithTokenLimit(texts, modelId, this.defaultTaskType)
			return {
				embeddings: result.embeddings,
			}
		} catch (error: any) {
			console.error("Error during Gemini embedding task execution in queue:", error.message)
			throw error
		}
	}

	/**
	 * Embeds texts while respecting the token limit of the model.
	 * Splits the input texts into batches that don't exceed the model's token limit.
	 * Also adds a delay between requests to respect Gemini's rate limits.
	 *
	 * @param texts - Array of text strings to create embeddings for
	 * @param model - Model ID to use for embeddings
	 * @param taskType - The task type to optimize embeddings for
	 * @returns Promise resolving to an object with embeddings and usage data
	 */
	private async embedWithTokenLimit(
		texts: string[],
		model: string,
		taskType: string,
	): Promise<{
		embeddings: number[][]
		usage: { promptTokens: number; totalTokens: number }
	}> {
		// Get the model profile
		const geminiProfiles = EMBEDDING_MODEL_PROFILES.gemini || {}
		const modelProfile = geminiProfiles[model]

		// Default max tokens if not specified in the profile
		const maxInputTokens = modelProfile?.maxInputTokens || 8192

		// Initialize result arrays
		const allEmbeddings: number[][] = []
		const aggregatedUsage = { promptTokens: 0, totalTokens: 0 }

		// Process texts in batches
		const remainingTexts = [...texts]
		let isFirstBatch = true // Initialize isFirstBatch

		while (remainingTexts.length > 0) {
			const currentBatch: string[] = []
			let currentBatchTokens = 0
			const processedIndices: number[] = []

			// Simple token estimation (4 chars ≈ 1 token)
			for (let i = 0; i < remainingTexts.length; i++) {
				const text = remainingTexts[i]
				// Estimate tokens (similar to OpenAI's implementation)
				const estimatedTokens = Math.ceil(text.length / 4)

				// Skip texts that exceed the max token limit for a single item
				if (estimatedTokens > maxInputTokens) {
					console.warn(
						`Text at index ${i} exceeds maximum token limit (${estimatedTokens} > ${maxInputTokens}). Skipping.`,
					)
					processedIndices.push(i)
					continue
				}

				// Add text to batch if it fits within the token limit
				if (currentBatchTokens + estimatedTokens <= maxInputTokens) {
					currentBatch.push(text)
					currentBatchTokens += estimatedTokens
					processedIndices.push(i)
				} else {
					// This text would exceed the limit, so process the current batch first
					break
				}
			}

			// Remove processed texts from the remaining texts
			for (let i = processedIndices.length - 1; i >= 0; i--) {
				remainingTexts.splice(processedIndices[i], 1)
			}

			// Process the current batch if not empty
			if (currentBatch.length > 0) {
				if (!isFirstBatch) {
					const delayMs =
						this.options.rateLimitSeconds !== undefined
							? this.options.rateLimitSeconds * 1000
							: GEMINI_RATE_LIMIT_DELAY_MS
					console.log(`Adding proactive delay of ${delayMs}ms before Gemini batch`)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
					isFirstBatch = false
				}

				try {
					const batchResult = await this._embedBatchWithRetries(currentBatch, model, taskType)
					allEmbeddings.push(...batchResult.embeddings)
					aggregatedUsage.promptTokens += batchResult.usage.promptTokens
					aggregatedUsage.totalTokens += batchResult.usage.totalTokens
				} catch (error) {
					console.error("Failed to process batch with retries:", error)
					throw new Error(`Failed to create embeddings for batch: ${(error as Error).message}`)
				}
			}
		}

		return { embeddings: allEmbeddings, usage: aggregatedUsage }
	}

	/**
	 * Helper method to handle batch embedding with retries and exponential backoff for Gemini.
	 * @param batchTexts Array of texts to embed in this batch
	 * @param model Model identifier to use
	 * @param taskType The task type for the embedding
	 * @returns Promise resolving to embeddings and usage statistics
	 */
	private async _embedBatchWithRetries(
		batchTexts: string[],
		model: string,
		taskType: string,
	): Promise<{ embeddings: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
		const modelId = model || this.defaultModelId
		let lastError: any = null

		for (let attempts = 0; attempts < MAX_BATCH_RETRIES; attempts++) {
			try {
				const response = await this.client.models.embedContent({
					model: modelId,
					contents: batchTexts,
					config: {
						taskType,
					},
				})

				if (!response.embeddings) {
					throw new Error("No embeddings returned from Gemini API")
				}

				const embeddings = response.embeddings
					.map((embedding) => embedding?.values)
					.filter((values) => values !== undefined && values.length > 0) as number[][]

				// Gemini API for embeddings doesn't directly return token usage per call in the same way some others do.
				// The `generateEmbeddings` in the original file didn't populate usage.
				// If usage needs to be calculated, it would require a separate token counting call.
				// For now, returning empty usage, consistent with the original generateEmbeddings.
				return {
					embeddings,
					usage: { promptTokens: 0, totalTokens: 0 }, // Placeholder usage
				}
			} catch (error: any) {
				lastError = error
				// Basic check for retryable errors (e.g., rate limits)
				// Gemini might use 429 or specific error messages like "RESOURCE_EXHAUSTED" or "rate limit exceeded"
				const isRateLimitError =
					error?.status === 429 ||
					(error?.message &&
						(error.message.includes("rate limit") || error.message.includes("RESOURCE_EXHAUSTED")))

				const hasMoreAttempts = attempts < MAX_BATCH_RETRIES - 1

				if (isRateLimitError && hasMoreAttempts) {
					const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempts)
					console.warn(
						`Gemini embedding attempt ${attempts + 1} failed due to rate limit. Retrying in ${delayMs}ms...`,
					)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
					continue
				}
				// Non-retryable error or last attempt failed
				console.error(`Gemini embedding failed on attempt ${attempts + 1}:`, error)
				throw error // Re-throw the last error if not retryable or out of attempts
			}
		}
		// Should not be reached if throw error in loop works correctly, but as a fallback:
		throw new Error(
			`Failed to create embeddings for batch after ${MAX_BATCH_RETRIES} attempts. Last error: ${lastError?.message}`,
		)
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "gemini",
		}
	}
}
