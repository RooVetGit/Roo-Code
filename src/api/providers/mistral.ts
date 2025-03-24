import { Anthropic } from "@anthropic-ai/sdk"
import { Mistral } from "@mistralai/mistralai"
import { ChatCompletionStreamRequest } from "@mistralai/mistralai/models/components"
import { SingleCompletionHandler } from "../"
import { ApiHandlerOptions, mistralDefaultModelId, MistralModelId, mistralModels, ModelInfo } from "../../shared/api"
import { convertToMistralMessages } from "../transform/mistral-format"
import { ApiStreamChunk } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import * as vscode from "vscode"
import { logger } from "../../utils/logging"
import { calculateApiCostOpenAI } from "../../utils/cost"

// Create a custom debug logger that integrates with our existing logging system
const createDebugLogger = (outputChannel?: vscode.OutputChannel, enableDebug?: boolean) => ({
	debug: (...args: any[]) => {
		if (enableDebug && outputChannel) {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			outputChannel.appendLine(`[Roo Code Debug] ${message}`)
		}
	},
	info: (...args: any[]) => {
		if (enableDebug && outputChannel) {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			outputChannel.appendLine(`[Roo Code Info] ${message}`)
		}
	},
	warn: (...args: any[]) => {
		if (enableDebug && outputChannel) {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			outputChannel.appendLine(`[Roo Code Warning] ${message}`)
		}
	},
	error: (...args: any[]) => {
		if (outputChannel) {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			outputChannel.appendLine(`[Roo Code Error] ${message}`)
		}
	},
	// Add missing methods required by Mistral SDK Logger interface
	log: (...args: any[]) => {
		if (enableDebug && outputChannel) {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			outputChannel.appendLine(`[Roo Code Log] ${message}`)
		}
	},
	group: (...args: any[]) => {
		if (enableDebug && outputChannel) {
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			outputChannel.appendLine(`[Roo Code Group] ${message}`)
		}
	},
	groupEnd: () => {
		if (enableDebug && outputChannel) {
			outputChannel.appendLine(`[Roo Code GroupEnd]`)
		}
	},
	logts: (...args: any[]) => {
		if (enableDebug && outputChannel) {
			const timestamp = new Date().toISOString()
			const message = args
				.map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
				.join(" ")
			outputChannel.appendLine(`[Roo Code ${timestamp}] ${message}`)
		}
	},
})

const MISTRAL_DEFAULT_TEMPERATURE = 0
const MAX_RETRIES = 3 // Maximum number of retries for failed requests - const until a ui setting
const INITIAL_RETRY_DELAY = 1000 // Initial retry delay in milliseconds
const MAX_RETRY_DELAY = 32000 // Maximum retry delay in milliseconds
const JITTER_FACTOR = 0.2 // Jitter factor for randomization (20%)

interface MistralErrorResponse {
	error: {
		message: string
		type: string
		code: number
	}
}

export class MistralHandler extends BaseProvider implements SingleCompletionHandler {
	// Add a new property to indicate this handler has built-in rate limiting
	override readonly hasBuiltInRateLimiting: boolean = true

	protected options: ApiHandlerOptions
	private client: Mistral
	private readonly enableDebugOutput: boolean
	private readonly outputChannel?: vscode.OutputChannel
	private readonly enableVerboseDebug: boolean
	private readonly verboseOutputChannel?: vscode.OutputChannel
	private readonly enableSdkDebug: boolean
	private cachedModel: { id: MistralModelId; info: ModelInfo; forModelId: string | undefined } | null = null
	private static readonly outputChannelName = "Roo Code Mistral"
	private static readonly verboseOutputChannelName = "Roo Code Mistral Verbose"
	private static sharedOutputChannel: vscode.OutputChannel | undefined
	private static sharedVerboseOutputChannel: vscode.OutputChannel | undefined

	constructor(options: ApiHandlerOptions) {
		super()
		if (!options.mistralApiKey) {
			throw new Error("Mistral API key is required")
		}

		this.cachedModel = null
		this.options = {
			...options,
			apiModelId: options.apiModelId || mistralDefaultModelId,
		}

		try {
			const config = vscode.workspace.getConfiguration("roo-cline")
			this.enableDebugOutput = config?.get<boolean>("debug.mistral") || false
			this.enableVerboseDebug = config?.get<boolean>("debug.mistralVerbose") || false
			this.enableSdkDebug = config?.get<boolean>("debug.mistralSdk") || false
		} catch {
			this.enableDebugOutput = false
			this.enableVerboseDebug = false
			this.enableSdkDebug = false
		}

		if (this.enableDebugOutput) {
			try {
				if (!MistralHandler.sharedOutputChannel) {
					MistralHandler.sharedOutputChannel = vscode.window.createOutputChannel(
						MistralHandler.outputChannelName,
					)
				}
				this.outputChannel = MistralHandler.sharedOutputChannel
			} catch {
				// Ignore output channel creation errors in tests
			}
		}

		if (this.enableVerboseDebug) {
			try {
				if (!MistralHandler.sharedVerboseOutputChannel) {
					MistralHandler.sharedVerboseOutputChannel = vscode.window.createOutputChannel(
						MistralHandler.verboseOutputChannelName,
					)
				}
				this.verboseOutputChannel = MistralHandler.sharedVerboseOutputChannel
			} catch {
				// Ignore output channel creation errors in tests
			}
		}

		const baseUrl = this.getBaseUrl()
		this.logDebug(`MistralHandler using baseUrl: ${baseUrl}`)

		// Create custom debug logger that integrates with our logging system
		const debugLogger = this.enableSdkDebug
			? createDebugLogger(this.enableVerboseDebug ? this.verboseOutputChannel : this.outputChannel, true)
			: undefined

		// Initialize the Mistral client
		this.client = new Mistral({
			apiKey: this.options.mistralApiKey,
			debugLogger,
			serverURL: baseUrl,
		})
	}

	private logDebug(...messages: (string | object)[]): void {
		if (this.enableDebugOutput && this.outputChannel) {
			const formattedMessages = messages
				.map((msg) => (typeof msg === "object" ? JSON.stringify(msg, null, 2) : msg))
				.join(" ")
			this.outputChannel.appendLine(`[Roo Code] ${formattedMessages}`)
		}
	}

	private logVerbose(...messages: (string | object)[]): void {
		if (this.enableVerboseDebug && this.verboseOutputChannel) {
			const formattedMessages = messages
				.map((msg) => (typeof msg === "object" ? JSON.stringify(msg, null, 2) : msg))
				.join(" ")
			this.verboseOutputChannel.appendLine(`[Roo Code] ${new Date().toISOString()} ${formattedMessages}`)
		}
	}

	private getBaseUrl(): string {
		const modelId = this.options.apiModelId ?? mistralDefaultModelId
		this.logDebug(`MistralHandler using modelId: ${modelId}`)
		if (modelId?.startsWith("codestral-")) {
			return this.options.mistralCodestralUrl || "https://codestral.mistral.ai"
		}
		return "https://api.mistral.ai"
	}

	private exponentialBackoff(retryCount: number): number {
		const delay = Math.min(
			INITIAL_RETRY_DELAY * Math.pow(2, retryCount) * (1 + JITTER_FACTOR * Math.random()),
			MAX_RETRY_DELAY,
		)
		this.logDebug(`Calculated backoff delay: ${delay}ms for retry ${retryCount}`)
		return delay
	}

	private async handleRateLimitError(error: Error): Promise<void> {
		const retryAfterMatch = error.message.match(/retry after (\d+)/i)
		const retryAfter = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) * 1000 : 60000 // Convert to ms or default to 1 minute

		logger.warn("Mistral rate limit hit", {
			ctx: "mistral",
			retryAfterMs: retryAfter,
			errorMessage: error.message,
		})

		this.logDebug(`Rate limit hit. Waiting ${retryAfter}ms before retry`)
		await new Promise((resolve) => setTimeout(resolve, retryAfter))
	}

	private async retryWithBackoff<T>(operation: () => Promise<T>): Promise<T> {
		let retryCount = 0

		while (true) {
			try {
				const result = await operation()

				// Check if result is a Response object and has status code
				if (result && typeof result === "object" && "status" in result && result.status === 429) {
					// Handle rate limit response
					await this.handleRateLimit(result as unknown as Response)
					const backoffDelay = this.exponentialBackoff(retryCount)
					await new Promise((resolve) => setTimeout(resolve, backoffDelay))
					retryCount++
					continue
				}

				return result
			} catch (error) {
				if (retryCount >= MAX_RETRIES) {
					this.logDebug(`Maximum retry count (${MAX_RETRIES}) reached, giving up`)
					throw error
				}

				const isRateLimit = error instanceof Error && error.message.includes("rate limit")

				if (isRateLimit) {
					await this.handleRateLimitError(error)
				} else {
					const backoffDelay = this.exponentialBackoff(retryCount)
					this.logDebug(
						`Retrying operation after ${backoffDelay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`,
					)
					this.logVerbose(`Retry reason:`, error)
					logger.warn("Mistral API retry", {
						ctx: "mistral",
						retryCount: retryCount + 1,
						backoffDelay,
						error: error instanceof Error ? error.message : String(error),
					})
					await new Promise((resolve) => setTimeout(resolve, backoffDelay))
				}

				retryCount++
			}
		}
	}

	private abortController?: AbortController

	private cleanup(): void {
		if (this.abortController) {
			this.abortController.abort()
			this.abortController = undefined
		}
	}

	private handleError(error: unknown): never {
		// Convert error to a string or object before logging
		const errorForLogging = error instanceof Error ? { message: error.message, stack: error.stack } : String(error)

		this.logDebug("Mistral API error:", errorForLogging)

		if (error instanceof Error) {
			// Check for specific Mistral API error types
			if (error.message.includes("rate limit")) {
				this.handleRateLimitError(error)
			} else if (error.message.includes("authentication")) {
				logger.error("Mistral authentication error", { ctx: "mistral", error: errorForLogging })
				throw new Error(`Mistral API authentication error: ${error.message}`)
			} else if (error.message.includes("invalid model")) {
				logger.error("Mistral invalid model error", { ctx: "mistral", error: errorForLogging })
				throw new Error(`Mistral API model error: ${error.message}`)
			} else if (error.message.includes("context length")) {
				logger.error("Mistral context length error", { ctx: "mistral", error: errorForLogging })
				throw new Error(`Mistral API context length error: ${error.message}`)
			} else if (error.message.includes("timeout")) {
				logger.error("Mistral timeout error", { ctx: "mistral", error: errorForLogging })
				throw new Error(`Mistral API timeout: ${error.message}`)
			} else {
				logger.error("Mistral general error", { ctx: "mistral", error: errorForLogging })
				throw new Error(`Mistral API error: ${error.message}`)
			}
		}

		logger.error("Mistral unknown error", { ctx: "mistral", error: String(error) })
		throw new Error(`Mistral API error: ${String(error)}`)
	}

	override getModel(): { id: MistralModelId; info: ModelInfo } {
		if (this.cachedModel && this.cachedModel.forModelId === this.options.apiModelId) {
			this.logDebug(`Using cached model: ${this.cachedModel.id}`)
			return {
				id: this.cachedModel.id,
				info: this.cachedModel.info,
			}
		}

		if (this.options.apiModelId && this.options.apiModelId in mistralModels) {
			const id = this.options.apiModelId as MistralModelId
			this.logDebug(`Using model: ${id}`)
			this.cachedModel = {
				id,
				info: mistralModels[id],
				forModelId: this.options.apiModelId,
			}
			return {
				id: this.cachedModel.id,
				info: this.cachedModel.info,
			}
		}

		this.logDebug(`Using default model: ${mistralDefaultModelId}`)
		this.cachedModel = {
			id: mistralDefaultModelId,
			info: mistralModels[mistralDefaultModelId],
			forModelId: undefined,
		}
		return {
			id: this.cachedModel.id,
			info: this.cachedModel.info,
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): AsyncGenerator<ApiStreamChunk> {
		try {
			this.logDebug(`Creating message with system prompt: ${systemPrompt}`)

			// Clean up any existing state
			this.cleanup()
			this.abortController = new AbortController()
			const signal = this.abortController.signal

			let hasYieldedUsage = false
			const stream = await this.retryWithBackoff(async () => {
				if (signal.aborted) {
					throw new Error("Stream aborted before start")
				}

				// Set up stream options with required parameters
				const streamOptions: ChatCompletionStreamRequest = {
					model: this.getModel().id,
					messages: [{ role: "system", content: systemPrompt }, ...convertToMistralMessages(messages)] as any, // Type assertion to bypass type checking
					temperature: this.options.modelTemperature ?? MISTRAL_DEFAULT_TEMPERATURE,
					stream: true,
				} as any // Type assertion to bypass type checking

				// Add return_usage parameter (not in TypeScript definition but supported by API)
				;(streamOptions as any).return_usage = true

				// Create stream with abort handling
				const stream = await this.client.chat.stream(streamOptions)

				// Set up abort handler
				signal.addEventListener("abort", () => {
					this.logDebug("Stream aborted by user")
					this.cleanup()
				})

				return stream
			})

			this.logDebug("Stream connection established")

			try {
				for await (const chunk of stream) {
					if (signal.aborted) {
						this.logDebug("Stream aborted during processing")
						return
					}

					// Log chunk details in verbose mode
					if (this.enableVerboseDebug) {
						this.logVerbose(`Chunk received: ${JSON.stringify(chunk, null, 2)}`)
					}

					// Handle content chunks and completion signals
					if (chunk.data.choices?.[0]?.delta) {
						const delta = chunk.data.choices[0].delta

						// Check for finish reason (completion signal)
						if (chunk.data.choices[0].finishReason === "stop") {
							this.logDebug("Received completion signal with finishReason: stop")

							// Check for usage metrics in the final chunk
							if (chunk.data.usage && !hasYieldedUsage) {
								hasYieldedUsage = true
								const inputTokens = chunk.data.usage.promptTokens || 0
								const outputTokens = chunk.data.usage.completionTokens || 0

								// Only log detailed metrics when debug is enabled
								if (this.enableDebugOutput) {
									const modelInfo = this.getModel().info
									const totalCost = calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens)
									const timestamp = new Date().toISOString()
									this.logDebug(
										`[${timestamp}] Usage metrics - Input tokens: ${inputTokens}, Output tokens: ${outputTokens}, Cost: $${totalCost.toFixed(6)}`,
									)
								}
								yield {
									type: "usage",
									inputTokens: inputTokens,
									outputTokens: outputTokens,
								}
							}

							// Yield an empty text chunk to signal completion
							yield { type: "text", text: "" }
							continue
						}

						// Process content if it exists
						if (delta.content !== undefined) {
							let content: string = ""
							if (typeof delta.content === "string") {
								content = delta.content
							} else if (Array.isArray(delta.content)) {
								content = delta.content.map((c) => (c.type === "text" ? c.text : "")).join("")
							}

							if (content) {
								this.logDebug(`Received content: "${content}"`)
								yield { type: "text", text: content }
							}
						}
					}

					// Handle usage metrics
					if (chunk.data.usage && !hasYieldedUsage) {
						hasYieldedUsage = true
						const inputTokens = chunk.data.usage.promptTokens || 0
						const outputTokens = chunk.data.usage.completionTokens || 0
						const modelInfo = this.getModel().info
						const totalCost = calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens)

						// Only log detailed metrics when debug is enabled
						if (this.enableDebugOutput) {
							const timestamp = new Date().toISOString()
							this.logDebug(
								`[${timestamp}] Usage metrics - Input tokens: ${inputTokens}, Output tokens: ${outputTokens}, Cost: $${totalCost.toFixed(6)}`,
							)
						}

						yield {
							type: "usage",
							inputTokens: chunk.data.usage.promptTokens || 0,
							outputTokens: chunk.data.usage.completionTokens || 0,
						}
					}
				}

				this.cleanup()
				this.logDebug("Stream completed successfully")
			} catch (error) {
				this.cleanup()
				if (signal.aborted) {
					this.logDebug("Stream aborted due to error:", error)
					return
				}
				this.logDebug("Stream error occurred:", error)
				throw error
			}
		} catch (error) {
			this.cleanup()
			this.handleError(error)
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

	/**
	 * Handle rate limit errors by extracting details from the HTTP response and notifying the user.
	 *
	 * @param response The HTTP response object
	 */
	protected async handleRateLimit(response: Response): Promise<void> {
		this.logDebug(`Handling rate limit response: ${response.status} ${response.statusText}`)

		try {
			// Extract all rate limit headers
			const rateLimitLimitMinute = response.headers.get("x-ratelimit-limit-minute")
			const rateLimitRemainingMinute = response.headers.get("x-ratelimit-remaining-minute")
			const rateLimitLimitDay = response.headers.get("x-ratelimit-limit-day")
			const rateLimitRemainingDay = response.headers.get("x-ratelimit-remaining-day")
			const rateLimitReset = response.headers.get("x-ratelimit-reset")
			const retryAfter = response.headers.get("retry-after")

			// Log all headers for debugging
			response.headers.forEach((value, key) => {
				this.logDebug(`${key}: ${value}`)
			})

			// Try to get error message from response body
			const message = await response
				.clone()
				.json()
				.then((data) => {
					this.logDebug(`Rate limit response body: ${JSON.stringify(data)}`)
					return (data as MistralErrorResponse).error?.message || "Rate limit exceeded"
				})
				.catch((err) => {
					this.logDebug(`Failed to parse rate limit response body: ${err}`)
					return "Rate limit exceeded"
				})

			// Format a clear user message based on available rate limit information
			if (rateLimitRemainingMinute !== null && rateLimitLimitMinute !== null) {
				const remainingMinute = parseInt(rateLimitRemainingMinute, 10)
				const limitMinute = parseInt(rateLimitLimitMinute, 10)
				const remainingDay = rateLimitRemainingDay ? parseInt(rateLimitRemainingDay, 10) : null
				const limitDay = rateLimitLimitDay ? parseInt(rateLimitLimitDay, 10) : null

				// Calculate percentage of limits remaining
				const percentRemainingMinute = (remainingMinute / limitMinute) * 100
				const percentRemainingDay =
					remainingDay !== null && limitDay !== null ? (remainingDay / limitDay) * 100 : null

				let userMessage = `${message}. `

				if (remainingMinute <= 0) {
					const waitTime = rateLimitReset ? `${rateLimitReset} seconds` : "some time"
					userMessage += `Minute limit reached (${limitMinute} requests). Please wait ${waitTime} before trying again.`
					vscode.window.showErrorMessage(userMessage)
				} else if (percentRemainingMinute <= 20) {
					// Warning for approaching minute limit
					userMessage += `⚠️ Approaching minute limit: ${remainingMinute}/${limitMinute} requests remaining (${percentRemainingMinute.toFixed(0)}%).`
					vscode.window.showWarningMessage(userMessage)
				} else if (percentRemainingDay !== null && percentRemainingDay <= 10) {
					// Warning for approaching daily limit
					userMessage += `⚠️ Approaching daily limit: ${remainingDay}/${limitDay} requests remaining (${percentRemainingDay.toFixed(0)}%).`
					vscode.window.showWarningMessage(userMessage)
				} else {
					// Just log the current status without showing a notification
					this.logDebug(
						`Rate limit status: ${remainingMinute}/${limitMinute} minute requests, ${remainingDay}/${limitDay} daily requests`,
					)
				}
			} else if (retryAfter) {
				vscode.window.showErrorMessage(`${message}. Retry after ${retryAfter} seconds.`)
			} else {
				vscode.window.showErrorMessage(message)
			}
		} catch (error) {
			this.logDebug(`Error handling rate limit: ${error}`)
			vscode.window.showErrorMessage("Rate limit exceeded")
		}
	}
}
