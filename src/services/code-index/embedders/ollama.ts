import { ApiHandlerOptions } from "../../../shared/api"
import { EmbedderInfo, EmbeddingResponse, IEmbedder } from "../interfaces"

/**
 * Implements the IEmbedder interface using a local Ollama instance.
 */
export class CodeIndexOllamaEmbedder implements IEmbedder {
	private readonly baseUrl: string
	private readonly defaultModelId: string

	constructor(options: ApiHandlerOptions) {
		// Ensure ollamaBaseUrl and ollamaModelId exist on ApiHandlerOptions or add defaults
		this.baseUrl = options.ollamaBaseUrl || "http://localhost:11434"
		this.defaultModelId = options.ollamaModelId || "nomic-embed-text:latest"
	}

	/**
	 * Creates embeddings for the given texts using the specified Ollama model.
	 * @param texts - An array of strings to embed.
	 * @param model - Optional model ID to override the default.
	 * @returns A promise that resolves to an EmbeddingResponse containing the embeddings and usage data.
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.defaultModelId
		const url = `${this.baseUrl}/api/embed`

		try {
			// Ollama API processes one text at a time using 'prompt' field
			const embeddings: number[][] = []

			for (const text of texts) {
				const requestBody = {
					model: modelToUse,
					prompt: text,
				}

				const response = await fetch(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				})

				if (!response.ok) {
					let errorBody = "Could not read error body"
					try {
						errorBody = await response.text()
					} catch (e) {
						// Ignore error reading body
					}
					throw new Error(
						`Ollama API request failed with status ${response.status} ${response.statusText}: ${errorBody}`,
					)
				}

				const data = await response.json()

				// Extract embedding using 'embedding' key (singular)
				const embedding = data.embedding
				if (!embedding || !Array.isArray(embedding)) {
					throw new Error(
						'Invalid response structure from Ollama API: "embedding" array not found or not an array.',
					)
				}

				embeddings.push(embedding)
			}

			return {
				embeddings: embeddings,
			}
		} catch (error: any) {
			// Re-throw a more specific error for the caller
			throw new Error(`Ollama embedding failed: ${error.message}`)
		}
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "ollama",
		}
	}
}
