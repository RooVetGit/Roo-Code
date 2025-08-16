import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	COPILOT_DEFAULT_HEADER,
	copilotDefaultModelId,
	GITHUB_COPILOT_API_BASE,
	type ModelInfo,
	openAiModelInfoSaneDefaults,
} from "@roo-code/types"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { CopilotAuthenticator } from "./fetchers/copilot"
import { getModels } from "./fetchers/modelCache"

/**
 *  Copilot API handler that provides direct access to Copilot models
 * using GitHub's OAuth Device Code Flow for authentication.
 *
 * This handler automatically handles authentication via device code flow
 * and supports dynamic model discovery through the Copilot API.
 */
export class CopilotHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	private authenticator: CopilotAuthenticator
	private models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.authenticator = CopilotAuthenticator.getInstance()

		// Initialize with placeholder values - actual API key will be obtained dynamically
		this.client = new OpenAI({
			baseURL: GITHUB_COPILOT_API_BASE,
			apiKey: "placeholder",
			defaultHeaders: COPILOT_DEFAULT_HEADER,
			timeout: getApiRequestTimeout(),
		})
	}

	/**
	 * Get or refresh the  Copilot API key using device code flow
	 */
	private async ensureAuthenticated(): Promise<void> {
		try {
			const { apiKey, apiBase } = await this.authenticator.getApiKey()

			// Update client with new API key and base URL
			const baseURL = apiBase || GITHUB_COPILOT_API_BASE
			this.client = new OpenAI({
				baseURL,
				apiKey,
				defaultHeaders: COPILOT_DEFAULT_HEADER,
				timeout: getApiRequestTimeout(),
			})
		} catch (error) {
			throw new Error(`Failed to authenticate with Copilot: ${error}`)
		}
	}

	/**
	 * Determine the X-Initiator header based on message roles
	 */
	private determineInitiator(messages: Anthropic.Messages.MessageParam[]): string {
		const isUserMessage = (text: string) => text.includes("<task>") || text.includes("<user_message>")
		if (messages.length === 0) {
			return "user"
		}
		const lastMessage = messages[messages.length - 1]
		if (lastMessage.role === "assistant") {
			return "agent"
		}
		if (typeof lastMessage === "string") {
			return "user"
		}
		if (Array.isArray(lastMessage.content)) {
			if (lastMessage.content.some((i) => i.type === "tool_result")) {
				return "agent"
			}
			if (lastMessage.content.some((i) => i.type === "text")) {
				let typeMode = "agent"
				if (lastMessage.content.some((i) => i.type === "text" && isUserMessage(i.text))) {
					typeMode = "user"
				}
				return typeMode
			}
		}

		return "user"
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// Ensure we have a valid API key
		await this.ensureAuthenticated()

		const { id: modelId, info: modelInfo } = await this.fetchModel()

		// Convert Anthropic messages to OpenAI format
		let systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = {
			role: "system",
			content: systemPrompt,
		}
		const convertedMessages = [systemMessage, ...convertToOpenAiMessages(messages)]

		// Add X-Initiator header
		const initiator = this.determineInitiator(messages)
		const headers = {
			"X-Initiator": initiator,
		}

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			temperature: this.options.modelTemperature ?? 0,
			messages: convertedMessages,
			stream: true as const,
			stream_options: { include_usage: true },
			max_completion_tokens: modelInfo.maxTokens,
		}

		const stream = await this.client.chat.completions.create(requestOptions, {
			headers,
		})

		for await (const chunk of stream) {
			const delta = chunk.choices?.[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			// Handle usage information
			if (chunk.usage) {
				yield this.processUsageMetrics(chunk.usage)
			}
		}
	}

	/**
	 * Process usage metrics from OpenAI response
	 */
	private processUsageMetrics(usage: any): ApiStreamUsageChunk {
		return {
			type: "usage",
			inputTokens: usage?.prompt_tokens || 0,
			outputTokens: usage?.completion_tokens || 0,
			cacheWriteTokens: usage?.prompt_tokens_details?.cache_miss_tokens,
			cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens,
		}
	}

	override getModel() {
		const id = this.options.copilotModelId ?? copilotDefaultModelId
		if (id in this.models) {
			const info = this.models[id]
			const params = getModelParams({ format: "openai", modelId: id, model: info, settings: this.options })
			return { id, info, ...params }
		}
		return {
			id,
			info: {
				...openAiModelInfoSaneDefaults,
				description: `Copilot Model (Fallback): ${id}`,
			},
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			await this.ensureAuthenticated()
			const model = this.getModel()

			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: model.id,
				messages: [{ role: "user", content: prompt }],
			}

			// Add max_tokens if needed
			this.addMaxTokensIfNeeded(requestOptions, model.info)

			const response = await this.client.chat.completions.create(requestOptions)

			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Copilot completion error: ${error.message}`)
			}

			throw error
		}
	}

	/**
	 * Add max_completion_tokens to request options if needed
	 */
	private addMaxTokensIfNeeded(
		requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams,
		modelInfo: ModelInfo,
	): void {
		if (this.options.includeMaxTokens) {
			requestOptions.max_completion_tokens = this.options.modelMaxTokens || modelInfo.maxTokens
		}
	}

	/**
	 * Check if the user is authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		return this.authenticator.isAuthenticated()
	}

	/**
	 * Clear authentication data
	 */
	async clearAuth(): Promise<void> {
		return this.authenticator.clearAuth()
	}

	public async fetchModel() {
		this.models = await getModels({ provider: "copilot" })
		return this.getModel()
	}
}
