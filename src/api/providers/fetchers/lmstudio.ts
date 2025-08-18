import { ModelInfo, lMStudioDefaultModelInfo } from "@roo-code/types"
import { LLM, LLMInfo, LLMInstanceInfo, LMStudioClient } from "@lmstudio/sdk"
import axios from "axios"
import { flushModels, getModels } from "./modelCache"

const modelsWithLoadedDetails = new Set<string>()

export const hasLoadedFullDetails = (modelId: string): boolean => {
	return modelsWithLoadedDetails.has(modelId)
}

export const forceFullModelDetailsLoad = async (baseUrl: string, modelId: string): Promise<void> => {
	try {
		// test the connection to LM Studio first
		// errors will be caught further down
		await axios.get(`${baseUrl}/v1/models`)
		const lmsUrl = baseUrl.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://")

		const client = new LMStudioClient({ baseUrl: lmsUrl })
		await client.llm.model(modelId)
		await flushModels("lmstudio")
		await getModels({ provider: "lmstudio" }) // force cache update now

		// Mark this model as having full details loaded
		modelsWithLoadedDetails.add(modelId)
	} catch (error) {
		if (error.code === "ECONNREFUSED") {
			console.warn(`Error connecting to LMStudio at ${baseUrl}`)
		} else {
			console.error(
				`Error refreshing LMStudio model details: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}
	}
}

export const parseLMStudioModel = (rawModel: LLMInstanceInfo | LLMInfo): ModelInfo => {
	// Handle both LLMInstanceInfo (from loaded models) and LLMInfo (from downloaded models)
	const contextLength = "contextLength" in rawModel ? rawModel.contextLength : rawModel.maxContextLength

	const modelInfo: ModelInfo = Object.assign({}, lMStudioDefaultModelInfo, {
		description: `${rawModel.displayName} - ${rawModel.path}`,
		contextWindow: contextLength,
		supportsPromptCache: true,
		supportsImages: rawModel.vision,
		supportsComputerUse: false,
		maxTokens: contextLength,
	})

	return modelInfo
}

export async function getLMStudioModels(baseUrl = "http://localhost:1234"): Promise<Record<string, ModelInfo>> {
	// clear the set of models that have full details loaded
	modelsWithLoadedDetails.clear()
	// clearing the input can leave an empty string; use the default in that case
	baseUrl = baseUrl === "" ? "http://localhost:1234" : baseUrl

	const models: Record<string, ModelInfo> = {}
	// ws is required to connect using the LMStudio library
	const lmsUrl = baseUrl.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://")

	try {
		if (!URL.canParse(lmsUrl)) {
			return models
		}

		// test the connection to LM Studio first
		// errors will be caught further down
		await axios.get(`${baseUrl}/v1/models`)

		const client = new LMStudioClient({ baseUrl: lmsUrl })

		// First, try to get all downloaded models
		try {
			const downloadedModels = await client.system.listDownloadedModels("llm")
			for (const model of downloadedModels) {
				// Use the model path as the key since that's what users select
				models[model.path] = parseLMStudioModel(model)
			}
		} catch (error) {
			console.warn("Failed to list downloaded models, falling back to loaded models only")
		}

		// Get loaded models for their runtime info (context size)
		const loadedModels = (await client.llm.listLoaded().then((models: LLM[]) => {
			return Promise.all(models.map((m) => m.getModelInfo()))
		})) as Array<LLMInstanceInfo>

		// Deduplicate loaded models - only add if no existing key contains the model's identifier (case-insensitive)
		for (const lmstudioModel of loadedModels) {
			const modelIdentifier = lmstudioModel.modelKey.toLowerCase()

			// Check if any existing model key contains this loaded model's identifier
			const isDuplicate = Object.keys(models).some(
				(existingKey) =>
					existingKey.toLowerCase().includes(modelIdentifier) ||
					modelIdentifier.includes(existingKey.toLowerCase()),
			)

			if (!isDuplicate) {
				// Use modelKey for loaded models to maintain consistency
				models[lmstudioModel.modelKey] = parseLMStudioModel(lmstudioModel)
			} else {
				// If it's a duplicate, update the existing entry with loaded model info for better context data
				const existingKey = Object.keys(models).find(
					(key) => key.toLowerCase().includes(modelIdentifier) || modelIdentifier.includes(key.toLowerCase()),
				)
				if (existingKey) {
					// Update with loaded model data which has more accurate runtime info
					models[existingKey] = parseLMStudioModel(lmstudioModel)
				}
			}

			modelsWithLoadedDetails.add(lmstudioModel.modelKey)
		}
	} catch (error) {
		if (error.code === "ECONNREFUSED") {
			console.warn(`Error connecting to LMStudio at ${baseUrl}`)
		} else {
			console.error(
				`Error fetching LMStudio models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}
	}

	return models
}
