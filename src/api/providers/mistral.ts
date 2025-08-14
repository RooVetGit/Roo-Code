import { Anthropic } from "@anthropic-ai/sdk"
import { Mistral } from "@mistralai/mistralai"

import { type MistralModelId, mistralDefaultModelId, mistralModels, MISTRAL_DEFAULT_TEMPERATURE } from "@roo-code/types"

import { ApiHandlerOptions } from "../../shared/api"

import { convertToMistralMessages } from "../transform/mistral-format"
import { ApiStream } from "../transform/stream"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

// Define TypeScript interfaces for Mistral content types
interface MistralTextContent {
	type: "text"
	text: string
}

interface MistralThinkingContent {
	type: "thinking"
	text: string
}

type MistralContent = MistralTextContent | MistralThinkingContent | string

export class MistralHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: Mistral

	constructor(options: ApiHandlerOptions) {
		super()

		if (!options.mistralApiKey) {
			throw new Error("Mistral API key is required")
		}

		// Set default model ID if not provided.
		const apiModelId = options.apiModelId || mistralDefaultModelId
		this.options = { ...options, apiModelId }

		this.client = new Mistral({
			serverURL: apiModelId.startsWith("codestral-")
				? this.options.mistralCodestralUrl || "https://codestral.mistral.ai"
				: "https://api.mistral.ai",
			apiKey: this.options.mistralApiKey,
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: model, maxTokens, temperature } = this.getModel()

		const response = await this.client.chat.stream({
			model,
			messages: [{ role: "system", content: systemPrompt }, ...convertToMistralMessages(messages)],
			maxTokens,
			temperature,
		})

		for await (const chunk of response) {
			const delta = chunk.data.choices[0]?.delta

			if (delta?.content) {
				if (typeof delta.content === "string") {
					// Handle string content as text
					yield { type: "text", text: delta.content }
				} else if (Array.isArray(delta.content)) {
					// Handle array of content blocks
					for (const c of delta.content as MistralContent[]) {
						if (typeof c === "object" && c !== null) {
							if (c.type === "thinking" && c.text) {
								// Handle thinking content as reasoning chunks
								yield { type: "reasoning", text: c.text }
							} else if (c.type === "text" && c.text) {
								// Handle text content normally
								yield { type: "text", text: c.text }
							}
						}
					}
				}
			}

			if (chunk.data.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.data.usage.promptTokens || 0,
					outputTokens: chunk.data.usage.completionTokens || 0,
				}
			}
		}
	}

	override getModel() {
		const id = this.options.apiModelId ?? mistralDefaultModelId
		const info = mistralModels[id as MistralModelId] ?? mistralModels[mistralDefaultModelId]

		// @TODO: Move this to the `getModelParams` function.
		const maxTokens = this.options.includeMaxTokens ? info.maxTokens : undefined
		const temperature = this.options.modelTemperature ?? MISTRAL_DEFAULT_TEMPERATURE

		return { id, info, maxTokens, temperature }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const { id: model, temperature } = this.getModel()

			const response = await this.client.chat.complete({
				model,
				messages: [{ role: "user", content: prompt }],
				temperature,
			})

			const content = response.choices?.[0]?.message.content

			if (Array.isArray(content)) {
				// Only return text content, filter out thinking content for non-streaming
				return content
					.filter((c: MistralContent) => typeof c === "object" && c.type === "text")
					.map((c: MistralContent) => (c as MistralTextContent).text || "")
					.join("")
			}

			return content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Mistral completion error: ${error.message}`)
			}

			throw error
		}
	}
}
