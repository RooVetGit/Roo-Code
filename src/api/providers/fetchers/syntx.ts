import axios from "axios"

import type { ModelInfo } from "@roo-code/types"

export async function getSyntxModels(
	apiKey: string,
	baseUrl: string = "https://api.syntx.dev ",
): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const response = await axios.get(`${baseUrl}/api/tags`, { headers })

		// Handle different response formats as mentioned in the feature guide
		let modelList: string[] = []

		if (response.data && Array.isArray(response.data.models)) {
			modelList = response.data.models.map((model: any) => model.id || model.name)
		} else if (response.data && typeof response.data === "object") {
			modelList = Object.keys(response.data)
		} else {
			// Fallback models
			modelList = ["deepseek-v3", "claude-sonnet-4", "perplexity-sonar"]
		}

		// Convert model list to ModelRecord format
		for (const modelId of modelList) {
			const modelInfo: ModelInfo = {
				maxTokens: 8192, // Default max tokens
				contextWindow: 128000, // Default context window
				supportsImages: false, // Default to false
				supportsPromptCache: false,
				supportsComputerUse: false,
				inputPrice: undefined, // Will be calculated by the server
				outputPrice: undefined,
				cacheWritesPrice: undefined,
				cacheReadsPrice: undefined,
			}

			// Set specific properties for known models
			switch (true) {
				case modelId.includes("claude"):
					modelInfo.maxTokens = 8192
					modelInfo.contextWindow = 200000
					modelInfo.supportsImages = true
					modelInfo.supportsPromptCache = true
					break
				case modelId.includes("deepseek"):
					modelInfo.maxTokens = 8192
					modelInfo.contextWindow = 64000
					break
				case modelId.includes("gemini"):
					modelInfo.maxTokens = 8192
					modelInfo.contextWindow = 1000000
					modelInfo.supportsImages = true
					break
				case modelId.includes("perplexity") || modelId.includes("sonar"):
					modelInfo.maxTokens = 4096
					modelInfo.contextWindow = 8000
					break
				default:
					break
			}

			models[modelId] = modelInfo
		}
	} catch (error) {
		console.error(`Error fetching SyntX models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)

		// Return default models on error
		const defaultModels = ["deepseek-v3", "claude-sonnet-4", "perplexity-sonar"]
		for (const modelId of defaultModels) {
			models[modelId] = {
				maxTokens: 8192,
				contextWindow: 64000,
				supportsImages: false,
				supportsPromptCache: false,
				supportsComputerUse: false,
				inputPrice: undefined,
				outputPrice: undefined,
				cacheWritesPrice: undefined,
				cacheReadsPrice: undefined,
			}
		}
	}

	return models
}
