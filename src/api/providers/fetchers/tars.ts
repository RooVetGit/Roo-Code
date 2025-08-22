import axios from "axios"

import type { ModelInfo } from "@roo-code/types"

import { parseApiPrice } from "../../../shared/cost"

export async function getTarsModels(apiKey?: string): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	try {
		const headers: Record<string, string> = {}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const url = "https://api.router.tetrate.ai/v1/models"
		const response = await axios.get(url, { headers })
		const rawModels = response.data.data

		for (const rawModel of rawModels) {
			// TARS supports reasoning for Claude and Gemini models similar to Requesty
			const reasoningBudget =
				rawModel.supports_reasoning &&
				(rawModel.id.includes("claude") ||
					rawModel.id.includes("coding/gemini-2.5") ||
					rawModel.id.includes("vertex/gemini-2.5"))
			const reasoningEffort =
				rawModel.supports_reasoning &&
				(rawModel.id.includes("openai") || rawModel.id.includes("google/gemini-2.5"))

			const modelInfo: ModelInfo = {
				maxTokens: rawModel.max_output_tokens || rawModel.max_tokens || 4096,
				contextWindow: rawModel.context_window || 128000,
				supportsPromptCache: rawModel.supports_caching || rawModel.supports_prompt_cache || false,
				supportsImages: rawModel.supports_vision || rawModel.supports_images || false,
				supportsComputerUse: rawModel.supports_computer_use || false,
				supportsReasoningBudget: reasoningBudget,
				supportsReasoningEffort: reasoningEffort,
				inputPrice: parseApiPrice(rawModel.input_price) || 0,
				outputPrice: parseApiPrice(rawModel.output_price) || 0,
				description: rawModel.description,
				cacheWritesPrice: parseApiPrice(rawModel.caching_price || rawModel.cache_write_price) || 0,
				cacheReadsPrice: parseApiPrice(rawModel.cached_price || rawModel.cache_read_price) || 0,
			}

			models[rawModel.id] = modelInfo
		}
	} catch (error) {
		console.error(`Error fetching TARS models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
	}

	return models
}
