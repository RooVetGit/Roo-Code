import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import type { ModelInfo } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"

type BaseOpenAiCompatibleProviderOptions<ModelName extends string> = ApiHandlerOptions & {
	providerName: string
	baseURL: string
	defaultProviderModelId: ModelName
	providerModels: Record<ModelName, ModelInfo>
	defaultTemperature?: number
}

export abstract class BaseOpenAiCompatibleProvider<ModelName extends string>
	extends BaseProvider
	implements SingleCompletionHandler
{
	protected readonly providerName: string
	protected readonly baseURL: string
	protected readonly defaultTemperature: number
	protected readonly defaultProviderModelId: ModelName
	protected readonly providerModels: Record<ModelName, ModelInfo>

	protected readonly options: ApiHandlerOptions

	protected client: OpenAI

	constructor({
		providerName,
		baseURL,
		defaultProviderModelId,
		providerModels,
		defaultTemperature,
		...options
	}: BaseOpenAiCompatibleProviderOptions<ModelName>) {
		super()

		this.providerName = providerName
		this.baseURL = baseURL
		this.defaultProviderModelId = defaultProviderModelId
		this.providerModels = providerModels
		this.defaultTemperature = defaultTemperature ?? 0

		this.options = options

		if (!this.options.apiKey) {
			throw new Error("API key is required")
		}

		this.client = new OpenAI({
			baseURL,
			apiKey: this.options.apiKey,
			defaultHeaders: DEFAULT_HEADERS,
		})
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const {
			id: model,
			info: { maxTokens: max_tokens },
		} = this.getModel()

		const temperature = this.options.modelTemperature ?? this.defaultTemperature

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			max_tokens,
			temperature,
			messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
			stream: true,
			stream_options: { include_usage: true },
		}

		const stream = await this.retryApiCall(() => this.client.chat.completions.create(params), "streaming request")

		try {
			for await (const chunk of stream) {
				try {
					const delta = chunk.choices[0]?.delta

					if (delta?.content) {
						yield {
							type: "text",
							text: delta.content,
						}
					}

					if (chunk.usage) {
						yield {
							type: "usage",
							inputTokens: chunk.usage.prompt_tokens || 0,
							outputTokens: chunk.usage.completion_tokens || 0,
						}
					}
				} catch (error) {
					// Handle streaming chunk processing errors
					this.handleStreamingError(error)
				}
			}
		} catch (error) {
			// Handle streaming errors that occur after initial connection
			this.handleStreamingError(error)
		}
	}

	/**
	 * Handle streaming-specific errors that occur during chunk processing
	 */
	private handleStreamingError(error: unknown): never {
		if (error instanceof Error) {
			const message = error.message.toLowerCase()

			if (message.includes("premature close") || message.includes("connection closed")) {
				throw new Error(
					`${this.providerName} connection was closed unexpectedly. This may be due to:\n` +
						`• Network connectivity issues\n` +
						`• Server overload or maintenance\n` +
						`• Request timeout\n\n` +
						`Please try again in a moment. If the issue persists, check your network connection or try a different model.`,
				)
			}

			if (message.includes("invalid response body") || message.includes("unexpected token")) {
				throw new Error(
					`${this.providerName} returned an invalid response. This may be due to:\n` +
						`• Server-side processing errors\n` +
						`• Temporary service disruption\n` +
						`• Model compatibility issues\n\n` +
						`Please try again with a different model or contact support if the issue persists.`,
				)
			}

			throw new Error(`${this.providerName} streaming error: ${error.message}`)
		}

		throw new Error(`${this.providerName} encountered an unexpected streaming error`)
	}

	/**
	 * Handle API request errors with detailed, user-friendly messages
	 */
	private handleApiError(error: unknown): never {
		if (error instanceof Error) {
			const message = error.message.toLowerCase()

			// Handle specific connection errors
			if (message.includes("econnreset") || message.includes("connection reset")) {
				throw new Error(
					`Connection to ${this.providerName} was reset. This usually indicates:\n` +
						`• Network connectivity issues\n` +
						`• Server overload\n` +
						`• Firewall or proxy interference\n\n` +
						`Please check your network connection and try again.`,
				)
			}

			if (message.includes("econnrefused") || message.includes("connection refused")) {
				throw new Error(
					`Cannot connect to ${this.providerName} server. This may be due to:\n` +
						`• Incorrect API endpoint URL\n` +
						`• Server maintenance or downtime\n` +
						`• Network firewall blocking the connection\n\n` +
						`Please verify your API configuration and try again later.`,
				)
			}

			if (message.includes("etimedout") || message.includes("timeout")) {
				throw new Error(
					`Request to ${this.providerName} timed out. This may be due to:\n` +
						`• Slow network connection\n` +
						`• Server overload\n` +
						`• Large request processing time\n\n` +
						`Please try again with a shorter prompt or check your network connection.`,
				)
			}

			if (message.includes("enotfound") || message.includes("not found")) {
				throw new Error(
					`Cannot resolve ${this.providerName} server address. This may be due to:\n` +
						`• Incorrect API endpoint URL\n` +
						`• DNS resolution issues\n` +
						`• Network connectivity problems\n\n` +
						`Please verify your API configuration and network connection.`,
				)
			}

			// Handle premature close and invalid response body errors
			if (message.includes("premature close")) {
				throw new Error(
					`${this.providerName} connection closed unexpectedly. This may be due to:\n` +
						`• Network connectivity issues\n` +
						`• Server overload or maintenance\n` +
						`• Request timeout\n\n` +
						`Please try again in a moment. If the issue persists, check your network connection.`,
				)
			}

			if (message.includes("invalid response body")) {
				throw new Error(
					`${this.providerName} returned an invalid response. This may be due to:\n` +
						`• Server-side processing errors\n` +
						`• Temporary service disruption\n` +
						`• Model compatibility issues\n\n` +
						`Please try again with a different model or contact support if the issue persists.`,
				)
			}
		}

		// Handle OpenAI SDK errors
		if (error && typeof error === "object" && "status" in error) {
			const status = (error as any).status
			const errorMessage = (error as any).message || "Unknown error"

			switch (status) {
				case 401:
					throw new Error(
						`${this.providerName} authentication failed. Please check your API key and ensure it's valid and has the necessary permissions.`,
					)
				case 403:
					throw new Error(
						`${this.providerName} access forbidden. This may be due to:\n` +
							`• Invalid or expired API key\n` +
							`• Insufficient permissions for the requested model\n` +
							`• Account limitations or restrictions\n\n` +
							`Please verify your API key and account status.`,
					)
				case 404:
					throw new Error(
						`${this.providerName} model or endpoint not found. Please verify:\n` +
							`• The model name is correct and available\n` +
							`• Your API endpoint URL is properly configured\n` +
							`• Your account has access to the requested model`,
					)
				case 429:
					throw new Error(
						`${this.providerName} rate limit exceeded. Please:\n` +
							`• Wait a moment before trying again\n` +
							`• Consider upgrading your API plan for higher limits\n` +
							`• Reduce the frequency of your requests`,
					)
				case 500:
				case 502:
				case 503:
					throw new Error(
						`${this.providerName} server error (${status}). This is a temporary issue on their end. Please try again in a few moments.`,
					)
				default:
					throw new Error(`${this.providerName} API error (${status}): ${errorMessage}`)
			}
		}

		// Fallback for unknown errors
		if (error instanceof Error) {
			throw new Error(`${this.providerName} error: ${error.message}`)
		}

		throw new Error(`${this.providerName} encountered an unexpected error`)
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId } = this.getModel()

		try {
			const response = await this.client.chat.completions.create({
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			})

			return response.choices[0]?.message.content || ""
		} catch (error) {
			// Format error message to match expected test format
			const errorMessage = error instanceof Error ? error.message : "Unknown error"
			throw new Error(`${this.providerName} completion error: ${errorMessage}`)
		}
	}

	/**
	 * Retry API calls with exponential backoff for transient failures
	 */
	private async retryApiCall<T>(
		apiCall: () => Promise<T>,
		operationType: string,
		maxRetries: number = 3,
	): Promise<T> {
		let lastError: unknown

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await apiCall()
			} catch (error) {
				lastError = error

				// Don't retry on certain types of errors
				if (this.shouldNotRetry(error)) {
					throw error // Throw original error to preserve test expectations
				}

				// If this is the last attempt, throw the original error
				if (attempt === maxRetries) {
					throw error // Throw original error to preserve test expectations
				}

				// Calculate delay with exponential backoff and jitter
				const baseDelay = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
				const jitter = Math.random() * 1000 // Add up to 1s of jitter
				const delay = baseDelay + jitter

				console.warn(
					`${this.providerName} ${operationType} failed (attempt ${attempt}/${maxRetries}). ` +
						`Retrying in ${Math.round(delay)}ms...`,
				)

				await new Promise((resolve) => setTimeout(resolve, delay))
			}
		}

		// This should never be reached, but TypeScript needs it
		throw lastError
	}

	/**
	 * Determine if an error should not be retried
	 */
	private shouldNotRetry(error: unknown): boolean {
		if (error && typeof error === "object" && "status" in error) {
			const status = (error as any).status
			// Don't retry on client errors (4xx) except for 429 (rate limit)
			if (status >= 400 && status < 500 && status !== 429) {
				return true
			}
		}

		if (error instanceof Error) {
			const message = error.message.toLowerCase()
			// Don't retry on authentication or authorization errors
			if (
				message.includes("unauthorized") ||
				message.includes("forbidden") ||
				message.includes("invalid api key")
			) {
				return true
			}
		}

		return false
	}

	override getModel() {
		const id =
			this.options.apiModelId && this.options.apiModelId in this.providerModels
				? (this.options.apiModelId as ModelName)
				: this.defaultProviderModelId

		return { id, info: this.providerModels[id] }
	}
}
