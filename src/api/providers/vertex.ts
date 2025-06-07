import type { Anthropic } from "@anthropic-ai/sdk"
import {
	GoogleGenAI,
	type GenerateContentResponseUsageMetadata,
	type GenerateContentParameters,
	type GenerateContentConfig,
	CountTokensParameters,
} from "@google/genai"
import type { JWTInput } from "google-auth-library"

import { type ModelInfo, type VertexModelId, vertexDefaultModelId, vertexModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { safeJsonParse } from "../../shared/safeJsonParse"

import { getModelParams } from "../transform/model-params"
import { calculateCostGenai } from "../../utils/calculateCostGenai"
import { convertAnthropicContentToGemini, convertAnthropicMessageToGemini } from "../transform/gemini-format"
import type { ApiStream } from "../transform/stream"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"

export class VertexHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: GoogleGenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const project = this.options.vertexProjectId ?? "not-provided"
		const location = this.options.vertexRegion ?? "not-provided"

		if (this.options.vertexJsonCredentials) {
			this.client = new GoogleGenAI({
				vertexai: true,
				project,
				location,
				googleAuthOptions: {
					credentials: safeJsonParse<JWTInput>(this.options.vertexJsonCredentials, undefined),
				},
			})
		} else if (this.options.vertexKeyFile) {
			this.client = new GoogleGenAI({
				vertexai: true,
				project,
				location,
				googleAuthOptions: { keyFile: this.options.vertexKeyFile },
			})
		} else if (this.options.vertexApiKey) {
			this.client = new GoogleGenAI({
				vertexai: true,
				apiKey: this.options.vertexApiKey,
				apiVersion: "v1",
			})
		} else {
			this.client = new GoogleGenAI({ vertexai: true, project, location })
		}
	}
	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: model, reasoning: thinkingConfig, maxTokens: maxOutputTokens, info } = this.getModel()

		const contents = messages.map(convertAnthropicMessageToGemini)

		const config: GenerateContentConfig = {
			systemInstruction,
			thinkingConfig,
			maxOutputTokens,
			temperature: this.options.modelTemperature ?? 0,
		}

		const params: GenerateContentParameters = { model, contents, config }

		if (this.options.vertexApiKey && this.options.vertexProjectId) {
			params.model = `projects/${this.options.vertexProjectId}/locations/${this.options.vertexRegion}/publishers/google/models/${model}`
		}

		const result = await this.client.models.generateContentStream(params)

		let lastUsageMetadata: GenerateContentResponseUsageMetadata | undefined

		for await (const chunk of result) {
			if (chunk.text) {
				yield { type: "text", text: chunk.text }
			}

			if (chunk.usageMetadata) {
				lastUsageMetadata = chunk.usageMetadata
			}
		}

		if (lastUsageMetadata) {
			const inputTokens = lastUsageMetadata.promptTokenCount ?? 0
			const outputTokens = lastUsageMetadata.candidatesTokenCount ?? 0
			const cacheReadTokens = lastUsageMetadata.cachedContentTokenCount
			const reasoningTokens = lastUsageMetadata.thoughtsTokenCount

			yield {
				type: "usage",
				inputTokens,
				outputTokens,
				cacheReadTokens,
				reasoningTokens,
				totalCost: calculateCostGenai({ info, inputTokens, outputTokens, cacheReadTokens }),
			}
		}
	}

	getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in vertexModels ? (modelId as VertexModelId) : vertexDefaultModelId
		const info: ModelInfo = vertexModels[id]
		const params = getModelParams({ format: "gemini", modelId: id, model: info, settings: this.options })

		// The `:thinking` suffix indicates that the model is a "Hybrid"
		// reasoning model and that reasoning is required to be enabled.
		// The actual model ID honored by Gemini's API does not have this
		// suffix.
		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const { id: model } = this.getModel()

			const params: GenerateContentParameters = {
				model,
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				config: {
					temperature: this.options.modelTemperature ?? 0,
				},
			}

			if (this.options.vertexApiKey && this.options.vertexProjectId) {
				params.model = `projects/${this.options.vertexProjectId}/locations/${this.options.vertexRegion}/publishers/google/models/${model}`
			}

			const result = await this.client.models.generateContent(params)

			return result.text ?? ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Vertex completion error: ${error.message}`)
			}

			throw error
		}
	}

	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			const { id: model } = this.getModel()

			const params: CountTokensParameters = {
				model,
				contents: convertAnthropicContentToGemini(content),
			}

			if (this.options.vertexApiKey && this.options.vertexProjectId) {
				params.model = `projects/${this.options.vertexProjectId}/locations/${this.options.vertexRegion}/publishers/google/models/${model}`
			}

			const response = await this.client.models.countTokens(params)

			if (response.totalTokens === undefined) {
				console.warn("Vertex token counting returned undefined, using fallback")
				return super.countTokens(content)
			}

			return response.totalTokens
		} catch (error) {
			console.warn("Vertex token counting failed, using fallback", error)
			return super.countTokens(content)
		}
	}
	public destruct() {}
}
