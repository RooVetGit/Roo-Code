import OpenAI from "openai"
import { openAiNativeDefaultModelId, openAiNativeModels } from "../../shared"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { BaseProvider } from "./base-provider"
import { calculateApiCostOpenAI } from "../../utils/cost"
const OPENAI_NATIVE_DEFAULT_TEMPERATURE = 0
export class OpenAiNativeHandler extends BaseProvider {
	options
	client
	constructor(options) {
		super()
		this.options = options
		const apiKey = this.options.openAiNativeApiKey ?? "not-provided"
		this.client = new OpenAI({ apiKey })
	}
	async *createMessage(systemPrompt, messages) {
		const model = this.getModel()
		if (model.id.startsWith("o1")) {
			yield* this.handleO1FamilyMessage(model, systemPrompt, messages)
			return
		}
		if (model.id.startsWith("o3-mini")) {
			yield* this.handleO3FamilyMessage(model, systemPrompt, messages)
			return
		}
		yield* this.handleDefaultModelMessage(model, systemPrompt, messages)
	}
	async *handleO1FamilyMessage(model, systemPrompt, messages) {
		// o1 supports developer prompt with formatting
		// o1-preview and o1-mini only support user messages
		const isOriginalO1 = model.id === "o1"
		const response = await this.client.chat.completions.create({
			model: model.id,
			messages: [
				{
					role: isOriginalO1 ? "developer" : "user",
					content: isOriginalO1 ? `Formatting re-enabled\n${systemPrompt}` : systemPrompt,
				},
				...convertToOpenAiMessages(messages),
			],
			stream: true,
			stream_options: { include_usage: true },
		})
		yield* this.handleStreamResponse(response, model)
	}
	async *handleO3FamilyMessage(model, systemPrompt, messages) {
		const stream = await this.client.chat.completions.create({
			model: "o3-mini",
			messages: [
				{
					role: "developer",
					content: `Formatting re-enabled\n${systemPrompt}`,
				},
				...convertToOpenAiMessages(messages),
			],
			stream: true,
			stream_options: { include_usage: true },
			reasoning_effort: this.getModel().info.reasoningEffort,
		})
		yield* this.handleStreamResponse(stream, model)
	}
	async *handleDefaultModelMessage(model, systemPrompt, messages) {
		const stream = await this.client.chat.completions.create({
			model: model.id,
			temperature: this.options.modelTemperature ?? OPENAI_NATIVE_DEFAULT_TEMPERATURE,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
		})
		yield* this.handleStreamResponse(stream, model)
	}
	async *yieldResponseData(response) {
		yield {
			type: "text",
			text: response.choices[0]?.message.content || "",
		}
		yield {
			type: "usage",
			inputTokens: response.usage?.prompt_tokens || 0,
			outputTokens: response.usage?.completion_tokens || 0,
		}
	}
	async *handleStreamResponse(stream, model) {
		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}
			if (chunk.usage) {
				yield* this.yieldUsage(model.info, chunk.usage)
			}
		}
	}
	async *yieldUsage(info, usage) {
		const inputTokens = usage?.prompt_tokens || 0 // sum of cache hits and misses
		const outputTokens = usage?.completion_tokens || 0
		const cacheReadTokens = usage?.prompt_tokens_details?.cached_tokens || 0
		const cacheWriteTokens = 0
		const totalCost = calculateApiCostOpenAI(info, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
		const nonCachedInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)
		yield {
			type: "usage",
			inputTokens: nonCachedInputTokens,
			outputTokens: outputTokens,
			cacheWriteTokens: cacheWriteTokens,
			cacheReadTokens: cacheReadTokens,
			totalCost: totalCost,
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in openAiNativeModels) {
			const id = modelId
			return { id, info: openAiNativeModels[id] }
		}
		return { id: openAiNativeDefaultModelId, info: openAiNativeModels[openAiNativeDefaultModelId] }
	}
	async completePrompt(prompt) {
		try {
			const model = this.getModel()
			let requestOptions
			if (model.id.startsWith("o1")) {
				requestOptions = this.getO1CompletionOptions(model, prompt)
			} else if (model.id.startsWith("o3-mini")) {
				requestOptions = this.getO3CompletionOptions(model, prompt)
			} else {
				requestOptions = this.getDefaultCompletionOptions(model, prompt)
			}
			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI Native completion error: ${error.message}`)
			}
			throw error
		}
	}
	getO1CompletionOptions(model, prompt) {
		return {
			model: model.id,
			messages: [{ role: "user", content: prompt }],
		}
	}
	getO3CompletionOptions(model, prompt) {
		return {
			model: "o3-mini",
			messages: [{ role: "user", content: prompt }],
			reasoning_effort: this.getModel().info.reasoningEffort,
		}
	}
	getDefaultCompletionOptions(model, prompt) {
		return {
			model: model.id,
			messages: [{ role: "user", content: prompt }],
			temperature: this.options.modelTemperature ?? OPENAI_NATIVE_DEFAULT_TEMPERATURE,
		}
	}
}
//# sourceMappingURL=openai-native.js.map
