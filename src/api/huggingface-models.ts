import { getHuggingFaceModels as fetchModels, type HuggingFaceModel } from "./providers/fetchers/huggingface"
import type { ModelRecord } from "../shared/api"

export interface HuggingFaceModelsResponse {
	models: HuggingFaceModel[]
	cached: boolean
	timestamp: number
}

export async function getHuggingFaceModels(): Promise<HuggingFaceModelsResponse> {
	// Fetch models as ModelRecord
	const modelRecord = await fetchModels()

	// Convert ModelRecord to array of HuggingFaceModel for backward compatibility
	// Note: This is a temporary solution to maintain API compatibility
	const models: HuggingFaceModel[] = Object.entries(modelRecord).map(([id, info]) => ({
		id,
		object: "model" as const,
		created: Date.now(),
		owned_by: "huggingface",
		providers: [
			{
				provider: "auto",
				status: "live" as const,
				context_length: info.contextWindow,
				pricing:
					info.inputPrice && info.outputPrice
						? {
								input: info.inputPrice,
								output: info.outputPrice,
							}
						: undefined,
			},
		],
	}))

	return {
		models,
		cached: false,
		timestamp: Date.now(),
	}
}
