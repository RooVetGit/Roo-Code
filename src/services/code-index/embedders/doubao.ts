import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import { t } from "../../../i18n"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { DOUBAO_MAX_ITEM_TOKENS } from "../constants"

export class DoubaoEmbedder implements IEmbedder {
	private readonly openAICompatibleEmbedder: OpenAICompatibleEmbedder
	private static readonly Doubao_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3/"
	private static readonly DEFAULT_MODEL = "doubao-embedding-text-240515"
	private readonly modelId: string

	constructor(apiKey: string, modelId?: string) {
		if (!apiKey) {
			throw new Error(t("embeddings:validation.apiKeyRequired"))
		}

		// Use provided model or default
		this.modelId = modelId || DoubaoEmbedder.DEFAULT_MODEL

		// Create an OpenAI Compatible embedder with Doubao's configuration
		this.openAICompatibleEmbedder = new OpenAICompatibleEmbedder(
			DoubaoEmbedder.Doubao_BASE_URL,
			apiKey,
			this.modelId,
			DOUBAO_MAX_ITEM_TOKENS,
		)
	}

	/**
	 * Creates embeddings for the given texts using Doubao's embedding API
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier (uses constructor model if not provided)
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		try {
			// Use the provided model or fall back to the instance's model
			const modelToUse = model || this.modelId
			return await this.openAICompatibleEmbedder.createEmbeddings(texts, modelToUse)
		} catch (error) {
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "DoubaoEmbedder:createEmbeddings",
			})
			throw error
		}
	}

	/**
	 * Validates the Doubao embedder configuration by delegating to the underlying OpenAI-compatible embedder
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			// Delegate validation to the OpenAI-compatible embedder
			// The error messages will be specific to Doubao since we're using Doubao's base URL
			return await this.openAICompatibleEmbedder.validateConfiguration()
		} catch (error) {
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "DoubaoEmbedder:validateConfiguration",
			})
			throw error
		}
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "doubao",
		}
	}
}
