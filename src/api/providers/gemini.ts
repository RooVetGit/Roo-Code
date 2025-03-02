import { Anthropic } from "@anthropic-ai/sdk"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { ApiHandler, SingleCompletionHandler } from "../"
import { ApiHandlerOptions, geminiDefaultModelId, GeminiModelId, geminiModels, ModelInfo } from "../../shared/api"
import { convertAnthropicMessageToGemini } from "../transform/gemini-format"
import { ApiStream } from "../transform/stream"

const GEMINI_DEFAULT_TEMPERATURE = 0
const DEFAULT_REQUEST_COUNT = 10 // Default number of requests before switching API keys

// Define a callback type for API key rotation
export type ApiKeyRotationCallback = (newIndex: number, totalKeys: number, apiKey: string) => void
export type RequestCountUpdateCallback = (newCount: number) => void

export class GeminiHandler implements ApiHandler, SingleCompletionHandler {
	private options: ApiHandlerOptions
	private client: GoogleGenerativeAI
	private requestCount: number = 0
	private onApiKeyRotation?: ApiKeyRotationCallback
	private onRequestCountUpdate?: RequestCountUpdateCallback

	constructor(
		options: ApiHandlerOptions,
		callbacks?: {
			onApiKeyRotation?: ApiKeyRotationCallback
			onRequestCountUpdate?: RequestCountUpdateCallback
			initialRequestCount?: number
		},
	) {
		this.options = options
		this.onApiKeyRotation = callbacks?.onApiKeyRotation
		this.onRequestCountUpdate = callbacks?.onRequestCountUpdate

		// Initialize request count from saved state if provided
		if (callbacks?.initialRequestCount !== undefined) {
			this.requestCount = callbacks.initialRequestCount
			console.log(`[GeminiHandler] Initialized with request count: ${this.requestCount}`)
		}

		// Initialize with the current API key
		const apiKey = this.getCurrentApiKey()
		this.client = new GoogleGenerativeAI(apiKey)

		// Log initial API key setup if load balancing is enabled
		if (
			this.options.geminiLoadBalancingEnabled &&
			this.options.geminiApiKeys &&
			this.options.geminiApiKeys.length > 0
		) {
			console.log(
				`[GeminiHandler] Load balancing enabled with ${this.options.geminiApiKeys.length} keys. Current index: ${this.options.geminiCurrentApiKeyIndex ?? 0}`,
			)
		}
	}

	/**
	 * Get the current API key based on load balancing settings
	 */
	private getCurrentApiKey(): string {
		// If load balancing is not enabled or there are no multiple API keys, use the single API key
		if (
			!this.options.geminiLoadBalancingEnabled ||
			!this.options.geminiApiKeys ||
			this.options.geminiApiKeys.length === 0
		) {
			return this.options.geminiApiKey ?? "not-provided"
		}

		// Get the current API key index, defaulting to 0 if not set
		const currentIndex = this.options.geminiCurrentApiKeyIndex ?? 0

		// Return the API key at the current index
		return this.options.geminiApiKeys[currentIndex] ?? "not-provided"
	}

	/**
	 * Update the client with the next API key if load balancing is enabled
	 */
	private updateApiKeyIfNeeded(): void {
		// If load balancing is not enabled or there are no multiple API keys, do nothing
		if (
			!this.options.geminiLoadBalancingEnabled ||
			!this.options.geminiApiKeys ||
			this.options.geminiApiKeys.length <= 1
		) {
			return
		}

		// Increment the request count
		this.requestCount++
		console.log(
			`[GeminiHandler] Request count: ${this.requestCount}/${this.options.geminiLoadBalancingRequestCount ?? DEFAULT_REQUEST_COUNT}`,
		)

		// Notify about request count update
		if (this.onRequestCountUpdate) {
			this.onRequestCountUpdate(this.requestCount)
		}

		// Get the request count threshold, defaulting to DEFAULT_REQUEST_COUNT if not set
		const requestCountThreshold = this.options.geminiLoadBalancingRequestCount ?? DEFAULT_REQUEST_COUNT

		// If the request count has reached the threshold, switch to the next API key
		if (this.requestCount >= requestCountThreshold) {
			// Reset the request count
			this.requestCount = 0

			// Notify about request count reset
			if (this.onRequestCountUpdate) {
				this.onRequestCountUpdate(0)
			}

			// Get the current API key index, defaulting to 0 if not set
			let currentIndex = this.options.geminiCurrentApiKeyIndex ?? 0

			// Calculate the next index, wrapping around if necessary
			currentIndex = (currentIndex + 1) % this.options.geminiApiKeys.length

			// Notify callback first to update global state
			if (this.onApiKeyRotation) {
				// Get the API key for the new index
				const apiKey = this.options.geminiApiKeys[currentIndex] ?? "not-provided"

				// Only send the first few characters of the API key for security
				const maskedKey = apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4)

				// Call the callback to update global state
				this.onApiKeyRotation(currentIndex, this.options.geminiApiKeys.length, maskedKey)

				// Update the current index in the options AFTER the callback
				// This ensures we're using the index that was just set in global state
				this.options.geminiCurrentApiKeyIndex = currentIndex

				// Update the client with the new API key
				this.client = new GoogleGenerativeAI(apiKey)

				console.log(
					`[GeminiHandler] Rotated to API key index: ${currentIndex} (${this.options.geminiApiKeys.length} total keys)`,
				)
			} else {
				// No callback provided, just update locally
				this.options.geminiCurrentApiKeyIndex = currentIndex

				// Update the client with the new API key
				const apiKey = this.getCurrentApiKey()
				this.client = new GoogleGenerativeAI(apiKey)

				console.log(
					`[GeminiHandler] Rotated to API key index: ${currentIndex} (${this.options.geminiApiKeys.length} total keys)`,
				)
			}
		}
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		// Update the API key if needed before making the request
		this.updateApiKeyIfNeeded()

		const model = this.client.getGenerativeModel({
			model: this.getModel().id,
			systemInstruction: systemPrompt,
		})
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
	}

	getModel(): { id: GeminiModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in geminiModels) {
			const id = modelId as GeminiModelId
			return { id, info: geminiModels[id] }
		}
		return { id: geminiDefaultModelId, info: geminiModels[geminiDefaultModelId] }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			// Update the API key if needed before making the request
			this.updateApiKeyIfNeeded()

			const model = this.client.getGenerativeModel({
				model: this.getModel().id,
			})

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
