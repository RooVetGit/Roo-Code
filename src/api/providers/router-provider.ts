import OpenAI from "openai"

import { ApiHandlerOptions, ModelInfo } from "../../shared/api"
import { BaseProvider } from "./base-provider"
import { RouterName, ModelRecord, getModels } from "./fetchers/cache"

type RouterProviderOptions = {
	name: RouterName
	baseURL: string
	apiKey?: string
	modelId: string
	defaultModelInfo: ModelInfo
	options: ApiHandlerOptions
}

export abstract class RouterProvider extends BaseProvider {
	protected readonly options: ApiHandlerOptions
	protected readonly name: RouterName
	protected models: ModelRecord = {}
	protected readonly modelId: string
	protected readonly defaultModelInfo: ModelInfo
	protected readonly client: OpenAI

	constructor({ options, name, baseURL, apiKey = "not-provided", modelId, defaultModelInfo }: RouterProviderOptions) {
		super()

		this.options = options
		this.name = name
		this.modelId = modelId
		this.defaultModelInfo = defaultModelInfo

		this.client = new OpenAI({ baseURL, apiKey })
	}

	protected async fetchModel() {
		this.models = await getModels(this.name)
		return this.getModel()
	}

	override getModel(): { id: string; info: ModelInfo } {
		return { id: this.modelId, info: this.models[this.modelId] ?? this.defaultModelInfo }
	}

	protected supportsTemperature(modelId: string): boolean {
		return !modelId.startsWith("openai/o3-mini")
	}
}
