import * as vscode from "vscode"
import { ApiHandlerOptions } from "../../shared/api"
import { ContextProxy } from "../../core/config/ContextProxy"
import { EmbedderType } from "./interfaces/manager"

/**
 * Configuration state for the code indexing feature
 */
export interface CodeIndexConfig {
	isEnabled: boolean
	isConfigured: boolean
	embedderType: EmbedderType
	openAiOptions?: ApiHandlerOptions
	ollamaOptions?: ApiHandlerOptions
	qdrantUrl?: string
	qdrantApiKey?: string
}

/**
 * Snapshot of previous configuration used to determine if a restart is required
 */
type PreviousConfigSnapshot = {
	enabled: boolean
	configured: boolean
	embedderType: EmbedderType
	openAiKey?: string
	ollamaBaseUrl?: string
	ollamaModelId?: string
	qdrantUrl?: string
	qdrantApiKey?: string
}

/**
 * Manages configuration state and validation for the code indexing feature.
 * Handles loading, validating, and providing access to configuration values.
 */
export class CodeIndexConfigManager {
	private isEnabled: boolean = false
	private embedderType: EmbedderType = "openai"
	private openAiOptions?: ApiHandlerOptions
	private ollamaOptions?: ApiHandlerOptions
	private qdrantUrl?: string
	private qdrantApiKey?: string

	constructor(private readonly contextProxy: ContextProxy) {}

	/**
	 * Loads persisted configuration from globalState.
	 */
	public async loadConfiguration(): Promise<{
		configSnapshot: PreviousConfigSnapshot
		currentConfig: {
			isEnabled: boolean
			isConfigured: boolean
			embedderType: EmbedderType
			openAiOptions?: ApiHandlerOptions
			ollamaOptions?: ApiHandlerOptions
			qdrantUrl?: string
			qdrantApiKey?: string
		}
		requiresRestart: boolean
	}> {
		console.log("[CodeIndexConfigManager] Loading configuration...")

		const previousConfigSnapshot: PreviousConfigSnapshot = {
			enabled: this.isEnabled,
			configured: this.isConfigured(),
			embedderType: this.embedderType,
			openAiKey: this.openAiOptions?.openAiNativeApiKey,
			ollamaBaseUrl: this.ollamaOptions?.ollamaBaseUrl,
			ollamaModelId: this.ollamaOptions?.ollamaModelId,
			qdrantUrl: this.qdrantUrl,
			qdrantApiKey: this.qdrantApiKey,
		}

		let codebaseIndexConfig = this.contextProxy?.getGlobalState("codebaseIndexConfig") ?? {
			codebaseIndexEnabled: false,
			codebaseIndexQdrantUrl: "",
			codebaseIndexEmbedderType: "openai",
			codebaseIndexEmbedderBaseUrl: "",
			codebaseIndexEmbedderModelId: "",
		}

		const {
			codebaseIndexEnabled,
			codebaseIndexQdrantUrl,
			codebaseIndexEmbedderType,
			codebaseIndexEmbedderBaseUrl,
			codebaseIndexEmbedderModelId,
		} = codebaseIndexConfig

		const openAiKey = this.contextProxy?.getSecret("codeIndexOpenAiKey") ?? ""
		const qdrantApiKey = this.contextProxy?.getSecret("codeIndexQdrantApiKey") ?? ""

		this.isEnabled = codebaseIndexEnabled || false
		this.qdrantUrl = codebaseIndexQdrantUrl
		this.qdrantApiKey = qdrantApiKey ?? ""
		this.openAiOptions = { openAiNativeApiKey: openAiKey }

		this.embedderType = codebaseIndexEmbedderType === "ollama" ? "ollama" : "openai"

		this.ollamaOptions = {
			ollamaBaseUrl: codebaseIndexEmbedderBaseUrl,
			ollamaModelId: codebaseIndexEmbedderModelId,
		}

		return {
			configSnapshot: previousConfigSnapshot,
			currentConfig: {
				isEnabled: this.isEnabled,
				isConfigured: this.isConfigured(),
				embedderType: this.embedderType,
				openAiOptions: this.openAiOptions,
				ollamaOptions: this.ollamaOptions,
				qdrantUrl: this.qdrantUrl,
				qdrantApiKey: this.qdrantApiKey,
			},
			requiresRestart: this._didConfigChangeRequireRestart(previousConfigSnapshot),
		}
	}

	/**
	 * Checks if the service is properly configured based on the embedder type.
	 */
	public isConfigured(): boolean {
		if (this.embedderType === "openai") {
			return !!(this.openAiOptions?.openAiNativeApiKey && this.qdrantUrl)
		} else if (this.embedderType === "ollama") {
			// Ollama model ID has a default, so only base URL is strictly required for config
			return !!(this.ollamaOptions?.ollamaBaseUrl && this.qdrantUrl)
		}
		return false // Should not happen if embedderType is always set correctly
	}

	/**
	 * Determines if a configuration change requires restarting the indexing process.
	 * @param prev The previous configuration snapshot
	 * @returns boolean indicating whether a restart is needed
	 */
	private _didConfigChangeRequireRestart(prev: PreviousConfigSnapshot): boolean {
		const nowConfigured = this.isConfigured() // Recalculate based on current state

		// Check for transition from disabled/unconfigured to enabled+configured
		const transitionedToReady = (!prev.enabled || !prev.configured) && this.isEnabled && nowConfigured
		if (transitionedToReady) return true

		// If wasn't ready before and isn't ready now, no restart needed for config change itself
		if (!prev.configured && !nowConfigured) return false
		// If was disabled and still is, no restart needed
		if (!prev.enabled && !this.isEnabled) return false

		// Check for changes in relevant settings if the feature is enabled (or was enabled)
		if (this.isEnabled || prev.enabled) {
			// Check for embedder type change
			if (prev.embedderType !== this.embedderType) return true

			// Check OpenAI key change if using OpenAI
			if (this.embedderType === "openai" && prev.openAiKey !== this.openAiOptions?.openAiNativeApiKey) {
				return true
			}

			// Check Ollama settings change if using Ollama
			if (this.embedderType === "ollama") {
				if (
					prev.ollamaBaseUrl !== this.ollamaOptions?.ollamaBaseUrl ||
					prev.ollamaModelId !== this.ollamaOptions?.ollamaModelId
				) {
					return true
				}
			}

			// Check Qdrant settings changes
			if (prev.qdrantUrl !== this.qdrantUrl || prev.qdrantApiKey !== this.qdrantApiKey) {
				return true
			}
		}

		return false
	}

	/**
	 * Gets the current configuration state.
	 */
	public getConfig(): CodeIndexConfig {
		return {
			isEnabled: this.isEnabled,
			isConfigured: this.isConfigured(),
			embedderType: this.embedderType,
			openAiOptions: this.openAiOptions,
			ollamaOptions: this.ollamaOptions,
			qdrantUrl: this.qdrantUrl,
			qdrantApiKey: this.qdrantApiKey,
		}
	}

	/**
	 * Gets whether the code indexing feature is enabled
	 */
	public get isFeatureEnabled(): boolean {
		return this.isEnabled
	}

	/**
	 * Gets whether the code indexing feature is properly configured
	 */
	public get isFeatureConfigured(): boolean {
		return this.isConfigured()
	}

	/**
	 * Gets the current embedder type (openai or ollama)
	 */
	public get currentEmbedderType(): EmbedderType {
		return this.embedderType
	}

	/**
	 * Gets the current Qdrant configuration
	 */
	public get qdrantConfig(): { url?: string; apiKey?: string } {
		return {
			url: this.qdrantUrl,
			apiKey: this.qdrantApiKey,
		}
	}
}
