import axios from "axios"
import { Anthropic } from "@anthropic-ai/sdk"

import { ModelInfo, requestyDefaultModelInfo, requestyDefaultModelId } from "../../shared/api"
import { calculateApiCostOpenAI, parseApiPrice } from "../../utils/cost"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { OpenAiHandler, OpenAiHandlerOptions } from "./openai"
import OpenAI from "openai"
import { convertToR1Format } from "../transform/r1-format"

// Requesty usage includes an extra field for Anthropic use cases.
// Safely cast the prompt token details section to the appropriate structure.
interface RequestyUsage extends OpenAI.CompletionUsage {
	prompt_tokens_details?: {
		caching_tokens?: number
		cached_tokens?: number
	}
	total_cost?: number
}

export class RequestyHandler extends OpenAiHandler {
	constructor(options: OpenAiHandlerOptions) {
		if (!options.requestyApiKey) {
			throw new Error("Requesty API key is required. Please provide it in the settings.")
		}
		super({
			...options,
			openAiApiKey: options.requestyApiKey,
			openAiModelId: options.requestyModelId ?? requestyDefaultModelId,
			openAiBaseUrl: "https://router.requesty.ai/v1",
			openAiCustomModelInfo: options.requestyModelInfo ?? requestyDefaultModelInfo,
		})
	}

	override getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.requestyModelId ?? requestyDefaultModelId
		return {
			id: modelId,
			info: this.options.requestyModelInfo ?? requestyDefaultModelInfo,
		}
	}

	protected override processUsageMetrics(usage: any, modelInfo?: ModelInfo): ApiStreamUsageChunk {
		const requestyUsage = usage as RequestyUsage
		const inputTokens = requestyUsage?.prompt_tokens || 0
		const outputTokens = requestyUsage?.completion_tokens || 0
		const cacheWriteTokens = requestyUsage?.prompt_tokens_details?.caching_tokens || 0
		const cacheReadTokens = requestyUsage?.prompt_tokens_details?.cached_tokens || 0
		const totalCost = modelInfo
			? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
			: 0
		return {
			type: "usage",
			inputTokens: inputTokens,
			outputTokens: outputTokens,
			cacheWriteTokens: cacheWriteTokens,
			cacheReadTokens: cacheReadTokens,
			totalCost: totalCost,
		}
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		try {
			// Convert Anthropic messages to OpenAI format
			const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
				{
					role: "system",
					content: [
						{
							type: "text",
							text: systemPrompt,
							// @ts-ignore - Requesty supports cache_control
							cache_control: {
								type: "ephemeral",
							},
						},
					],
				},
			]

			// Handle special case for deepseek-reasoner model
			if (this.options.requestyModelId?.includes("deepseek-reasoner")) {
				const r1Messages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
				openAiMessages.push(...r1Messages)
			} else {
				// Add user messages with cache control
				messages.forEach((msg) => {
					if (typeof msg.content === "string") {
						openAiMessages.push({
							role: msg.role,
							content: [
								{
									type: "text",
									text: msg.content,
									// @ts-ignore - Requesty supports cache_control
									cache_control: {
										type: "ephemeral",
									},
								},
							],
						})
					} else {
						openAiMessages.push(msg as any)
					}
				})
			}

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
				model: this.options.requestyModelId ?? requestyDefaultModelId,
				messages: openAiMessages,
				stream: true,
				stream_options: { include_usage: true },
			}

			if (this.options.includeMaxTokens !== false) {
				requestOptions.max_tokens = this.options.requestyModelInfo?.maxTokens
			}

			// Set temperature if available
			requestOptions.temperature = this.options.modelTemperature ?? 0

			// Create a new OpenAI client with the same configuration
			const client = new OpenAI({
				apiKey: this.options.requestyApiKey || "not-provided",
				baseURL: "https://router.requesty.ai/v1",
			})
			const stream = await client.chat.completions.create(requestOptions)

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta
				const usage = chunk.usage as RequestyUsage

				if (delta?.content) {
					yield {
						type: "text",
						text: delta.content,
					}
				}

				if (usage) {
					yield this.processUsageMetrics(usage, this.options.requestyModelInfo ?? undefined)
				}
			}
		} catch (error) {
			console.error("Requesty API error:", error)
			const errorObj = error as any

			// Handle rate limit errors
			if (
				errorObj.status === 429 ||
				(errorObj.message &&
					(errorObj.message.toLowerCase().includes("rate limit") ||
						errorObj.message.toLowerCase().includes("too many requests")))
			) {
				const retryAfter = errorObj.response?.headers?.["retry-after"] || "30"
				throw new Error(
					JSON.stringify({
						status: 429,
						message: "Rate limit exceeded",
						error: {
							metadata: {
								raw: errorObj.message || "Too many requests, please try again later",
								provider: "requesty",
							},
						},
						errorDetails: [
							{
								"@type": "type.googleapis.com/google.rpc.RetryInfo",
								retryDelay: `${retryAfter}s`,
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
								provider: "requesty",
							},
						},
					}),
				)
			}

			// Handle quota exceeded errors
			if (errorObj.message && errorObj.message.toLowerCase().includes("quota")) {
				throw new Error(
					JSON.stringify({
						status: 429,
						message: "Quota exceeded",
						error: {
							metadata: {
								raw: errorObj.message || "Monthly quota exceeded",
								provider: "requesty",
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
								provider: "requesty",
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
								provider: "requesty",
								modelId: this.options.requestyModelId,
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
								provider: "requesty",
							},
						},
					}),
				)
			}

			// Handle other errors
			if (error instanceof Error) {
				throw new Error(
					JSON.stringify({
						status: errorObj.status || 500,
						message: error.message,
						error: {
							metadata: {
								raw: error.message,
								provider: "requesty",
							},
						},
					}),
				)
			} else {
				throw new Error(
					JSON.stringify({
						status: 500,
						message: String(error),
						error: {
							metadata: {
								raw: String(error),
								provider: "requesty",
							},
						},
					}),
				)
			}
		}
	}
}

export async function getRequestyModels() {
	const models: Record<string, ModelInfo> = {}

	try {
		const response = await axios.get("https://router.requesty.ai/v1/models")
		const rawModels = response.data.data

		for (const rawModel of rawModels) {
			// {
			// 	id: "anthropic/claude-3-5-sonnet-20240620",
			// 	object: "model",
			// 	created: 1740552655,
			// 	owned_by: "system",
			// 	input_price: 0.0000028,
			// 	caching_price: 0.00000375,
			// 	cached_price: 3e-7,
			// 	output_price: 0.000015,
			// 	max_output_tokens: 8192,
			// 	context_window: 200000,
			// 	supports_caching: true,
			// 	description:
			// 		"Anthropic's previous most intelligent model. High level of intelligence and capability. Excells in coding.",
			// }

			const modelInfo: ModelInfo = {
				maxTokens: rawModel.max_output_tokens,
				contextWindow: rawModel.context_window,
				supportsPromptCache: rawModel.supports_caching,
				supportsImages: rawModel.supports_vision,
				supportsComputerUse: rawModel.supports_computer_use,
				inputPrice: parseApiPrice(rawModel.input_price),
				outputPrice: parseApiPrice(rawModel.output_price),
				description: rawModel.description,
				cacheWritesPrice: parseApiPrice(rawModel.caching_price),
				cacheReadsPrice: parseApiPrice(rawModel.cached_price),
			}

			models[rawModel.id] = modelInfo
		}
	} catch (error) {
		console.error(`Error fetching Requesty models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
	}

	return models
}
