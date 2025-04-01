import { Anthropic } from "@anthropic-ai/sdk"
import { Mistral } from "@mistralai/mistralai"
import { SingleCompletionHandler } from "../"
import {
	ApiHandlerOptions,
	mistralDefaultModelId,
	MistralModelId,
	mistralModels,
	ModelInfo,
	openAiNativeDefaultModelId,
	OpenAiNativeModelId,
	openAiNativeModels,
} from "../../shared/api"
import { convertToMistralMessages } from "../transform/mistral-format"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"

const MISTRAL_DEFAULT_TEMPERATURE = 0

export class MistralHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: Mistral

	constructor(options: ApiHandlerOptions) {
		super()
		if (!options.mistralApiKey) {
			throw new Error("Mistral API key is required")
		}

		// Set default model ID if not provided
		this.options = {
			...options,
			apiModelId: options.apiModelId || mistralDefaultModelId,
		}

		const baseUrl = this.getBaseUrl()
		console.debug(`[Roo Code] MistralHandler using baseUrl: ${baseUrl}`)
		this.client = new Mistral({
			serverURL: baseUrl,
			apiKey: this.options.mistralApiKey,
		})
	}

	private getBaseUrl(): string {
		const modelId = this.options.apiModelId ?? mistralDefaultModelId
		console.debug(`[Roo Code] MistralHandler using modelId: ${modelId}`)
		if (modelId?.startsWith("codestral-")) {
			return this.options.mistralCodestralUrl || "https://codestral.mistral.ai"
		}
		return "https://api.mistral.ai"
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		try {
			const response = await this.client.chat.stream({
				model: this.options.apiModelId || mistralDefaultModelId,
				messages: [{ role: "system", content: systemPrompt }, ...convertToMistralMessages(messages)],
				maxTokens: this.options.includeMaxTokens ? this.getModel().info.maxTokens : undefined,
				temperature: this.options.modelTemperature ?? MISTRAL_DEFAULT_TEMPERATURE,
			})

			for await (const chunk of response) {
				const delta = chunk.data.choices[0]?.delta
				if (delta?.content) {
					let content: string = ""
					if (typeof delta.content === "string") {
						content = delta.content
					} else if (Array.isArray(delta.content)) {
						content = delta.content.map((c) => (c.type === "text" ? c.text : "")).join("")
					}
					yield {
						type: "text",
						text: content,
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
		} catch (error) {
			// Format errors in a consistent way
			console.error("Mistral API error:", error)

			// Handle rate limit errors specifically
			const errorObj = error as any
			if (
				errorObj.status === 429 ||
				(errorObj.message && errorObj.message.toLowerCase().includes("rate limit")) ||
				(errorObj.message && errorObj.message.toLowerCase().includes("too many requests"))
			) {
				throw new Error(
					JSON.stringify({
						status: 429,
						message: "Rate limit exceeded",
						error: {
							metadata: {
								raw: errorObj.message || "Too many requests, please try again later",
							},
						},
						errorDetails: [
							{
								"@type": "type.googleapis.com/google.rpc.RetryInfo",
								retryDelay: "30s", // Default retry delay if not provided
							},
						],
					}),
				)
			}

			// Handle authentication errors
			if (
				errorObj.status === 401 ||
				(errorObj.message && errorObj.message.toLowerCase().includes("api key")) ||
				(errorObj.message && errorObj.message.toLowerCase().includes("unauthorized"))
			) {
				throw new Error(
					JSON.stringify({
						status: 401,
						message: "Authentication error",
						error: {
							metadata: {
								raw: errorObj.message || "Invalid API key or unauthorized access",
							},
						},
					}),
				)
			}

			// Handle bad request errors
			if (
				errorObj.status === 400 ||
				(errorObj.message && errorObj.message.toLowerCase().includes("invalid")) ||
				(errorObj.message && errorObj.message.toLowerCase().includes("bad request"))
			) {
				throw new Error(
					JSON.stringify({
						status: 400,
						message: "Bad request",
						error: {
							metadata: {
								raw: errorObj.message || "Invalid request parameters",
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
							},
						},
					}),
				)
			} else if (typeof error === "object" && error !== null) {
				const errorDetails = JSON.stringify(error, null, 2)
				throw new Error(
					JSON.stringify({
						status: errorObj.status || 500,
						message: errorObj.message || errorDetails,
						error: {
							metadata: {
								raw: errorDetails,
							},
						},
					}),
				)
			} else {
				// Handle primitive errors or other unexpected types
				throw new Error(
					JSON.stringify({
						status: 500,
						message: String(error),
						error: {
							metadata: {
								raw: String(error),
							},
						},
					}),
				)
			}
		}
	}

	override getModel(): { id: MistralModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in mistralModels) {
			const id = modelId as MistralModelId
			return { id, info: mistralModels[id] }
		}
		return {
			id: mistralDefaultModelId,
			info: mistralModels[mistralDefaultModelId],
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const response = await this.client.chat.complete({
				model: this.options.apiModelId || mistralDefaultModelId,
				messages: [{ role: "user", content: prompt }],
				temperature: this.options.modelTemperature ?? MISTRAL_DEFAULT_TEMPERATURE,
			})

			const content = response.choices?.[0]?.message.content
			if (Array.isArray(content)) {
				return content.map((c) => (c.type === "text" ? c.text : "")).join("")
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
