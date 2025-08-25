import * as vscode from "vscode"
import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import { GEMINI_MAX_ITEM_TOKENS } from "../constants"
import { t } from "../../../i18n"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

/**
 * Gemini embedder implementation that wraps the OpenAI Compatible embedder
 * with configuration for Google's Gemini embedding API.
 *
 * Supported models:
 * - text-embedding-004 (dimension: 768)
 * - gemini-embedding-001 (dimension: 2048)
 */
export class GeminiEmbedder implements IEmbedder {
	private readonly openAICompatibleEmbedder: OpenAICompatibleEmbedder
	private static readonly GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
	private static readonly DEFAULT_MODEL = "gemini-embedding-001"
	private readonly modelId: string
	private readonly outputChannel?: vscode.OutputChannel

	/**
	 * Creates a new Gemini embedder
	 * @param apiKey The Gemini API key for authentication
	 * @param modelId The model ID to use (defaults to gemini-embedding-001)
	 * @param outputChannel Optional VS Code output channel for logging
	 */
	constructor(apiKey: string, modelId?: string, outputChannel?: vscode.OutputChannel) {
		if (!apiKey) {
			throw new Error(t("embeddings:validation.apiKeyRequired"))
		}

		// Use provided model or default
		this.modelId = modelId || GeminiEmbedder.DEFAULT_MODEL
		this.outputChannel = outputChannel

		// Create an OpenAI Compatible embedder with Gemini's configuration
		this.openAICompatibleEmbedder = new OpenAICompatibleEmbedder(
			GeminiEmbedder.GEMINI_BASE_URL,
			apiKey,
			this.modelId,
			GEMINI_MAX_ITEM_TOKENS,
			undefined, // useFloatEncoding
			this.outputChannel,
		)

		// Log construction
		this.log("info", "Gemini Embedder constructed", {
			modelId: this.modelId,
			baseUrl: GeminiEmbedder.GEMINI_BASE_URL,
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
		const prefix = `[${timestamp}] [${level.toUpperCase()}] [GEMINI]`

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
	 * Creates embeddings for the given texts using Gemini's embedding API
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
				location: "GeminiEmbedder:createEmbeddings",
			})
			throw error
		}
	}

	/**
	 * Validates the Gemini embedder configuration by delegating to the underlying OpenAI-compatible embedder
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			this.log("info", "Starting configuration validation")

			// Delegate validation to the OpenAI-compatible embedder
			// The error messages will be specific to Gemini since we're using Gemini's base URL
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
				location: "GeminiEmbedder:validateConfiguration",
			})
			throw error
		}
	}

	/**
	 * Returns information about this embedder
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "gemini",
		}
	}
}
