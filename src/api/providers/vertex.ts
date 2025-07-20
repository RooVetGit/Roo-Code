import {
	type ModelInfo,
	type VertexModelId,
	vertexDefaultModelId,
	vertexModels,
	legacyVertexModels,
} from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { getModelParams } from "../transform/model-params"

import { GeminiHandler } from "./gemini"
import { SingleCompletionHandler } from "../index"

export class VertexHandler extends GeminiHandler implements SingleCompletionHandler {
	constructor(options: ApiHandlerOptions) {
		super({ ...options, isVertex: true })
	}

	/**
	 * Maps legacy Vertex model IDs to current supported models
	 */
	private mapLegacyVertexModel(modelId: string): VertexModelId {
		if (modelId in vertexModels) {
			return modelId as VertexModelId
		}

		if (modelId in legacyVertexModels) {
			if (modelId.startsWith("gemini-2.5-pro-preview-")) {
				return "gemini-2.5-pro"
			}

			if (modelId.startsWith("gemini-1.5-pro-")) {
				return "gemini-2.0-flash-001"
			}

			if (modelId.startsWith("gemini-1.5-flash-")) {
				return "gemini-2.0-flash-001"
			}

			if (modelId.startsWith("gemini-2.5-pro-exp-")) {
				return "gemini-2.5-pro"
			}
		}

		return vertexDefaultModelId
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId ? this.mapLegacyVertexModel(modelId) : vertexDefaultModelId

		if (modelId && id && modelId !== id) {
			this.options.apiModelId = id
		}

		const info: ModelInfo = vertexModels[id]
		const params = getModelParams({ format: "gemini", modelId: id, model: info, settings: this.options })

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Gemini's API does not have this
		// suffix.
		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}
}
