import { Anthropic } from "@anthropic-ai/sdk"
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/streaming"
import type { MessageParam, TextBlockParam, RawMessageStreamEvent } from "@anthropic-ai/sdk/resources"

import {
	anthropicDefaultModelId,
	AnthropicModelId,
	anthropicModels,
	ApiHandlerOptions,
	ModelInfo,
} from "../../shared/api"

import { ApiStream } from "../transform/stream"

import { SingleCompletionHandler, getModelParams } from "../index"
import { BaseProvider } from "./base-provider"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "./constants"

export class AnthropicHandler extends BaseProvider implements SingleCompletionHandler {
	private options: ApiHandlerOptions
	private client: Anthropic

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const apiKeyFieldName =
			this.options.anthropicBaseUrl && this.options.anthropicUseAuthToken ? "authToken" : "apiKey"

		this.client = new Anthropic({
			baseURL: this.options.anthropicBaseUrl || undefined,
			[apiKeyFieldName]: this.options.apiKey,
		})
	}

	async *createMessage(systemPrompt: string, messages: MessageParam[]): ApiStream {
		let stream: AnthropicStream<RawMessageStreamEvent>
		let { id: modelId, maxTokens, thinking, temperature, virtualId } = this.getModel()

		let system: TextBlockParam[]
		let requestOptions: object | undefined = undefined

		switch (modelId) {
			case "claude-3-7-sonnet-20250219":
			case "claude-3-5-sonnet-20241022":
			case "claude-3-5-haiku-20241022":
			case "claude-3-opus-20240229":
			case "claude-3-haiku-20240307": {
				system = [{ text: systemPrompt, type: "text", cache_control: { type: "ephemeral" } }]
				addCacheBreakpoints(messages)
				requestOptions =
					virtualId === "claude-3-7-sonnet-20250219:thinking"
						? { headers: { "anthropic-beta": ["output-128k-2025-02-19"] } }
						: undefined
				break
			}
			default: {
				system = [{ text: systemPrompt, type: "text" }]
				break
			}
		}

		stream = await this.client.messages.create(
			{
				model: modelId,
				max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
				temperature,
				thinking,
				system,
				messages,
				stream: true,
			},
			requestOptions,
		)

		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start":
					// Tells us cache reads/writes/input/output.
					const usage = chunk.message.usage

					yield {
						type: "usage",
						inputTokens: usage.input_tokens || 0,
						outputTokens: usage.output_tokens || 0,
						cacheWriteTokens: usage.cache_creation_input_tokens || undefined,
						cacheReadTokens: usage.cache_read_input_tokens || undefined,
					}

					break
				case "message_delta":
					// Tells us stop_reason, stop_sequence, and output tokens
					// along the way and at the end of the message.
					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage.output_tokens || 0,
					}

					break
				case "message_stop":
					// No usage data, just an indicator that the message is done.
					break
				case "content_block_start":
					switch (chunk.content_block.type) {
						case "thinking":
							// We may receive multiple text blocks, in which
							// case just insert a line break between them.
							if (chunk.index > 0) {
								yield { type: "reasoning", text: "\n" }
							}

							yield { type: "reasoning", text: chunk.content_block.thinking }
							break
						case "text":
							// We may receive multiple text blocks, in which
							// case just insert a line break between them.
							if (chunk.index > 0) {
								yield { type: "text", text: "\n" }
							}

							yield { type: "text", text: chunk.content_block.text }
							break
					}
					break
				case "content_block_delta":
					switch (chunk.delta.type) {
						case "thinking_delta":
							yield { type: "reasoning", text: chunk.delta.thinking }
							break
						case "text_delta":
							yield { type: "text", text: chunk.delta.text }
							break
					}

					break
				case "content_block_stop":
					break
			}
		}
	}

	getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in anthropicModels ? (modelId as AnthropicModelId) : anthropicDefaultModelId
		const info: ModelInfo = anthropicModels[id]

		// Track the original model ID for special variant handling.
		const virtualId = id

		// The `:thinking` variant is a virtual identifier for the
		// `claude-3-7-sonnet-20250219` model with a thinking budget.
		// We can handle this more elegantly in the future.
		if (id === "claude-3-7-sonnet-20250219:thinking") {
			id = "claude-3-7-sonnet-20250219"
		}

		return {
			id,
			info,
			virtualId, // Include the original ID to use for header selection.
			...getModelParams({ options: this.options, model: info, defaultMaxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS }),
		}
	}

	async completePrompt(prompt: string) {
		let { id: model, temperature } = this.getModel()

		const message = await this.client.messages.create({
			model,
			max_tokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
			thinking: undefined,
			temperature,
			messages: [{ role: "user", content: prompt }],
			stream: false,
		})

		const content = message.content.find(({ type }) => type === "text")
		return content?.type === "text" ? content.text : ""
	}

	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			const { id: model } = this.getModel()

			const response = await this.client.messages.countTokens({
				model,
				messages: [{ role: "user", content: content }],
			})

			return response.input_tokens
		} catch (error) {
			console.warn("Anthropic token counting failed, using fallback", error)
			return super.countTokens(content)
		}
	}
}

// Using the cache_control parameter, you can define up to 4 cache breakpoints,
// allowing you to cache different reusable sections separately. For each
// breakpoint, the system will automatically check for cache hits at previous
// positions and use the longest matching prefix if one is found.
//
// https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
//
// The latest message will be the new user message, one before will be the
// assistant message from a previous request, and the user message before that
// will be a previously cached user message. So we need to mark the latest user
// message as ephemeral to cache it for the next request, and mark the second to
// last user message as ephemeral to let the server know the last message to
// retrieve from the cache for the current request.
//
// The system message will always have a cache breakpoint set.
const addCacheBreakpoints = (messages: Anthropic.Messages.MessageParam[]): void => {
	let userMessagesFound = 0

	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i]

		if (msg.role !== "user") {
			continue
		}

		if (typeof msg.content === "string") {
			msg.content = [{ type: "text" as const, text: msg.content, cache_control: { type: "ephemeral" as const } }]
		} else if (Array.isArray(msg.content)) {
			let lastTextPart: TextBlockParam | undefined

			for (let j = msg.content.length - 1; j >= 0; j--) {
				const part = msg.content[j]

				if (part.type === "text") {
					lastTextPart = part
					break
				}
			}

			if (lastTextPart) {
				lastTextPart.cache_control = { type: "ephemeral" as const }
			} else {
				msg.content.push({ type: "text" as const, text: "...", cache_control: { type: "ephemeral" as const } })
			}
		}

		userMessagesFound++

		// Stop after finding and modifying the last two user messages.
		if (userMessagesFound === 2) {
			break
		}
	}
}
