import { EmbeddingResponse } from "./types"

/**
 * Interface for embedding providers
 */
export interface IEmbedder {
	/**
	 * Creates embeddings for the given texts
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier
	 * @returns Promise resolving to embedding response
	 */
	createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse>
}
