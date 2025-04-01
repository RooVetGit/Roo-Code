import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import axios from "axios"

import { SingleCompletionHandler } from "../"
import { ApiHandlerOptions, ModelInfo, openAiModelInfoSaneDefaults } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"

const LMSTUDIO_DEFAULT_TEMPERATURE = 0

export class LmStudioHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.client = new OpenAI({
			baseURL: (this.options.lmStudioBaseUrl || "http://localhost:1234") + "/v1",
			apiKey: "noop",
		})
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		try {
			// Create params object with optional draft model
			const params: any = {
				model: this.getModel().id,
				messages: openAiMessages,
				temperature: this.options.modelTemperature ?? LMSTUDIO_DEFAULT_TEMPERATURE,
				stream: true,
			}

			// Add draft model if speculative decoding is enabled and a draft model is specified
			if (this.options.lmStudioSpeculativeDecodingEnabled && this.options.lmStudioDraftModelId) {
				params.draft_model = this.options.lmStudioDraftModelId
			}

			const results = await this.client.chat.completions.create(params)

			// Stream handling
			// @ts-ignore
			for await (const chunk of results) {
				const delta = chunk.choices[0]?.delta
				if (delta?.content) {
					yield {
						type: "text",
						text: delta.content,
					}
				}
			}
		} catch (error) {
			// Format errors in a consistent way
			console.error("LM Studio API error:", error)

			const errorObj = error as any

			// Handle connection errors (common with LM Studio)
			if (
				errorObj.code === "ECONNREFUSED" ||
				errorObj.code === "ECONNRESET" ||
				(errorObj.message && errorObj.message.toLowerCase().includes("connection"))
			) {
				throw new Error(
					JSON.stringify({
						status: 503,
						message: "LM Studio connection error",
						error: {
							metadata: {
								raw: "Failed to connect to LM Studio. Please ensure LM Studio is running and accessible.",
							},
						},
					}),
				)
			}

			// Handle rate limit errors
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
								retryDelay: "30s",
							},
						],
					}),
				)
			}

			// Handle authentication errors
			if (errorObj.status === 401 || (errorObj.message && errorObj.message.toLowerCase().includes("auth"))) {
				throw new Error(
					JSON.stringify({
						status: 401,
						message: "Authentication error",
						error: {
							metadata: {
								raw: errorObj.message || "Invalid authentication credentials",
							},
						},
					}),
				)
			}

			// Handle bad request errors
			if (errorObj.status === 400 || (errorObj.message && errorObj.message.toLowerCase().includes("invalid"))) {
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

			// Handle model loading/availability errors (specific to LM Studio)
			if (errorObj.message && errorObj.message.toLowerCase().includes("model")) {
				throw new Error(
					JSON.stringify({
						status: 503,
						message: "Model error",
						error: {
							metadata: {
								raw: "Please check that a model is loaded in LM Studio and has sufficient context length for Roo Code's prompts.",
							},
						},
					}),
				)
			}

			// Handle other errors - use the same error message as completePrompt for consistency
			throw new Error(
				"Please check the LM Studio developer logs to debug what went wrong. You may need to load the model with a larger context length to work with Roo Code's prompts.",
			)
		}
	}

	override getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.lmStudioModelId || "",
			info: openAiModelInfoSaneDefaults,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			// Create params object with optional draft model
			const params: any = {
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
				temperature: this.options.modelTemperature ?? LMSTUDIO_DEFAULT_TEMPERATURE,
				stream: false,
			}

			// Add draft model if speculative decoding is enabled and a draft model is specified
			if (this.options.lmStudioSpeculativeDecodingEnabled && this.options.lmStudioDraftModelId) {
				params.draft_model = this.options.lmStudioDraftModelId
			}

			const response = await this.client.chat.completions.create(params)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			throw new Error(
				"Please check the LM Studio developer logs to debug what went wrong. You may need to load the model with a larger context length to work with Roo Code's prompts.",
			)
		}
	}
}

export async function getLmStudioModels(baseUrl = "http://localhost:1234") {
	try {
		if (!URL.canParse(baseUrl)) {
			return []
		}

		const response = await axios.get(`${baseUrl}/v1/models`)
		const modelsArray = response.data?.data?.map((model: any) => model.id) || []
		return [...new Set<string>(modelsArray)]
	} catch (error) {
		return []
	}
}
