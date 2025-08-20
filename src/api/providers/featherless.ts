import { type FeatherlessModelId, featherlessDefaultModelId, featherlessModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class FeatherlessHandler extends BaseOpenAiCompatibleProvider<FeatherlessModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Featherless",
			baseURL: "https://api.featherless.ai/v1",
			apiKey: options.featherlessApiKey,
			defaultProviderModelId: featherlessDefaultModelId,
			providerModels: featherlessModels,
			defaultTemperature: 0.7,
		})
	}
}
