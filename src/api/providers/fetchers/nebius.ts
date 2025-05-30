import axios from "axios"
import { OPEN_ROUTER_COMPUTER_USE_MODELS, ModelRecord } from "../../../shared/api"
import { z } from 'zod'

/**
 * Nebius API response schemas
 */
const nebiusModelInfoSchema = z.object({
	max_tokens: z.number().optional(),
	max_input_tokens: z.number().optional(),
	supports_vision: z.boolean().optional(),
	supports_prompt_caching: z.boolean().optional(),
	input_cost_per_token: z.number().optional(),
	output_cost_per_token: z.number().optional(),
})

const nebiusModelSchema = z.object({
	model_name: z.string(),
	model_info: nebiusModelInfoSchema,
	nebius_params: z
		.object({
			model: z.string().optional(),
		})
		.optional(),
})

const nebiusModelsResponseSchema = z.object({
	data: z.array(nebiusModelSchema),
})

type NebiusModelsResponse = z.infer<typeof nebiusModelsResponseSchema>

/**
 * Fetches available models from a Nebius server
 *
 * @param apiKey The API key for the Nebius server
 * @param baseUrl The base URL of the Nebius server
 * @returns A promise that resolves to a record of model IDs to model info
 */
export async function getNebiusModels(apiKey: string, baseUrl: string): Promise<ModelRecord> {
	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const response = await axios.get<NebiusModelsResponse>(`${baseUrl}/v1/model/info`, { headers })
		const result = nebiusModelsResponseSchema.safeParse(response.data)

		if (!result.success) {
			console.error("Nebius models response is invalid", result.error.format())
			return {}
		}

		const models: ModelRecord = {}
		const computerModels = Array.from(OPEN_ROUTER_COMPUTER_USE_MODELS)

		// Process the model info from the response
		for (const model of result.data.data) {
			const modelName = model.model_name
			const modelInfo = model.model_info
			const nebiusModelName = model.nebius_params?.model

			if (!modelName || !modelInfo || !nebiusModelName) continue

			models[modelName] = {
				maxTokens: modelInfo.max_tokens || 8192,
				contextWindow: modelInfo.max_input_tokens || 200000,
				supportsImages: Boolean(modelInfo.supports_vision),
				// nebius_params.model may have a prefix like openrouter/
				supportsComputerUse: computerModels.some((computer_model) => nebiusModelName.endsWith(computer_model)),
				supportsPromptCache: Boolean(modelInfo.supports_prompt_caching),
				inputPrice: modelInfo.input_cost_per_token ? modelInfo.input_cost_per_token * 1000000 : undefined,
				outputPrice: modelInfo.output_cost_per_token ? modelInfo.output_cost_per_token * 1000000 : undefined,
				description: `${modelName} via Nebius proxy`,
			}
		}

		return models
	} catch (error) {
		console.error("Error fetching Nebius models:", error)
		return {}
	}
}
