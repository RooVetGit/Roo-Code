import * as vscode from "vscode"
import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import { MAX_ITEM_TOKENS } from "../constants"
import { t } from "../../../i18n"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

/**
 * Mistral embedder implementation that wraps the OpenAI Compatible embedder
 * with configuration for Mistral's embedding API.
 *
 * Supported models:
 * - codestral-embed-2505 (dimension: 1536)
 */
export class MistralEmbedder implements IEmbedder {
	private readonly openAICompatibleEmbedder: OpenAICompatibleEmbedder
	private static readonly MISTRAL_BASE_URL = "https://api.mistral.ai/v1"
	private static readonly DEFAULT_MODEL = "codestral-embed-2505"
	private readonly modelId: string
	private readonly outputChannel?: vscode.OutputChannel

	/**
	 * Creates a new Mistral embedder
	 * @param apiKey The Mistral API key for authentication
	 * @param modelId The model ID to use (defaults to codestral-embed-2505)
	 * @param outputChannel Optional VS Code output channel for logging
	 */
	constructor(apiKey: string, modelId?: string, outputChannel?: vscode.OutputChannel) {
		if (!apiKey) {
			throw new Error(t("embeddings:validation.apiKeyRequired"))
		}

		// Use provided model or default
		this.modelId = modelId || MistralEmbedder.DEFAULT_MODEL
		this.outputChannel = outputChannel

		// Create an OpenAI Compatible embedder with Mistral's configuration
		this.openAICompatibleEmbedder = new OpenAICompatibleEmbedder(
			MistralEmbedder.MISTRAL_BASE_URL,
			apiKey,
			this.modelId,
			MAX_ITEM_TOKENS, // This is the max token limit (8191), not the embedding dimension
			undefined, // useFloatEncoding
			this.outputChannel,
		)

		// Log construction
		this.log("info", "Mistral Embedder constructed", {
			modelId: this.modelId,
			baseUrl: MistralEmbedder.MISTRAL_BASE_URL,
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
		const prefix = `[${timestamp}] [${level.toUpperCase()}] [MISTRAL]`

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
	 * Creates embeddings for the given texts using Mistral's embedding API
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier (uses constructor model if not provided)
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		try {
			// Use the provided model or fall back to the instance's model
			const modelToUse = model || this.modelId

			this.log("debug", "Starting embedding creation", {
				textCount: texts.length,
				model: modelToUse,
			})

			const result = await this.openAICompatibleEmbedder.createEmbeddings(texts, modelToUse)

			this.log("info", "Successfully created embeddings", {
				count: result.embeddings.length,
				usage: result.usage,
			})

			return result
		} catch (error) {
			this.logError("Failed to create embeddings", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})

			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "MistralEmbedder:createEmbeddings",
			})
			throw error
		}
	}

	/**
	 * Validates the Mistral embedder configuration by delegating to the underlying OpenAI-compatible embedder
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			this.log("info", "Starting configuration validation")

			// Delegate validation to the OpenAI-compatible embedder
			// The error messages will be specific to Mistral since we're using Mistral's base URL
			const result = await this.openAICompatibleEmbedder.validateConfiguration()

			if (result.valid) {
				this.log("info", "Configuration validation successful")
			} else {
				this.logError("Configuration validation failed", { error: result.error })
			}

			return result
		} catch (error) {
			this.logError("Configuration validation error", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})

			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "MistralEmbedder:validateConfiguration",
			})
			throw error
		}
	}

	/**
	 * Returns information about this embedder
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "mistral",
		}
	}
}
