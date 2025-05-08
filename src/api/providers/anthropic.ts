import { Anthropic } from "@anthropic-ai/sdk"
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/streaming"
import { CacheControlEphemeral } from "@anthropic-ai/sdk/resources"
import {
	anthropicDefaultModelId,
	AnthropicModelId,
	anthropicModels,
	ApiHandlerOptions,
	ModelInfo,
} from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import { ANTHROPIC_DEFAULT_MAX_TOKENS, CLAUDE_MAX_SAFE_TOKEN_LIMIT } from "./constants"
import { SingleCompletionHandler, getModelParams } from "../index"
import { truncateConversation } from "../../core/sliding-window"

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

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		let stream: AnthropicStream<Anthropic.Messages.RawMessageStreamEvent>
		const cacheControl: CacheControlEphemeral = { type: "ephemeral" }
		let { id: modelId, maxTokens, thinking, temperature, virtualId, info } = this.getModel()

		// Check token count before sending the request for all Anthropic models
		// Count tokens for the entire request
		const tokenCount = await this.countMessageTokens(systemPrompt, messages, modelId)

		// Get the context window size for the current model
		const contextWindow = info.contextWindow || 200000

		// Calculate a safe token limit (1k tokens below the context window)
		const safeTokenLimit = Math.min(contextWindow - 1000, CLAUDE_MAX_SAFE_TOKEN_LIMIT)

		// If token count exceeds the safe limit, truncate the conversation
		if (tokenCount > safeTokenLimit) {
			console.warn(
				`Token count (${tokenCount}) exceeds safe limit (${safeTokenLimit}) for model ${modelId}. Truncating conversation.`,
			)

			// Calculate how much we need to truncate
			const excessTokens = tokenCount - safeTokenLimit
			const totalTokens = tokenCount

			// Determine truncation fraction based on excess tokens
			// Start with 0.5 (50%) and increase if needed
			let truncationFraction = 0.5

			// If we're significantly over the limit, increase truncation
			if (excessTokens > totalTokens * 0.3) {
				truncationFraction = 0.7
			}

			// Truncate the conversation
			const originalLength = messages.length
			messages = truncateConversation(messages, truncationFraction)

			console.log(
				`Truncated conversation from ${originalLength} to ${messages.length} messages to fit within token limit.`,
			)

			// Verify token count after truncation
			const newTokenCount = await this.countMessageTokens(systemPrompt, messages, modelId)

			// If still over limit, truncate again with a higher fraction
			if (newTokenCount > safeTokenLimit) {
				console.warn(
					`After truncation, token count (${newTokenCount}) still exceeds safe limit. Truncating further.`,
				)

				messages = truncateConversation(messages, 0.8)

				// Final verification
				const finalTokenCount = await this.countMessageTokens(systemPrompt, messages, modelId)
				console.log(`Final token count after truncation: ${finalTokenCount}`)
			}
		}

		switch (modelId) {
			case "claude-3-7-sonnet-20250219":
			case "claude-3-5-sonnet-20241022":
			case "claude-3-5-haiku-20241022":
			case "claude-3-opus-20240229":
			case "claude-3-haiku-20240307": {
				/**
				 * The latest message will be the new user message, one before
				 * will be the assistant message from a previous request, and
				 * the user message before that will be a previously cached user
				 * message. So we need to mark the latest user message as
				 * ephemeral to cache it for the next request, and mark the
				 * second to last user message as ephemeral to let the server
				 * know the last message to retrieve from the cache for the
				 * current request.
				 */
				const userMsgIndices = messages.reduce(
					(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
					[] as number[],
				)

				const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
				const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

				stream = await this.client.messages.create(
					{
						model: modelId,
						max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
						temperature,
						thinking,
						// Setting cache breakpoint for system prompt so new tasks can reuse it.
						system: [{ text: systemPrompt, type: "text", cache_control: cacheControl }],
						messages: messages.map((message, index) => {
							if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
								return {
									...message,
									content:
										typeof message.content === "string"
											? [{ type: "text", text: message.content, cache_control: cacheControl }]
											: message.content.map((content, contentIndex) =>
													contentIndex === message.content.length - 1
														? { ...content, cache_control: cacheControl }
														: content,
												),
								}
							}
							return message
						}),
						stream: true,
					},
					(() => {
						// prompt caching: https://x.com/alexalbert__/status/1823751995901272068
						// https://github.com/anthropics/anthropic-sdk-typescript?tab=readme-ov-file#default-headers
						// https://github.com/anthropics/anthropic-sdk-typescript/commit/c920b77fc67bd839bfeb6716ceab9d7c9bbe7393

						const betas = []

						// Check for the thinking-128k variant first
						if (virtualId === "claude-3-7-sonnet-20250219:thinking") {
							betas.push("output-128k-2025-02-19")
						}

						// Then check for models that support prompt caching
						switch (modelId) {
							case "claude-3-7-sonnet-20250219":
							case "claude-3-5-sonnet-20241022":
							case "claude-3-5-haiku-20241022":
							case "claude-3-opus-20240229":
							case "claude-3-haiku-20240307":
								betas.push("prompt-caching-2024-07-31")
								return { headers: { "anthropic-beta": betas.join(",") } }
							default:
								return undefined
						}
					})(),
				)
				break
			}
			default: {
				stream = (await this.client.messages.create({
					model: modelId,
					max_tokens: maxTokens ?? ANTHROPIC_DEFAULT_MAX_TOKENS,
					temperature,
					system: [{ text: systemPrompt, type: "text" }],
					messages,
					stream: true,
				})) as any
				break
			}
		}

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

		// Track the original model ID for special variant handling
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
			virtualId, // Include the original ID to use for header selection
			...getModelParams({ options: this.options, model: info, defaultMaxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS }),
		}
	}

	async completePrompt(prompt: string) {
		let { id: model, temperature, info } = this.getModel()

		// Check token count before sending the request for all Anthropic models
		// Count tokens for the prompt
		const tokenCount = await this.countTokens([{ type: "text", text: prompt }])

		// Get the context window size for the current model
		const contextWindow = info.contextWindow || 200000

		// Calculate a safe token limit (1k tokens below the context window)
		const safeTokenLimit = Math.min(contextWindow - 1000, CLAUDE_MAX_SAFE_TOKEN_LIMIT)

		// If token count exceeds the safe limit, truncate the prompt
		if (tokenCount > safeTokenLimit) {
			console.warn(
				`Prompt token count (${tokenCount}) exceeds safe limit (${safeTokenLimit}) for model ${model}. Truncating prompt.`,
			)

			// Calculate how much we need to truncate
			const ratio = safeTokenLimit / tokenCount
			const newLength = Math.floor(prompt.length * ratio * 0.9) // 90% of the calculated length for safety

			// Truncate the prompt
			prompt = prompt.substring(0, newLength)
			console.log(`Truncated prompt to ${newLength} characters to fit within token limit.`)
		}

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

	/**
	 * Counts tokens for the given content using Anthropic's API
	 *
	 * @param content The content blocks to count tokens for
	 * @returns A promise resolving to the token count
	 */
	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			// Use the current model
			const { id: model } = this.getModel()

			const response = await this.client.messages.countTokens({
				model,
				messages: [{ role: "user", content: content }],
			})

			return response.input_tokens
		} catch (error) {
			// Log error but fallback to tiktoken estimation
			console.warn("Anthropic token counting failed, using fallback", error)

			// Use the base provider's implementation as fallback
			return super.countTokens(content)
		}
	}

	/**
	 * Counts tokens for a complete message request using Anthropic's API
	 *
	 * @param systemPrompt The system prompt
	 * @param messages The conversation messages
	 * @param model The model ID
	 * @returns A promise resolving to the token count
	 */
	async countMessageTokens(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		model: string,
	): Promise<number> {
		try {
			const response = await this.client.messages.countTokens({
				model,
				system: systemPrompt,
				messages: messages,
			})

			return response.input_tokens
		} catch (error) {
			// Log error but fallback to estimating tokens by counting each part separately
			console.warn("Anthropic message token counting failed, using fallback", error)

			// Fallback: Count system prompt tokens
			const systemTokens = await this.countTokens([{ type: "text", text: systemPrompt }])

			// Count tokens for each message
			let messageTokens = 0
			for (const message of messages) {
				if (typeof message.content === "string") {
					messageTokens += await this.countTokens([{ type: "text", text: message.content }])
				} else {
					messageTokens += await this.countTokens(message.content)
				}
			}

			// Add some overhead for message formatting
			return systemTokens + messageTokens + messages.length * 5
		}
	}
}
