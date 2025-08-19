import * as vscode from "vscode"
import { ApiHandlerOptions } from "../../../shared/api"
import { EmbedderInfo, EmbeddingResponse, IEmbedder } from "../interfaces"
import { getModelQueryPrefix } from "../../../shared/embeddingModels"
import { MAX_ITEM_TOKENS } from "../constants"
import { t } from "../../../i18n"
import { withValidationErrorHandling, sanitizeErrorMessage } from "../shared/validation-helpers"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

// Timeout constants for Ollama API requests
const OLLAMA_EMBEDDING_TIMEOUT_MS = 60000 // 60 seconds for embedding requests
const OLLAMA_VALIDATION_TIMEOUT_MS = 30000 // 30 seconds for validation requests

/**
 * Implements the IEmbedder interface using a local Ollama instance.
 */
export class CodeIndexOllamaEmbedder implements IEmbedder {
	private readonly baseUrl: string
	private readonly defaultModelId: string
	private readonly outputChannel?: vscode.OutputChannel

	constructor(options: ApiHandlerOptions, outputChannel?: vscode.OutputChannel) {
		// Ensure ollamaBaseUrl and ollamaModelId exist on ApiHandlerOptions or add defaults
		let baseUrl = options.ollamaBaseUrl || "http://localhost:11434"

		// Normalize the baseUrl by removing all trailing slashes
		baseUrl = baseUrl.replace(/\/+$/, "")

		this.baseUrl = baseUrl
		this.defaultModelId = options.ollamaModelId || "nomic-embed-text:latest"
		this.outputChannel = outputChannel

		// Log construction
		this.log("info", "Ollama Embedder constructed", {
			modelId: this.defaultModelId,
			baseUrl: this.baseUrl,
		})
	}

	/**
	 * Logs a message to the output channel if available
	 * @param level The log level (debug, info, warn, error)
	 * @param message The message to log
	 * @param data Optional structured data to include
	 */
	private log(level: "debug" | "info" | "warn" | "error", message: string, data?: any): void {
		if (!this.outputChannel) return

		const timestamp = new Date().toISOString()
		const prefix = `[${timestamp}] [${level.toUpperCase()}] [OLLAMA]`

		let logMessage = `${prefix} ${message}`
		if (data) {
			logMessage += `\n${JSON.stringify(data, null, 2)}`
		}

		this.outputChannel.appendLine(logMessage)
	}

	/**
	 * Helper method for warning logs
	 */
	private logWarning(message: string, data?: any): void {
		this.log("warn", message, data)
	}

	/**
	 * Helper method for error logs
	 */
	private logError(message: string, data?: any): void {
		this.log("error", message, data)
	}

	/**
	 * Creates embeddings for the given texts using the specified Ollama model.
	 * @param texts - An array of strings to embed.
	 * @param model - Optional model ID to override the default.
	 * @returns A promise that resolves to an EmbeddingResponse containing the embeddings and usage data.
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.defaultModelId
		const url = `${this.baseUrl}/api/embed` // Endpoint as specified

		this.log("debug", "Starting embedding creation", {
			textCount: texts.length,
			model: modelToUse,
			url: url,
		})

		// Apply model-specific query prefix if required
		const queryPrefix = getModelQueryPrefix("ollama", modelToUse)
		const processedTexts = queryPrefix
			? texts.map((text, index) => {
					// Prevent double-prefixing
					if (text.startsWith(queryPrefix)) {
						return text
					}
					const prefixedText = `${queryPrefix}${text}`
					const estimatedTokens = Math.ceil(prefixedText.length / 4)
					if (estimatedTokens > MAX_ITEM_TOKENS) {
						this.logWarning("Text with prefix exceeds token limit", {
							index,
							estimatedTokens,
							maxTokens: MAX_ITEM_TOKENS,
						})
						console.warn(
							t("embeddings:textWithPrefixExceedsTokenLimit", {
								index,
								estimatedTokens,
								maxTokens: MAX_ITEM_TOKENS,
							}),
						)
						// Return original text if adding prefix would exceed limit
						return text
					}
					return prefixedText
				})
			: texts

		try {
			// Note: Standard Ollama API uses 'prompt' for single text, not 'input' for array.
			// Implementing based on user's specific request structure.

			// Add timeout to prevent indefinite hanging
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), OLLAMA_EMBEDDING_TIMEOUT_MS)

			this.log("debug", "Sending request to Ollama", {
				model: modelToUse,
				inputCount: processedTexts.length,
			})

			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: modelToUse,
					input: processedTexts, // Using 'input' as requested
				}),
				signal: controller.signal,
			})
			clearTimeout(timeoutId)

			if (!response.ok) {
				let errorBody = t("embeddings:ollama.couldNotReadErrorBody")
				try {
					errorBody = await response.text()
				} catch (e) {
					// Ignore error reading body
				}

				this.logError("Ollama request failed", {
					status: response.status,
					statusText: response.statusText,
					errorBody,
				})

				throw new Error(
					t("embeddings:ollama.requestFailed", {
						status: response.status,
						statusText: response.statusText,
						errorBody,
					}),
				)
			}

			const data = await response.json()

			// Extract embeddings using 'embeddings' key as requested
			const embeddings = data.embeddings
			if (!embeddings || !Array.isArray(embeddings)) {
				this.logError("Invalid response structure", { data })
				throw new Error(t("embeddings:ollama.invalidResponseStructure"))
			}

			this.log("info", "Successfully created embeddings", {
				count: embeddings.length,
				dimensions: embeddings[0]?.length,
			})

			return {
				embeddings: embeddings,
			}
		} catch (error: any) {
			// Capture telemetry before reformatting the error
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
				stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
				location: "OllamaEmbedder:createEmbeddings",
			})

			// Log the original error for debugging purposes
			this.logError("Ollama embedding failed", {
				error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
				stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
			})
			console.error("Ollama embedding failed:", error)

			// Handle specific error types with better messages
			if (error.name === "AbortError") {
				throw new Error(t("embeddings:validation.connectionFailed"))
			} else if (error.message?.includes("fetch failed") || error.code === "ECONNREFUSED") {
				throw new Error(t("embeddings:ollama.serviceNotRunning", { baseUrl: this.baseUrl }))
			} else if (error.code === "ENOTFOUND") {
				throw new Error(t("embeddings:ollama.hostNotFound", { baseUrl: this.baseUrl }))
			}

			// Re-throw a more specific error for the caller
			throw new Error(t("embeddings:ollama.embeddingFailed", { message: error.message }))
		}
	}

	/**
	 * Validates the Ollama embedder configuration by checking service availability and model existence
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(
			async () => {
				this.log("info", "Starting configuration validation")

				// First check if Ollama service is running by trying to list models
				const modelsUrl = `${this.baseUrl}/api/tags`

				// Add timeout to prevent indefinite hanging
				const controller = new AbortController()
				const timeoutId = setTimeout(() => controller.abort(), OLLAMA_VALIDATION_TIMEOUT_MS)

				const modelsResponse = await fetch(modelsUrl, {
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
					signal: controller.signal,
				})
				clearTimeout(timeoutId)

				if (!modelsResponse.ok) {
					if (modelsResponse.status === 404) {
						this.logError("Ollama service not running", { baseUrl: this.baseUrl })
						return {
							valid: false,
							error: t("embeddings:ollama.serviceNotRunning", { baseUrl: this.baseUrl }),
						}
					}
					this.logError("Ollama service unavailable", {
						baseUrl: this.baseUrl,
						status: modelsResponse.status,
					})
					return {
						valid: false,
						error: t("embeddings:ollama.serviceUnavailable", {
							baseUrl: this.baseUrl,
							status: modelsResponse.status,
						}),
					}
				}

				// Check if the specific model exists
				const modelsData = await modelsResponse.json()
				const models = modelsData.models || []

				// Check both with and without :latest suffix
				const modelExists = models.some((m: any) => {
					const modelName = m.name || ""
					return (
						modelName === this.defaultModelId ||
						modelName === `${this.defaultModelId}:latest` ||
						modelName === this.defaultModelId.replace(":latest", "")
					)
				})

				if (!modelExists) {
					const availableModels = models.map((m: any) => m.name).join(", ")
					this.logError("Model not found", {
						modelId: this.defaultModelId,
						availableModels,
					})
					return {
						valid: false,
						error: t("embeddings:ollama.modelNotFound", {
							modelId: this.defaultModelId,
							availableModels,
						}),
					}
				}

				this.log("debug", "Model found, testing embedding capability", {
					modelId: this.defaultModelId,
				})

				// Try a test embedding to ensure the model works for embeddings
				const testUrl = `${this.baseUrl}/api/embed`

				// Add timeout for test request too
				const testController = new AbortController()
				const testTimeoutId = setTimeout(() => testController.abort(), OLLAMA_VALIDATION_TIMEOUT_MS)

				const testResponse = await fetch(testUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: this.defaultModelId,
						input: ["test"],
					}),
					signal: testController.signal,
				})
				clearTimeout(testTimeoutId)

				if (!testResponse.ok) {
					this.logError("Model not embedding capable", { modelId: this.defaultModelId })
					return {
						valid: false,
						error: t("embeddings:ollama.modelNotEmbeddingCapable", { modelId: this.defaultModelId }),
					}
				}

				this.log("info", "Configuration validation successful")
				return { valid: true }
			},
			"ollama",
			{
				beforeStandardHandling: (error: any) => {
					// Handle Ollama-specific connection errors
					// Check for fetch failed errors which indicate Ollama is not running
					if (
						error?.message?.includes("fetch failed") ||
						error?.code === "ECONNREFUSED" ||
						error?.message?.includes("ECONNREFUSED")
					) {
						// Capture telemetry for connection failed error
						TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
							error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
							stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
							location: "OllamaEmbedder:validateConfiguration:connectionFailed",
						})
						return {
							valid: false,
							error: t("embeddings:ollama.serviceNotRunning", { baseUrl: this.baseUrl }),
						}
					} else if (error?.code === "ENOTFOUND" || error?.message?.includes("ENOTFOUND")) {
						// Capture telemetry for host not found error
						TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
							error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
							stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
							location: "OllamaEmbedder:validateConfiguration:hostNotFound",
						})
						return {
							valid: false,
							error: t("embeddings:ollama.hostNotFound", { baseUrl: this.baseUrl }),
						}
					} else if (error?.name === "AbortError") {
						// Capture telemetry for timeout error
						TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
							error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
							stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
							location: "OllamaEmbedder:validateConfiguration:timeout",
						})
						// Handle timeout
						return {
							valid: false,
							error: t("embeddings:validation.connectionFailed"),
						}
					}
					// Let standard handling take over
					return undefined
				},
			},
		)
	}

	get embedderInfo(): EmbedderInfo {
		return {
			name: "ollama",
		}
	}
}
