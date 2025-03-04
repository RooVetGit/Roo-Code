import axios from "axios"
import { ModelInfo } from "../../../src/shared/api"
import { parseApiPrice } from "../../../src/utils/cost"

export const OPENROUTER_DEFAULT_PROVIDER_NAME = "[default]"
export async function getOpenRouterProvidersForModel(modelId: string) {
	const models: Record<string, ModelInfo> = {}

	try {
		const response = await axios.get(`https://openrouter.ai/api/v1/models/${modelId}/endpoints`)
		const rawEndpoints = response.data.data

		for (const rawEndpoint of rawEndpoints.endpoints) {
			const modelInfo: ModelInfo = {
				maxTokens: rawEndpoint.max_completion_tokens,
				contextWindow: rawEndpoint.context_length,
				supportsImages: rawEndpoints.architecture?.modality?.includes("image"),
				supportsPromptCache: false,
				inputPrice: parseApiPrice(rawEndpoint.pricing?.prompt),
				outputPrice: parseApiPrice(rawEndpoint.pricing?.completion),
				description: rawEndpoints.description,
				thinking: modelId === "anthropic/claude-3.7-sonnet:thinking",
			}

			// Set additional properties based on model type
			switch (true) {
				case modelId.startsWith("anthropic/claude-3.7-sonnet"):
					modelInfo.supportsComputerUse = true
					modelInfo.supportsPromptCache = true
					modelInfo.cacheWritesPrice = 3.75
					modelInfo.cacheReadsPrice = 0.3
					modelInfo.maxTokens = rawEndpoint.id === "anthropic/claude-3.7-sonnet:thinking" ? 64_000 : 16_384
					break
				case modelId.startsWith("anthropic/claude-3.5-sonnet-20240620"):
					modelInfo.supportsPromptCache = true
					modelInfo.cacheWritesPrice = 3.75
					modelInfo.cacheReadsPrice = 0.3
					modelInfo.maxTokens = 8192
					break
				// Add other cases as needed
				default:
					modelInfo.supportsPromptCache = true
					modelInfo.cacheWritesPrice = 0.3
					modelInfo.cacheReadsPrice = 0.03
					break
			}

			const providerName = rawEndpoint.name.split("|")[0].trim()
			models[providerName] = modelInfo
		}
	} catch (error) {
		console.error(`Error fetching OpenRouter providers:`, error)
	}

	return models
}
