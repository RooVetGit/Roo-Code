import { Anthropic } from "@anthropic-ai/sdk"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { SingleCompletionHandler } from "../"
import { ApiHandlerOptions, geminiDefaultModelId, GeminiModelId, geminiModels, ModelInfo } from "../../shared/api"
import { convertAnthropicMessageToGemini } from "../transform/gemini-format"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"

const GEMINI_DEFAULT_TEMPERATURE = 0

export class GeminiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: GoogleGenerativeAI

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.client = new GoogleGenerativeAI(options.geminiApiKey ?? "not-provided")
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		try {
			const model = this.client.getGenerativeModel(
				{
					model: this.getModel().id,
					systemInstruction: systemPrompt,
				},
				{
					baseUrl: this.options.googleGeminiBaseUrl || undefined,
				},
			)
			const result = await model.generateContentStream({
				contents: messages.map(convertAnthropicMessageToGemini),
				generationConfig: {
					// maxOutputTokens: this.getModel().info.maxTokens,
					temperature: this.options.modelTemperature ?? GEMINI_DEFAULT_TEMPERATURE,
				},
			})

			for await (const chunk of result.stream) {
				yield {
					type: "text",
					text: chunk.text(),
				}
			}

			const response = await result.response
			yield {
				type: "usage",
				inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
				outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
			}
		} catch (error) {
			// Format errors in a consistent way
			console.error("Gemini API error:", error)

			// Handle rate limit errors specifically
			const errorObj = error as any
			if (
				errorObj.status === 429 ||
				(errorObj.message && errorObj.message.toLowerCase().includes("rate limit")) ||
				(errorObj.message && errorObj.message.toLowerCase().includes("quota")) ||
				(errorObj.message && errorObj.message.toLowerCase().includes("resource exhausted"))
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
				(errorObj.message && errorObj.message.toLowerCase().includes("auth")) ||
				(errorObj.message && errorObj.message.toLowerCase().includes("permission"))
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

	override getModel(): { id: GeminiModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in geminiModels) {
			const id = modelId as GeminiModelId
			return { id, info: geminiModels[id] }
		}
		return { id: geminiDefaultModelId, info: geminiModels[geminiDefaultModelId] }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const model = this.client.getGenerativeModel(
				{
					model: this.getModel().id,
				},
				{
					baseUrl: this.options.googleGeminiBaseUrl || undefined,
				},
			)

			const result = await model.generateContent({
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: this.options.modelTemperature ?? GEMINI_DEFAULT_TEMPERATURE,
				},
			})

			return result.response.text()
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Gemini completion error: ${error.message}`)
			}
			throw error
		}
	}
}
