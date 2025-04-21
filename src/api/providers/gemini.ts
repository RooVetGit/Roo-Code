import type { Anthropic } from "@anthropic-ai/sdk"
import {
	GoogleGenAI,
	ThinkingConfig,
	type GenerateContentResponseUsageMetadata,
	type GenerateContentParameters,
	type Content,
} from "@google/genai"

import { SingleCompletionHandler } from "../"
import type { ApiHandlerOptions, GeminiModelId, ModelInfo } from "../../shared/api"
import { geminiDefaultModelId, geminiModels } from "../../shared/api"
import { convertAnthropicContentToGemini, convertAnthropicMessageToGemini } from "../transform/gemini-format"
import type { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"

export class GeminiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: GoogleGenAI
	private contentCaches: Map<string, string>

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.client = new GoogleGenAI({ apiKey: options.geminiApiKey ?? "not-provided" })
		this.contentCaches = new Map()
	}

	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		taskId?: string,
	): ApiStream {
		const { id: model, thinkingConfig, maxOutputTokens, supportsPromptCache } = this.getModel()

		const contents = messages.map(convertAnthropicMessageToGemini)
		let uncachedContent: Content | undefined = undefined
		let cachedContent: string | undefined = undefined
		let cacheWriteTokens: number = 0

		// https://ai.google.dev/gemini-api/docs/caching?lang=node
		if (supportsPromptCache && taskId) {
			cachedContent = this.contentCaches.get(taskId)

			if (cachedContent) {
				uncachedContent = convertAnthropicMessageToGemini(messages[messages.length - 1])
			}

			const updatedCachedContent = await this.client.caches.create({
				model,
				config: { contents, systemInstruction, ttl: "300s" },
			})

			if (updatedCachedContent.name) {
				this.contentCaches.set(taskId, updatedCachedContent.name)
				cacheWriteTokens = updatedCachedContent.usageMetadata?.totalTokenCount ?? 0
			}
		}

		const params: GenerateContentParameters = {
			model,
			contents: uncachedContent ?? contents,
			config: {
				cachedContent,
				systemInstruction: cachedContent ? undefined : systemInstruction,
				httpOptions: this.options.googleGeminiBaseUrl
					? { baseUrl: this.options.googleGeminiBaseUrl }
					: undefined,
				thinkingConfig,
				maxOutputTokens,
				temperature: this.options.modelTemperature ?? 0,
			},
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
			const cachedInputTokens = lastUsageMetadata.cachedContentTokenCount ?? 0
			const outputTokens = lastUsageMetadata.candidatesTokenCount ?? 0

			yield {
				type: "usage",
				inputTokens: inputTokens - cachedInputTokens,
				outputTokens,
				cacheWriteTokens,
				cacheReadTokens: cachedInputTokens,
			}
		}
	}

	override getModel(): {
		id: GeminiModelId
		info: ModelInfo
		thinkingConfig?: ThinkingConfig
		maxOutputTokens?: number
		supportsPromptCache?: boolean
	} {
		let id = this.options.apiModelId ? (this.options.apiModelId as GeminiModelId) : geminiDefaultModelId
		let info: ModelInfo = geminiModels[id]

		if (id?.endsWith(":thinking")) {
			id = id.slice(0, -":thinking".length) as GeminiModelId

			if (geminiModels[id]) {
				info = geminiModels[id]

				return {
					id,
					info,
					thinkingConfig: this.options.modelMaxThinkingTokens
						? { thinkingBudget: this.options.modelMaxThinkingTokens }
						: undefined,
					maxOutputTokens: this.options.modelMaxTokens ?? info.maxTokens ?? undefined,
					supportsPromptCache: info.supportsPromptCache,
				}
			}
		}

		if (!info) {
			id = geminiDefaultModelId
			info = geminiModels[geminiDefaultModelId]
		}

		return { id, info, supportsPromptCache: info.supportsPromptCache }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const { id: model } = this.getModel()

			const result = await this.client.models.generateContent({
				model,
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				config: {
					httpOptions: this.options.googleGeminiBaseUrl
						? { baseUrl: this.options.googleGeminiBaseUrl }
						: undefined,
					temperature: this.options.modelTemperature ?? 0,
				},
			})

			return result.text ?? ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Gemini completion error: ${error.message}`)
			}

			throw error
		}
	}

	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			const { id: model } = this.getModel()

			const response = await this.client.models.countTokens({
				model,
				contents: convertAnthropicContentToGemini(content),
			})

			if (response.totalTokens === undefined) {
				console.warn("Gemini token counting returned undefined, using fallback")
				return super.countTokens(content)
			}

			return response.totalTokens
		} catch (error) {
			console.warn("Gemini token counting failed, using fallback", error)
			return super.countTokens(content)
		}
	}
}
