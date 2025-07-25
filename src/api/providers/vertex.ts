import { type ModelInfo, type VertexModelId, vertexDefaultModelId, vertexModels } from "@roo-code/types"
import type { Anthropic } from "@anthropic-ai/sdk"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { GeminiHandler } from "./gemini"
import { SingleCompletionHandler } from "../index"

export class VertexHandler extends GeminiHandler implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		super({ ...options, isVertex: true })
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in vertexModels ? (modelId as VertexModelId) : vertexDefaultModelId
		const info: ModelInfo = vertexModels[id]
		const params = getModelParams({ format: "gemini", modelId: id, model: info, settings: this.options })

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Gemini's API does not have this
		// suffix.
		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}

	/**
	 * Override token counting to add additional error handling for Vertex AI.
	 * Falls back to tiktoken if the Gemini API token counting fails or returns unreliable results.
	 */
	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			// Try the parent GeminiHandler's token counting first
			const tokenCount = await super.countTokens(content)
			
			// Additional validation: if token count seems unreasonably low for non-empty content,
			// fall back to tiktoken
			if (content.length > 0 && tokenCount === 0) {
				console.warn("Vertex AI token counting returned 0 for non-empty content, using tiktoken fallback")
				return this.fallbackTokenCount(content)
			}
			
			return tokenCount
		} catch (error) {
			console.warn("Vertex AI token counting failed completely, using tiktoken fallback:", error)
			return this.fallbackTokenCount(content)
		}
	}

	/**
	 * Fallback token counting using the base provider's tiktoken implementation
	 */
	private async fallbackTokenCount(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		// Call the base provider's countTokens method (which uses tiktoken)
		return super.countTokens(content)
	}
}
