import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import axios from "axios"

import { SingleCompletionHandler } from "../"
import { ApiHandlerOptions, ModelInfo, openAiModelInfoSaneDefaults } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { convertToR1Format } from "../transform/r1-format"
import { ApiStream } from "../transform/stream"
import { DEEP_SEEK_DEFAULT_TEMPERATURE } from "./constants"
import { XmlMatcher } from "../../utils/xml-matcher"
import { BaseProvider } from "./base-provider"

export class OllamaHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.client = new OpenAI({
			baseURL: (this.options.ollamaBaseUrl || "http://localhost:11434") + "/v1",
			apiKey: "ollama",
		})
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		try {
			const modelId = this.getModel().id
			const useR1Format = modelId.toLowerCase().includes("deepseek-r1")
			const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
				{ role: "system", content: systemPrompt },
				...(useR1Format ? convertToR1Format(messages) : convertToOpenAiMessages(messages)),
			]

			const stream = await this.client.chat.completions.create({
				model: this.getModel().id,
				messages: openAiMessages,
				temperature: this.options.modelTemperature ?? 0,
				stream: true,
			})
			const matcher = new XmlMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)
			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta

				if (delta?.content) {
					for (const chunk of matcher.update(delta.content)) {
						yield chunk
					}
				}
			}
			for (const chunk of matcher.final()) {
				yield chunk
			}
		} catch (error) {
			// Format errors in a consistent way
			console.error("Ollama API error:", error)

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

	override getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.ollamaModelId || "",
			info: openAiModelInfoSaneDefaults,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const modelId = this.getModel().id
			const useR1Format = modelId.toLowerCase().includes("deepseek-r1")
			const response = await this.client.chat.completions.create({
				model: this.getModel().id,
				messages: useR1Format
					? convertToR1Format([{ role: "user", content: prompt }])
					: [{ role: "user", content: prompt }],
				temperature: this.options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
				stream: false,
			})
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Ollama completion error: ${error.message}`)
			}
			throw error
		}
	}
}

export async function getOllamaModels(baseUrl = "http://localhost:11434") {
	try {
		if (!URL.canParse(baseUrl)) {
			return []
		}

		const response = await axios.get(`${baseUrl}/api/tags`)
		const modelsArray = response.data?.models?.map((model: any) => model.name) || []
		return [...new Set<string>(modelsArray)]
	} catch (error) {
		return []
	}
}
