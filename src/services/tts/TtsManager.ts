import * as vscode from "vscode"
import { TtsProvider, TtsVoice, TtsPlayOptions } from "./interfaces/provider"
import { NativeTtsProvider } from "./providers/native"
import { GoogleCloudTtsProvider } from "./providers/google-cloud"
import { AzureTtsProvider } from "./providers/azure"

export type TtsProviderType = "native" | "google-cloud" | "azure"

interface TtsManagerConfig {
	provider?: TtsProviderType
	googleCloud?: {
		apiKey?: string
		projectId?: string
	}
	azure?: {
		subscriptionKey?: string
		region?: string
	}
}

interface QueueItem {
	text: string
	options: TtsPlayOptions
}

/**
 * Manages TTS providers and handles speech synthesis
 */
export class TtsManager {
	private static instance: TtsManager
	private providers: Map<string, TtsProvider> = new Map()
	private activeProvider: TtsProvider | null = null
	private activeProviderId: TtsProviderType = "native"
	private queue: QueueItem[] = []
	private isProcessing = false
	private isEnabled = false
	private globalSpeed = 1.0

	private constructor() {
		// Initialize with native provider by default
		this.registerProvider(new NativeTtsProvider())
	}

	static getInstance(): TtsManager {
		if (!TtsManager.instance) {
			TtsManager.instance = new TtsManager()
		}
		return TtsManager.instance
	}

	/**
	 * Register a TTS provider
	 */
	private registerProvider(provider: TtsProvider): void {
		this.providers.set(provider.id, provider)
	}

	/**
	 * Initialize the TTS manager with configuration
	 */
	async initialize(config: TtsManagerConfig): Promise<void> {
		// Set the active provider
		this.activeProviderId = config.provider || "native"

		// Initialize providers based on configuration
		if (config.googleCloud?.apiKey) {
			const googleProvider = new GoogleCloudTtsProvider()
			try {
				await googleProvider.initialize(config.googleCloud)
				this.registerProvider(googleProvider)
			} catch (error) {
				console.error("Failed to initialize Google Cloud TTS:", error)
				vscode.window.showErrorMessage(`Failed to initialize Google Cloud TTS: ${error}`)
			}
		}

		if (config.azure?.subscriptionKey && config.azure?.region) {
			const azureProvider = new AzureTtsProvider()
			try {
				await azureProvider.initialize(config.azure)
				this.registerProvider(azureProvider)
			} catch (error) {
				console.error("Failed to initialize Azure TTS:", error)
				vscode.window.showErrorMessage(`Failed to initialize Azure TTS: ${error}`)
			}
		}

		// Set the active provider
		await this.setActiveProvider(this.activeProviderId)
	}

	/**
	 * Set the active TTS provider
	 */
	async setActiveProvider(providerId: TtsProviderType): Promise<void> {
		const provider = this.providers.get(providerId)

		if (!provider) {
			// Fall back to native provider
			this.activeProviderId = "native"
			this.activeProvider = this.providers.get("native") || null

			if (providerId !== "native") {
				vscode.window.showWarningMessage(
					`TTS provider '${providerId}' not available. Falling back to native TTS.`,
				)
			}
			return
		}

		// Initialize the provider if needed
		if (!(await provider.isAvailable())) {
			try {
				await provider.initialize()
			} catch (error) {
				console.error(`Failed to initialize provider ${providerId}:`, error)
				vscode.window.showErrorMessage(`Failed to initialize ${provider.name}: ${error}`)

				// Fall back to native provider
				if (providerId !== "native") {
					await this.setActiveProvider("native")
				}
				return
			}
		}

		this.activeProvider = provider
		this.activeProviderId = providerId
	}

	/**
	 * Get the active provider ID
	 */
	getActiveProviderId(): TtsProviderType {
		return this.activeProviderId
	}

	/**
	 * Get available providers
	 */
	async getAvailableProviders(): Promise<Array<{ id: string; name: string }>> {
		const available = []

		for (const [id, provider] of this.providers) {
			if (await provider.isAvailable()) {
				available.push({ id, name: provider.name })
			}
		}

		return available
	}

	/**
	 * Get voices from the active provider
	 */
	async getVoices(): Promise<TtsVoice[]> {
		if (!this.activeProvider) {
			return []
		}

		try {
			return await this.activeProvider.getVoices()
		} catch (error) {
			console.error("Failed to get voices:", error)
			return []
		}
	}

	/**
	 * Set whether TTS is enabled
	 */
	setEnabled(enabled: boolean): void {
		this.isEnabled = enabled
		if (!enabled) {
			this.stop()
		}
	}

	/**
	 * Set the global speech speed
	 */
	setSpeed(speed: number): void {
		this.globalSpeed = speed
	}

	/**
	 * Speak text using the active provider
	 */
	async speak(text: string, options: TtsPlayOptions = {}): Promise<void> {
		if (!this.isEnabled) {
			return
		}

		// Add to queue
		this.queue.push({ text, options })

		// Process queue if not already processing
		if (!this.isProcessing) {
			await this.processQueue()
		}
	}

	/**
	 * Process the speech queue
	 */
	private async processQueue(): Promise<void> {
		if (!this.isEnabled || this.isProcessing) {
			return
		}

		const item = this.queue.shift()
		if (!item) {
			return
		}

		this.isProcessing = true

		try {
			if (!this.activeProvider) {
				await this.setActiveProvider("native")
			}

			if (this.activeProvider) {
				// Merge global speed with item options
				const mergedOptions: TtsPlayOptions = {
					...item.options,
					speed: item.options.speed ?? this.globalSpeed,
				}

				await this.activeProvider.speak(item.text, mergedOptions)
			}
		} catch (error) {
			console.error("TTS error:", error)
			vscode.window.showErrorMessage(`TTS error: ${error}`)
		} finally {
			this.isProcessing = false

			// Process next item in queue
			if (this.queue.length > 0) {
				await this.processQueue()
			}
		}
	}

	/**
	 * Stop any ongoing speech and clear the queue
	 */
	stop(): void {
		// Clear the queue
		this.queue = []
		this.isProcessing = false

		// Stop the active provider
		if (this.activeProvider) {
			this.activeProvider.stop()
		}
	}

	/**
	 * Dispose of all providers and clean up resources
	 */
	dispose(): void {
		this.stop()

		for (const provider of this.providers.values()) {
			provider.dispose()
		}

		this.providers.clear()
		this.activeProvider = null
	}
}
