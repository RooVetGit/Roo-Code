import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ModelInfo } from "@roo-code/types"
import { openAiModelInfoSaneDefaults } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"

import { XmlMatcher } from "../../utils/xml-matcher"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

export class SyntxHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private apiKey: string | undefined = undefined

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.client = this.createClient()
	}

	private async initializeApiKey(): Promise<void> {
		try {
			// Get fresh API key from extension storage
			const freshApiKey = this.options.syntxApiKey

			if (freshApiKey !== this.apiKey) {
				this.apiKey = freshApiKey
				// Rebuild client with fresh key
				this.client = this.createClient()
			}
		} catch (error) {
			console.error("Error initializing SyntX API key:", error)
		}
	}

	private async ensureApiKey(): Promise<void> {
		// Always refresh to handle user switching
		await this.initializeApiKey()
	}

	private createClient(): OpenAI {
		return new OpenAI({
			baseURL: this.getBaseURL(),
			apiKey: this.apiKey || this.options.syntxApiKey || "syntx",
			defaultHeaders: DEFAULT_HEADERS,
		})
	}

	private getBaseURL(): string {
		const baseUrl = this.options.syntxBaseUrl || "https://api.syntx.dev"
		return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
	}

	private getRequestPath(): string {
		return this.options.syntxAutoSelectEnabled
			? "/v1/auto/completions" // Server chooses model
			: "/v1/chat/completions" // Use specified model
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		await this.ensureApiKey()

		const modelInfo = this.getModel().info
		const openAiMessages = convertToOpenAiMessages(messages)
		const requestPath = this.getRequestPath()

		try {
			const stream = await this.client.chat.completions.create(
				{
					model: this.getModel().id,
					messages: [{ role: "system", content: systemPrompt }, ...openAiMessages],
					temperature: this.options.modelTemperature ?? 0,
					stream: true,
					stream_options: { include_usage: true },
				},
				{
					path: requestPath,
				},
			)

			// Set up XML matcher for thinking tags
			const matcher = new XmlMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)

			let lastUsage

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta
				if (delta?.content) {
					for (const chunkData of matcher.update(delta.content)) {
						yield chunkData
					}
				}

				if (chunk.usage) {
					lastUsage = chunk.usage
				}
			}

			// Process any remaining fragments
			for (const chunk of matcher.final()) {
				yield chunk
			}

			// Handle usage information
			if (lastUsage) {
				yield {
					type: "usage",
					inputTokens: lastUsage.prompt_tokens || 0,
					outputTokens: lastUsage.completion_tokens || 0,
					totalCost: calculateApiCostOpenAI(
						modelInfo,
						lastUsage.prompt_tokens || 0,
						lastUsage.completion_tokens || 0,
					),
				}
			}
		} catch (error) {
			if (error instanceof Error) {
				const errorMessage = error.message.toLowerCase()
				// Check for free usage limit exceeded specifically
				if (errorMessage.includes("free_usage_limit_exceeded")) {
					yield {
						type: "error",
						error: "FREE_USAGE_LIMIT_EXCEEDED",
						message: error.message, // Pass through the full error message with JSON data
					}
					return
				}

				// Check for credits depleted or other auth errors
				if (
					errorMessage.includes("invalid api key") ||
					errorMessage.includes("401") ||
					errorMessage.includes("unauthorized") ||
					errorMessage.includes("insufficient credits") ||
					errorMessage.includes("credits depleted")
				) {
					yield {
						type: "error",
						error: "CREDITS_DEPLETED",
						message:
							"CREDITS_DEPLETED: Buy Credits to Access Proprietary Models. Please log in at https://syntx.dev to purchase credits and go to View Profile in settings.",
					}
					return
				}
			}
			throw error
		}
	}

	override getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.syntxModelId || "deepseek-v3"

		// Safety check for empty model ID
		if (!modelId || modelId.trim() === "") {
			console.warn("Empty model ID detected, using fallback")
			return {
				id: "deepseek-v3",
				info: {
					...openAiModelInfoSaneDefaults,
					description: "deepseek-v3 (fallback)",
				},
			}
		}

		return {
			id: modelId,
			info: {
				...openAiModelInfoSaneDefaults,
				description: `SyntX ${modelId}`,
			},
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		await this.ensureApiKey()

		try {
			const model = this.getModel()
			const requestPath = this.getRequestPath()

			const response = await this.client.chat.completions.create(
				{
					model: model.id,
					messages: [{ role: "user", content: prompt }],
					temperature: this.options.modelTemperature ?? 0,
				},
				{
					path: requestPath,
				},
			)

			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				const errorMessage = error.message.toLowerCase()

				// Check for free usage limit exceeded specifically
				if (errorMessage.includes("free_usage_limit_exceeded")) {
					throw new Error(error.message) // Pass through the full error message with JSON data
				}

				// Check for credits depleted or other auth errors
				if (
					errorMessage.includes("invalid api key") ||
					errorMessage.includes("401") ||
					errorMessage.includes("unauthorized") ||
					errorMessage.includes("insufficient credits") ||
					errorMessage.includes("credits depleted")
				) {
					throw new Error(
						"CREDITS_DEPLETED: Buy Credits to Access Proprietary Models. Please log in at https://syntx.dev to purchase credits and go to View Profile in settings.",
					)
				}
				throw new Error(`SyntX completion error: ${error.message}`)
			}
			throw error
		}
	}
}
