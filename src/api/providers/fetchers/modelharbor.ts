import { ModelInfo } from "@roo-code/types"

// Interface matching the ModelHarbor API response
interface ModelHarborApiModel {
	model_name: string
	litellm_params: {
		merge_reasoning_content_in_choices: boolean
		model: string
		weight?: number
		thinking?: {
			type: string
			budget_tokens: number
		}
	}
	model_info: {
		input_cost_per_token?: number
		output_cost_per_token?: number
		output_cost_per_reasoning_token?: number
		max_input_tokens?: number
		max_output_tokens?: number
		max_tokens?: number
		cache_read_input_token_cost?: number
		input_cost_per_token_batches?: number
		output_cost_per_token_batches?: number
		input_cost_per_token_above_200k_tokens?: number
		output_cost_per_token_above_200k_tokens?: number
		input_cost_per_audio_token?: number
		mode?: string
		supports_system_messages?: boolean
		supports_response_schema?: boolean
		supports_vision?: boolean
		supports_function_calling?: boolean
		supports_tool_choice?: boolean
		supports_assistant_prefill?: boolean
		supports_prompt_caching?: boolean
		supports_audio_input?: boolean
		supports_audio_output?: boolean
		supports_pdf_input?: boolean
		supports_embedding_image_input?: boolean
		supports_native_streaming?: boolean
		supports_web_search?: boolean
		supports_reasoning?: boolean
		supports_computer_use?: boolean
		tpm?: number
		rpm?: number
		supported_openai_params?: string[]
	}
}

interface ModelHarborApiResponse {
	data: ModelHarborApiModel[]
}

export async function getModelHarborModels(): Promise<Record<string, ModelInfo>> {
	try {
		console.log("🚀 Fetching ModelHarbor models from extension host...")
		const response = await fetch("https://api.modelharbor.com/v1/model/info")

		if (!response.ok) {
			throw new Error(`ModelHarbor API responded with status ${response.status}`)
		}

		const data: ModelHarborApiResponse = await response.json()
		console.log(`📊 Received ${data.data.length} model entries from ModelHarbor API`)

		// Transform ModelHarbor response to our ModelInfo format
		const models: Record<string, ModelInfo> = {}
		let processedCount = 0

		if (data.data && Array.isArray(data.data)) {
			for (const apiModel of data.data) {
				if (apiModel.model_name) {
					// Only process if we haven't seen this model name before (handle duplicates)
					if (!models[apiModel.model_name]) {
						const { model_info } = apiModel

						// Convert token costs to per-million token costs (multiply by 1,000,000)
						const inputPrice = model_info.input_cost_per_token
							? model_info.input_cost_per_token * 1000000
							: 0
						const outputPrice = model_info.output_cost_per_token
							? model_info.output_cost_per_token * 1000000
							: 0
						const cacheReadsPrice = model_info.cache_read_input_token_cost
							? model_info.cache_read_input_token_cost * 1000000
							: 0

						models[apiModel.model_name] = {
							maxTokens: model_info.max_output_tokens || model_info.max_tokens || 8192,
							contextWindow: model_info.max_input_tokens || 40960,
							supportsImages:
								model_info.supports_vision || model_info.supports_embedding_image_input || false,
							supportsComputerUse: model_info.supports_computer_use || false,
							supportsPromptCache: model_info.supports_prompt_caching || false,
							supportsReasoningBudget: apiModel.litellm_params.thinking?.type === "enabled" || false,
							requiredReasoningBudget: false,
							supportsReasoningEffort: model_info.supports_reasoning || false,
							inputPrice,
							outputPrice,
							cacheReadsPrice,
							description: `${apiModel.model_name} - ${model_info.mode || "chat"} model with ${model_info.max_input_tokens || "unknown"} input tokens`,
						}
						processedCount++
					}
				}
			}
		}

		// Sort model names alphabetically
		const sortedModels: Record<string, ModelInfo> = {}
		const sortedModelNames = Object.keys(models).sort()

		for (const modelName of sortedModelNames) {
			const modelInfo = models[modelName]
			if (modelInfo) {
				sortedModels[modelName] = modelInfo
			}
		}

		console.log(
			`✅ Successfully processed ${processedCount} unique ModelHarbor models out of ${data.data.length} entries`,
		)
		console.log(
			"Available models:",
			sortedModelNames.slice(0, 5).concat(sortedModelNames.length > 5 ? ["..."] : []),
		)

		return sortedModels
	} catch (error) {
		console.error("❌ Failed to fetch ModelHarbor models:", error)
		// Return empty object instead of throwing to allow graceful degradation
		return {}
	}
}
