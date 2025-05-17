import OpenAI from "openai"

import { ApiHandlerOptions, RouterName, ModelRecord, ModelInfo } from "../../shared/api"
import { BaseProvider } from "./base-provider"
import { getModels } from "./fetchers/modelCache"

type RouterProviderOptions = {
	name: RouterName
	baseURL: string
	apiKey?: string
	modelId?: string
	defaultModelId: string
	defaultModelInfo: ModelInfo
	options: ApiHandlerOptions
}

export abstract class RouterProvider extends BaseProvider {
	protected readonly options: ApiHandlerOptions
	protected readonly name: RouterName
	protected readonly baseURL: string
	protected readonly apiKey: string
	protected models: ModelRecord = {}
	protected readonly modelId?: string
	protected readonly defaultModelId: string
	protected readonly defaultModelInfo: ModelInfo
	protected readonly client: OpenAI

	constructor({
		options,
		name,
		baseURL,
		apiKey = "not-provided",
		modelId,
		defaultModelId,
		defaultModelInfo,
	}: RouterProviderOptions) {
		super()

		this.options = options
		this.name = name
		this.modelId = modelId
		this.defaultModelId = defaultModelId
		this.defaultModelInfo = defaultModelInfo
		this.baseURL = baseURL
		this.apiKey = apiKey

		this.client = new OpenAI({
			baseURL,
			apiKey,
		})
	}

	public async fetchModel() {
		this.models = await getModels(this.name, this.apiKey, this.baseURL)
		return this.getModel()
	}

	override getModel(): { id: string; info: ModelInfo } {
		// Try user-specified model first
		if (this.modelId && this.models[this.modelId]) {
			return { id: this.modelId, info: this.models[this.modelId] }
		}

		// Try default model with fetched info
		if (this.models[this.defaultModelId]) {
			return { id: this.defaultModelId, info: this.models[this.defaultModelId] }
		}

		// Fallback to default model with static info
		return { id: this.defaultModelId, info: this.defaultModelInfo }
	}

	protected supportsTemperature(modelId: string): boolean {
		return !modelId.startsWith("openai/o3-mini")
	}
}
