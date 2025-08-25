import axios from "axios"
import { ModelInfo, ollamaDefaultModelInfo } from "@roo-code/types"
import { z } from "zod"

const OllamaModelDetailsSchema = z.object({
	family: z.string(),
	families: z.array(z.string()).nullable().optional(),
	format: z.string().optional(),
	parameter_size: z.string(),
	parent_model: z.string().optional(),
	quantization_level: z.string().optional(),
})

const OllamaModelSchema = z.object({
	details: OllamaModelDetailsSchema,
	digest: z.string().optional(),
	model: z.string(),
	modified_at: z.string().optional(),
	name: z.string(),
	size: z.number().optional(),
})

const OllamaModelInfoResponseSchema = z.object({
	modelfile: z.string().optional(),
	parameters: z.string().optional(),
	template: z.string().optional(),
	details: OllamaModelDetailsSchema,
	model_info: z.record(z.string(), z.any()),
	capabilities: z.array(z.string()).optional(),
})

const OllamaModelsResponseSchema = z.object({
	models: z.array(OllamaModelSchema),
})

type OllamaModelsResponse = z.infer<typeof OllamaModelsResponseSchema>

type OllamaModelInfoResponse = z.infer<typeof OllamaModelInfoResponseSchema>

export const parseOllamaModel = (rawModel: OllamaModelInfoResponse): ModelInfo => {
	const contextKey = Object.keys(rawModel.model_info).find((k) => k.includes("context_length"))
	const defaultContextWindow =
		contextKey && typeof rawModel.model_info[contextKey] === "number" ? rawModel.model_info[contextKey] : undefined

	// Parse the parameters field to check for user-configured num_ctx
	let configuredNumCtx: number | undefined
	if (rawModel.parameters) {
		// The parameters field contains modelfile parameters as a string
		// Look for num_ctx setting in the format "num_ctx <value>"
		const numCtxMatch = rawModel.parameters.match(/num_ctx\s+(\d+)/i)
		if (numCtxMatch && numCtxMatch[1]) {
			configuredNumCtx = parseInt(numCtxMatch[1], 10)
		}
	}

	// Use the configured num_ctx if available, otherwise fall back to the default
	const actualContextWindow = configuredNumCtx || defaultContextWindow || ollamaDefaultModelInfo.contextWindow

	const modelInfo: ModelInfo = Object.assign({}, ollamaDefaultModelInfo, {
		description: `Family: ${rawModel.details.family}, Context: ${actualContextWindow}, Size: ${rawModel.details.parameter_size}`,
		contextWindow: actualContextWindow,
		supportsPromptCache: true,
		supportsImages: rawModel.capabilities?.includes("vision"),
		supportsComputerUse: false,
		maxTokens: actualContextWindow,
	})

	return modelInfo
}

export async function getOllamaModels(baseUrl = "http://localhost:11434"): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	// clearing the input can leave an empty string; use the default in that case
	baseUrl = baseUrl === "" ? "http://localhost:11434" : baseUrl

	try {
		if (!URL.canParse(baseUrl)) {
			return models
		}

		const response = await axios.get<OllamaModelsResponse>(`${baseUrl}/api/tags`)
		const parsedResponse = OllamaModelsResponseSchema.safeParse(response.data)
		let modelInfoPromises = []

		if (parsedResponse.success) {
			for (const ollamaModel of parsedResponse.data.models) {
				modelInfoPromises.push(
					axios
						.post<OllamaModelInfoResponse>(`${baseUrl}/api/show`, {
							model: ollamaModel.model,
						})
						.then((ollamaModelInfo) => {
							models[ollamaModel.name] = parseOllamaModel(ollamaModelInfo.data)
						}),
				)
			}

			await Promise.all(modelInfoPromises)
		} else {
			console.error(`Error parsing Ollama models response: ${JSON.stringify(parsedResponse.error, null, 2)}`)
		}
	} catch (error) {
		if (error.code === "ECONNREFUSED") {
			console.warn(`Failed connecting to Ollama at ${baseUrl}`)
		} else {
			console.error(
				`Error fetching Ollama models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}
	}

	return models
}
