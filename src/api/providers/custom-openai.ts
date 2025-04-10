// src/api/providers/custom-openai.ts
import { Anthropic } from "@anthropic-ai/sdk"
import axios, { AxiosInstance, AxiosRequestConfig } from "axios" // Use axios for custom requests

import {
	ApiHandlerOptions,
	ModelInfo,
	openAiModelInfoSaneDefaults, // Use sane defaults initially
} from "../../shared/api"
import { SingleCompletionHandler } from "../index"
import { convertToOpenAiMessages } from "../transform/openai-format" // Reuse message formatting
import { ApiStream, ApiStreamChunk, ApiStreamUsageChunk } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import { XmlMatcher } from "../../utils/xml-matcher" // For potential reasoning tags

// Define specific options for the custom provider
export interface CustomOpenAiHandlerOptions extends ApiHandlerOptions {
	customBaseUrl?: string
	customApiKey?: string
	customAuthHeaderName?: string // e.g., 'X-API-Key'
	customAuthHeaderPrefix?: string // e.g., 'Bearer ' or ''
	// URL path options
	useModelInPath?: boolean // Whether to include model in URL path (e.g., /api/v1/chat/model-name)
	customPathPrefix?: string // Custom path prefix (e.g., /api/v1/chat/)
	// Potentially add other OpenAI-compatible options if needed later
	modelTemperature?: number | null // Allow null to match schema
	includeMaxTokens?: boolean
	openAiStreamingEnabled?: boolean // Reuse existing streaming flag?
	openAiModelId?: string // Reuse model ID field
	openAiCustomModelInfo?: ModelInfo | null // Allow null to match schema
}

// Default headers - maybe keep these?
export const defaultHeaders = {
	"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
	"X-Title": "Roo Code",
}

export class CustomOpenAiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: CustomOpenAiHandlerOptions
	private client: AxiosInstance // Use an axios instance

	constructor(options: CustomOpenAiHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.customBaseUrl
		if (!baseURL) {
			throw new Error("Custom OpenAI provider requires 'customBaseUrl' to be set.")
		}
		if (!this.options.customApiKey) {
			console.warn("Custom OpenAI provider initialized without 'customApiKey'.")
		}

		// Prepare authentication header
		const authHeaderName = this.options.customAuthHeaderName || "Authorization" // Default to Authorization
		const authHeaderPrefix =
			this.options.customAuthHeaderPrefix !== undefined ? this.options.customAuthHeaderPrefix : "Bearer " // Default to Bearer prefix
		const apiKey = this.options.customApiKey || "not-provided"
		const authHeaderValue = `${authHeaderPrefix}${apiKey}`.trim() // Handle empty prefix

		this.client = axios.create({
			baseURL,
			headers: {
				...defaultHeaders, // Include default Roo headers
				[authHeaderName]: authHeaderValue, // Add the custom auth header
				"Content-Type": "application/json",
			},
		})
	}

	// --- Implementation using axios ---

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const modelInfo = this.getModel().info
		const modelId = this.options.openAiModelId ?? "custom-model" // Get model ID from options
		const streamingEnabled = this.options.openAiStreamingEnabled ?? true // Default to streaming

		// Convert messages to OpenAI format
		// Need to import OpenAI types for this
		const systemMessage: { role: "system"; content: string } = {
			role: "system",
			content: systemPrompt,
		}
		const convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]

		// Construct the common payload parts
		const payload: Record<string, any> = {
			model: modelId,
			messages: convertedMessages,
			temperature: this.options.modelTemperature ?? 0, // Default temperature
			stream: streamingEnabled,
		}

		if (streamingEnabled && modelInfo.supportsUsageStream) {
			payload.stream_options = { include_usage: true }
		}

		if (this.options.includeMaxTokens && modelInfo.maxTokens) {
			payload.max_tokens = modelInfo.maxTokens
		}
		// Determine the endpoint based on configuration
		let endpoint = "/chat/completions" // Default OpenAI-compatible endpoint

		// If useModelInPath is true, construct the endpoint with the model in the path
		if (this.options.useModelInPath && modelId) {
			const pathPrefix = this.options.customPathPrefix || "/api/v1/chat/"
			endpoint = `${pathPrefix}${modelId}`
		}

		try {
			if (streamingEnabled) {
				const response = await this.client.post(endpoint, payload, {
					responseType: "stream",
				})

				const stream = response.data as NodeJS.ReadableStream
				let buffer = ""
				let lastUsage: any = null
				const matcher = new XmlMatcher(
					"think",
					(chunk) => ({ type: chunk.matched ? "reasoning" : "text", text: chunk.data }) as const,
				)

				for await (const chunk of stream) {
					buffer += chunk.toString()

					// Process buffer line by line (SSE format)
					let EOL
					while ((EOL = buffer.indexOf("\n")) >= 0) {
						const line = buffer.substring(0, EOL).trim()
						buffer = buffer.substring(EOL + 1)

						if (line.startsWith("data:")) {
							const data = line.substring(5).trim()
							if (data === "[DONE]") {
								break // Stream finished
							}
							try {
								const parsed = JSON.parse(data)
								const delta = parsed.choices?.[0]?.delta ?? {}

								if (delta.content) {
									for (const contentChunk of matcher.update(delta.content)) {
										yield contentChunk
									}
								}
								// Handle potential reasoning content if supported by the custom model
								if ("reasoning_content" in delta && delta.reasoning_content) {
									yield {
										type: "reasoning",
										text: (delta.reasoning_content as string | undefined) || "",
									}
								}

								if (parsed.usage) {
									lastUsage = parsed.usage
								}
							} catch (e) {
								console.error("Error parsing stream data:", e, "Data:", data)
							}
						}
					}
				}
				// Yield any remaining text from the matcher
				for (const contentChunk of matcher.final()) {
					yield contentChunk
				}

				if (lastUsage) {
					yield this.processUsageMetrics(lastUsage, modelInfo)
				}
			} else {
				// Non-streaming case
				const response = await this.client.post(endpoint, payload)
				const completion = response.data

				yield {
					type: "text",
					text: completion.choices?.[0]?.message?.content || "",
				}
				if (completion.usage) {
					yield this.processUsageMetrics(completion.usage, modelInfo)
				}
			}
		} catch (error: any) {
			console.error("Custom OpenAI API request failed:", error)
			let errorMessage = "Custom OpenAI API request failed."
			if (axios.isAxiosError(error) && error.response) {
				errorMessage += ` Status: ${error.response.status}. Data: ${JSON.stringify(error.response.data)}`
			} else if (error instanceof Error) {
				errorMessage += ` Error: ${error.message}`
			}
			// Yield an error chunk or throw? For now, yield text.
			yield { type: "text", text: `[ERROR: ${errorMessage}]` }
			// Consider throwing an error instead if that's preferred for handling failures
			// throw new Error(errorMessage);
		}
	}

	override getModel(): { id: string; info: ModelInfo } {
		// Reuse existing fields if they make sense for custom providers
		return {
			id: this.options.openAiModelId ?? "custom-model", // Default or configured ID
			info: this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		// TODO: Implement non-streaming completion if needed (optional for Roo?)
		console.log("Prompt:", prompt)
		return "[Placeholder: CustomOpenAiHandler.completePrompt not implemented]"
	}

	// --- Helper methods (potentially reuse/adapt from OpenAiHandler) ---
	protected processUsageMetrics(usage: any, modelInfo?: ModelInfo): ApiStreamUsageChunk {
		// Adapt if usage stats format differs
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
		}
	}
}

// TODO: Add function to fetch models if the custom endpoint supports a /models route
// export async function getCustomOpenAiModels(...) { ... }
