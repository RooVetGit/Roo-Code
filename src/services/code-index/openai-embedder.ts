import { OpenAI } from "openai"
import { OpenAiNativeHandler } from "../../api/providers/openai-native"
import { ApiHandlerOptions } from "../../shared/api"

interface EmbeddingResponse {
	embeddings: number[][]
	usage: {
		prompt_tokens: number
		total_tokens: number
	}
}

export class CodeIndexOpenAiEmbedder extends OpenAiNativeHandler {
	private embeddingsClient: OpenAI

	constructor(options: ApiHandlerOptions) {
		super(options)
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		this.embeddingsClient = new OpenAI({ apiKey })
	}

	async createEmbeddings(texts: string[], model: string = "text-embedding-3-small"): Promise<EmbeddingResponse> {
		try {
			const response = await this.embeddingsClient.embeddings.create({
				input: texts,
				model,
			})

			return {
				embeddings: response.data.map((item) => item.embedding),
				usage: {
					prompt_tokens: response.usage?.prompt_tokens || 0,
					total_tokens: response.usage?.total_tokens || 0,
				},
			}
		} catch (error) {
			console.error("Failed to create embeddings:", error)
			throw new Error("Failed to create embeddings")
		}
	}
}
