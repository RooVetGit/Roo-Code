import { Anthropic } from "@anthropic-ai/sdk"
import axios from "axios"
import OpenAI from "openai"

import { ApiHandlerOptions, ModelInfo, unboundDefaultModelId, unboundDefaultModelInfo } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { SingleCompletionHandler } from "../"
import { BaseProvider } from "./base-provider"

interface UnboundUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
	cache_read_input_tokens?: number
}

export class UnboundHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		const baseURL = "https://api.getunbound.ai/v1"
		const apiKey = this.options.unboundApiKey ?? "not-provided"
		this.client = new OpenAI({ baseURL, apiKey })
	}

	private supportsTemperature(): boolean {
		return !this.getModel().id.startsWith("openai/o3-mini")
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		try {
			// Convert Anthropic messages to OpenAI format
			const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
				{ role: "system", content: systemPrompt },
				...convertToOpenAiMessages(messages),
			]

			// Handle Claude-3 specific cache control
			if (this.getModel().id.startsWith("anthropic/claude-3")) {
				openAiMessages[0] = {
					role: "system",
					content: [
						{
							type: "text",
							text: systemPrompt,
							// @ts-ignore-next-line
							cache_control: { type: "ephemeral" },
						},
					],
				}

				const lastTwoUserMessages = openAiMessages.filter((msg) => msg.role === "user").slice(-2)
				lastTwoUserMessages.forEach((msg) => {
					if (typeof msg.content === "string") {
						msg.content = [{ type: "text", text: msg.content }]
					}
					if (Array.isArray(msg.content)) {
						let lastTextPart = msg.content.filter((part) => part.type === "text").pop()
						if (!lastTextPart) {
							lastTextPart = { type: "text", text: "..." }
							msg.content.push(lastTextPart)
						}
						// @ts-ignore-next-line
						lastTextPart["cache_control"] = { type: "ephemeral" }
					}
				})
			}

			let maxTokens: number | undefined
			if (this.getModel().id.startsWith("anthropic/")) {
				maxTokens = this.getModel().info.maxTokens ?? undefined
			}

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: this.getModel().id.split("/")[1],
				max_tokens: maxTokens,
				messages: openAiMessages,
				stream: true,
			}

			if (this.supportsTemperature()) {
				requestOptions.temperature = this.options.modelTemperature ?? 0
			}

			const { data: completion } = await this.client.chat.completions
				.create(requestOptions, {
					headers: {
						"X-Unbound-Metadata": JSON.stringify({
							labels: [{ key: "app", value: "roo-code" }],
						}),
					},
				})
				.withResponse()

			for await (const chunk of completion) {
				const delta = chunk.choices[0]?.delta
				const usage = chunk.usage as UnboundUsage

				if (delta?.content) {
					yield {
						type: "text",
						text: delta.content,
					}
				}

				if (usage) {
					const usageData: ApiStreamUsageChunk = {
						type: "usage",
						inputTokens: usage.prompt_tokens || 0,
						outputTokens: usage.completion_tokens || 0,
					}

					if (usage.cache_creation_input_tokens) {
						usageData.cacheWriteTokens = usage.cache_creation_input_tokens
					}
					if (usage.cache_read_input_tokens) {
						usageData.cacheReadTokens = usage.cache_read_input_tokens
					}

					yield usageData
				}
			}
		} catch (error) {
			console.error("Unbound API error:", error)
			const errorObj = error as any

			// Handle rate limit errors
			if (
				errorObj.status === 429 ||
				(errorObj.message &&
					(errorObj.message.toLowerCase().includes("rate limit") ||
						errorObj.message.toLowerCase().includes("too many requests")))
			) {
				throw new Error(
					JSON.stringify({
						status: 429,
						message: "Rate limit exceeded",
						error: {
							metadata: {
								raw: errorObj.message || "Too many requests, please try again later",
								provider: "unbound",
							},
						},
						errorDetails: [
							{
								"@type": "type.googleapis.com/google.rpc.RetryInfo",
								retryDelay: "30s",
							},
						],
					}),
				)
			}

			// Handle authentication errors
			if (
				errorObj.status === 401 ||
				(errorObj.message &&
					(errorObj.message.toLowerCase().includes("api key") ||
						errorObj.message.toLowerCase().includes("unauthorized")))
			) {
				throw new Error(
					JSON.stringify({
						status: 401,
						message: "Authentication error",
						error: {
							metadata: {
								raw: errorObj.message || "Invalid API key or unauthorized access",
								provider: "unbound",
							},
						},
					}),
				)
			}

			// Handle bad request errors
			if (errorObj.status === 400 || (errorObj.error && errorObj.error.type === "invalid_request_error")) {
				throw new Error(
					JSON.stringify({
						status: 400,
						message: "Bad request",
						error: {
							metadata: {
								raw: errorObj.message || "Invalid request parameters",
								param: errorObj.error?.param,
								provider: "unbound",
							},
						},
					}),
				)
			}

			// Also check for error objects with type property
			if (errorObj.error?.type === "invalid_request_error") {
				throw new Error(
					JSON.stringify({
						status: 400,
						message: "Bad request",
						error: {
							metadata: {
								raw: errorObj.message || "Invalid request parameters",
								param: errorObj.error?.param,
								provider: "unbound",
							},
						},
					}),
				)
			}

			// Handle model-specific errors
			if (errorObj.status === 404 || (errorObj.message && errorObj.message.toLowerCase().includes("model"))) {
				throw new Error(
					JSON.stringify({
						status: 404,
						message: "Model not found",
						error: {
							metadata: {
								raw: errorObj.message || "The requested model was not found or is not available",
								provider: "unbound",
								modelId: this.getModel().id,
							},
						},
					}),
				)
			}

			// Handle cache-related errors
			if (errorObj.message && errorObj.message.toLowerCase().includes("cache")) {
				throw new Error(
					JSON.stringify({
						status: 500,
						message: "Cache error",
						error: {
							metadata: {
								raw: errorObj.message || "Error with prompt caching system",
								provider: "unbound",
							},
						},
					}),
				)
			}

			// Handle other errors
			let errorMessage = errorObj.message || (error instanceof Error ? error.message : String(error))
			let rawError = errorMessage

			// For non-Error objects, try to stringify them
			if (typeof error === "object" && error !== null && !(error instanceof Error)) {
				try {
					rawError = JSON.stringify(error)
				} catch (e) {
					// If we can't stringify, use the string representation
					rawError = String(error)
				}
			}

			// Try to parse the error message if it's a JSON string
			try {
				const parsedError = JSON.parse(errorMessage)
				if (parsedError.error?.message) {
					errorMessage = parsedError.error.message
				} else if (parsedError.message) {
					errorMessage = parsedError.message
				}
			} catch (e) {
				// Not a JSON string, use as is
			}

			throw new Error(
				JSON.stringify({
					status: errorObj.status || 500,
					message: errorMessage,
					error: {
						metadata: {
							raw: rawError,
							provider: "unbound",
						},
					},
				}),
			)
		}
	}

	override getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.unboundModelId
		const modelInfo = this.options.unboundModelInfo
		if (modelId && modelInfo) {
			return { id: modelId, info: modelInfo }
		}
		return {
			id: unboundDefaultModelId,
			info: unboundDefaultModelInfo,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: this.getModel().id.split("/")[1],
				messages: [{ role: "user", content: prompt }],
			}

			if (this.supportsTemperature()) {
				requestOptions.temperature = this.options.modelTemperature ?? 0
			}

			if (this.getModel().id.startsWith("anthropic/")) {
				requestOptions.max_tokens = this.getModel().info.maxTokens
			}

			const response = await this.client.chat.completions.create(requestOptions, {
				headers: {
					"X-Unbound-Metadata": JSON.stringify({
						labels: [
							{
								key: "app",
								value: "roo-code",
							},
						],
					}),
				},
			})
			return response.choices[0]?.message.content || ""
		} catch (error) {
			let errorMessage =
				error instanceof Error
					? error.message
					: typeof error === "object" && error !== null && "message" in error
						? (error as { message: string }).message
						: String(error)

			// Try to parse the error message if it's a JSON string
			try {
				const parsedError = JSON.parse(errorMessage)
				if (parsedError.error?.message) {
					errorMessage = parsedError.error.message
				} else if (parsedError.message) {
					errorMessage = parsedError.message
				}
			} catch (e) {
				// Not a JSON string, use as is
			}

			throw new Error(`Unbound completion error: ${errorMessage}`)
		}
	}
}

export async function getUnboundModels() {
	const models: Record<string, ModelInfo> = {}

	try {
		const response = await axios.get("https://api.getunbound.ai/models")

		if (response.data) {
			const rawModels: Record<string, any> = response.data

			for (const [modelId, model] of Object.entries(rawModels)) {
				const modelInfo: ModelInfo = {
					maxTokens: model?.maxTokens ? parseInt(model.maxTokens) : undefined,
					contextWindow: model?.contextWindow ? parseInt(model.contextWindow) : 0,
					supportsImages: model?.supportsImages ?? false,
					supportsPromptCache: model?.supportsPromptCaching ?? false,
					supportsComputerUse: model?.supportsComputerUse ?? false,
					inputPrice: model?.inputTokenPrice ? parseFloat(model.inputTokenPrice) : undefined,
					outputPrice: model?.outputTokenPrice ? parseFloat(model.outputTokenPrice) : undefined,
					cacheWritesPrice: model?.cacheWritePrice ? parseFloat(model.cacheWritePrice) : undefined,
					cacheReadsPrice: model?.cacheReadPrice ? parseFloat(model.cacheReadPrice) : undefined,
				}

				switch (true) {
					case modelId.startsWith("anthropic/"):
						// Set max tokens to 8192 for supported Anthropic models
						if (modelInfo.maxTokens !== 4096) {
							modelInfo.maxTokens = 8192
						}
						break
					default:
						break
				}

				models[modelId] = modelInfo
			}
		}
	} catch (error) {
		console.error(`Error fetching Unbound models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
	}

	return models
}
