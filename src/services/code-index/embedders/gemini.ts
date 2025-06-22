import { ApiHandlerOptions } from "../../../shared/api"
import { EmbedderInfo, EmbeddingResponse, IEmbedder } from "../interfaces"
import { GeminiHandler } from "../../../api/providers/gemini"
import { EMBEDDING_MODEL_PROFILES } from "../../../shared/embeddingModels"
import { GEMINI_RATE_LIMIT_DELAY_MS } from "../constants"
import { SlidingWindowRateLimiter, SlidingWindowRateLimiterOptions } from "../../../utils/rate-limiter"
import { RetryHandler } from "../../../utils/retry-handler"

/**
 * Implements the IEmbedder interface using Google Gemini's embedding API.
 */
export class CodeIndexGeminiEmbedder extends GeminiHandler implements IEmbedder {
	private readonly defaultModelId: string
	private readonly defaultTaskType: string
	private readonly rateLimiter: SlidingWindowRateLimiter
	private readonly retryHandler: RetryHandler
	private readonly id: string

	/**
	 * Creates a new Gemini embedder instance.
	 * @param options API handler options containing Gemini configurations
	 */
	constructor(options: ApiHandlerOptions) {
		super(options)
		this.defaultModelId = options.apiModelId || "gemini-embedding-exp-03-07"
		this.defaultTaskType = options.geminiEmbeddingTaskType || "CODE_RETRIEVAL_QUERY"

		// Calculate rate limit parameters based on rateLimitSeconds or default
		const rateLimitSeconds = options.rateLimitSeconds || GEMINI_RATE_LIMIT_DELAY_MS / 1000

		// Configure the rate limiter to use rateLimitSeconds for rate calculations
		const limiterOptions: SlidingWindowRateLimiterOptions = {
			rateLimitSeconds: rateLimitSeconds,
		}

		// Get the singleton rate limiter instance
		this.rateLimiter = new SlidingWindowRateLimiter(limiterOptions)
		// Initialize retry handler with default options
		this.retryHandler = new RetryHandler({
			initialDelay: rateLimitSeconds,
		})
		this.id = Math.random().toString()

		console.log(
			`Initialized Gemini rate limiter with id ${this.id} and ${rateLimitSeconds}s minimum delay between requests`,
		)
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
	 * Processes a batch of texts and aggregates the embeddings and usage statistics.
	 *
	 * @param batch Array of texts to process
	 * @param model Model identifier to use
	 * @param taskType The task type for the embedding
	 * @param allEmbeddings Array to store all embeddings
	 * @param aggregatedUsage Object to track token usage
	 * @param isFinalBatch Whether this is the final batch (affects error messages)
	 */
	private async _processAndAggregateBatch(
		batch: string[],
		model: string,
		taskType: string,
		allEmbeddings: number[][],
		aggregatedUsage: { promptTokens: number; totalTokens: number },
		isFinalBatch: boolean = false,
	): Promise<void> {
		if (batch.length === 0) return

		try {
			const batchResult = await this._embedBatch(batch, model, taskType)
			allEmbeddings.push(...batchResult.embeddings)
			aggregatedUsage.promptTokens += batchResult.usage.promptTokens
			aggregatedUsage.totalTokens += batchResult.usage.totalTokens
		} catch (error) {
			const batchType = isFinalBatch ? "final batch" : "batch"
			console.error(`Failed to process ${batchType} with retries:`, error)
			throw new Error(`Failed to create embeddings for ${batchType}: ${(error as Error).message}`)
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

		// Initialize the current batch
		let currentBatch: string[] = []
		let currentBatchTokens = 0

		// Process each text sequentially with for...of loop
		for (const text of texts) {
			// Estimate tokens (similar to OpenAI's implementation)
			const estimatedTokens = Math.ceil(text.length / 4)

			// Skip texts that exceed the max token limit for a single item
			if (estimatedTokens > maxInputTokens) {
				console.warn(`Text exceeds maximum token limit (${estimatedTokens} > ${maxInputTokens}). Skipping.`)
				continue
			}

			// If adding this text would exceed the token limit, process the current batch first
			if (currentBatchTokens + estimatedTokens > maxInputTokens) {
				// Process the current batch
				await this._processAndAggregateBatch(currentBatch, model, taskType, allEmbeddings, aggregatedUsage)

				// Reset the batch
				currentBatch = []
				currentBatchTokens = 0
			}

			// Add the current text to the batch
			currentBatch.push(text)
			currentBatchTokens += estimatedTokens
		}

		// Process any remaining texts in the final batch
		await this._processAndAggregateBatch(currentBatch, model, taskType, allEmbeddings, aggregatedUsage, true)

		return { embeddings: allEmbeddings, usage: aggregatedUsage }
	}

	/**
	 * Makes the actual API call to Gemini's embedding service and processes the response.
	 *
	 * @param batchTexts Array of texts to embed
	 * @param modelId Model identifier to use for the API call
	 * @param taskType The task type for the embedding
	 * @returns Promise resolving to embeddings and usage statistics
	 */
	private async _callGeminiEmbeddingApi(
		batchTexts: string[],
		modelId: string,
		taskType: string,
	): Promise<{ embeddings: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
		const now = new Date()
		console.log(`_callGeminiEmbeddingApi ${now.toISOString()}`)
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

		// Gemini API for embeddings doesn't directly return token usage per call
		return {
			embeddings,
			usage: { promptTokens: 0, totalTokens: 0 }, // Placeholder usage
		}
	}

	/**
	 * Creates embeddings for a batch of texts using the Gemini API.
	 * Rate limiting is handled by the SlidingWindowRateLimiter.
	 *
	 * @param batchTexts Array of texts to embed in this batch
	 * @param model Model identifier to use
	 * @param taskType The task type for the embedding
	 * @returns Promise resolving to embeddings and usage statistics
	 */
	private async _embedBatch(
		batchTexts: string[],
		model: string,
		taskType: string,
	): Promise<{ embeddings: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
		const modelId = model || this.defaultModelId

		// Determine if an error is retryable (429 Too Many Requests or specific API errors)
		const shouldRetry = (error: any): boolean => {
			const retryable =
				error.status === 429 ||
				error.message?.includes("RESOURCE_EXHAUSTED") ||
				error.message?.includes("rate limit") ||
				error.message?.includes("quota exceeded")

			if (retryable) {
				console.log(`Retryable error detected: ${error.message}`)
			}

			return retryable
		}

		try {
			// Execute the API call with retry logic
			return await this.retryHandler.execute(async () => {
				// Acquire a slot from the rate limiter before making the API call
				// This ensures each retry attempt also respects rate limits
				await this.rateLimiter.acquire()
				return await this._callGeminiEmbeddingApi(batchTexts, modelId, taskType)
			}, shouldRetry)
		} catch (error: any) {
			// Log the error with context
			console.error(`Gemini embedding request failed after all retry attempts:`, {
				error: error.message,
				status: error.status,
				modelId,
				batchSize: batchTexts.length,
			})

			// Rethrow the error
			throw error
		}
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "gemini",
		}
	}
}
