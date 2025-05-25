import { ApiHandlerOptions } from "../../../shared/api"
import { EmbedderInfo, EmbeddingResponse, IEmbedder } from "../interfaces"
import { GeminiHandler } from "../../../api/providers/gemini"

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
	 * Creates embeddings for the given texts using the Gemini API.
	 * @param texts - An array of strings to embed.
	 * @param model - Optional model ID to override the default.
	 * @returns A promise that resolves to an EmbeddingResponse containing the embeddings and usage data.
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		try {
			// Use the enhanced GeminiHandler to generate embeddings
			const result = await this.generateEmbeddings(texts, model, this.defaultTaskType)

			return {
				embeddings: result.embeddings,
				usage: result.usage,
			}
		} catch (error: any) {
			// Log the original error for debugging purposes
			console.error("Gemini embedding failed:", error)
			// Re-throw a more specific error for the caller
			throw new Error(`Gemini embedding failed: ${error.message}`)
		}
	}

	/**
	 * Generates embeddings for the provided texts using Gemini API
	 * @param texts - Array of text strings to create embeddings for
	 * @param model - Optional model ID to use for embeddings, defaults to the configured default model
	 * @param taskType - The task type to optimize embeddings for (e.g., 'CODE_RETRIEVAL_QUERY')
	 * @returns Promise resolving to an EmbeddingResponse with the embeddings and usage data
	 */
	private async generateEmbeddings(
		texts: string[],
		model?: string,
		taskType: string = "CODE_RETRIEVAL_QUERY",
	): Promise<{
		embeddings: number[][]
		usage?: {
			promptTokens: number
			totalTokens: number
		}
	}> {
		try {
			const modelId = model || this.defaultModelId

			// Use batchEmbedContents for multiple texts
			const response = await this.client.models.embedContent({
				model: modelId,
				contents: texts,
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
			return { embeddings }
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Gemini embeddings error: ${error.message}`)
			}
			throw error
		}
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "gemini",
		}
	}
}
