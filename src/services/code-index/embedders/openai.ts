import { OpenAI } from "openai"
import { OpenAiNativeHandler } from "../../../api/providers/openai-native"
import { ApiHandlerOptions } from "../../../shared/api"
import { IEmbedder, EmbeddingResponse } from "../interfaces"

/**
 * OpenAI implementation of the embedder interface
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
	 * Creates embeddings for the given texts
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		try {
			const modelToUse = model || this.defaultModelId
			const response = await this.embeddingsClient.embeddings.create({
				input: texts,
				model: modelToUse,
			})

			return {
				embeddings: response.data.map((item) => item.embedding),
				usage: {
					promptTokens: response.usage?.prompt_tokens || 0,
					totalTokens: response.usage?.total_tokens || 0,
				},
			}
		} catch (error) {
			console.error("Failed to create embeddings:", error)
			throw new Error("Failed to create embeddings")
		}
	}
}
