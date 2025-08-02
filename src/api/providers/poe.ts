import { type PoeModelId, poeDefaultModelId, poeModels, poeDefaultModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class PoeHandler extends BaseOpenAiCompatibleProvider<PoeModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Poe",
			baseURL: options.poeBaseUrl || "https://api.poe.com/v1",
			apiKey: options.poeApiKey,
			defaultProviderModelId: poeDefaultModelId,
			providerModels: poeModels,
			defaultTemperature: 0.7,
		})
	}

	override getModel() {
		const modelId = this.options.apiModelId || this.defaultProviderModelId

		// Check if it's a known model
		if (modelId in this.providerModels) {
			return { id: modelId, info: this.providerModels[modelId as PoeModelId] }
		}

		// For custom bots, use default model info
		return { id: modelId, info: poeDefaultModelInfo }
	}
}
