/**
 * Voice information for TTS providers
 */
export interface TtsVoice {
	id: string
	name: string
	language?: string
	gender?: "male" | "female" | "neutral"
	premium?: boolean
}

/**
 * Options for TTS playback
 */
export interface TtsPlayOptions {
	voice?: string
	speed?: number
	pitch?: number
	volume?: number
	onStart?: () => void
	onStop?: () => void
}

/**
 * Base interface for all TTS providers
 */
export interface TtsProvider {
	/**
	 * Unique identifier for the provider
	 */
	readonly id: string

	/**
	 * Display name for the provider
	 */
	readonly name: string

	/**
	 * Initialize the provider with configuration
	 */
	initialize(config?: Record<string, any>): Promise<void>

	/**
	 * Check if the provider is available and configured
	 */
	isAvailable(): Promise<boolean>

	/**
	 * Get available voices from the provider
	 */
	getVoices(): Promise<TtsVoice[]>

	/**
	 * Speak the given text
	 */
	speak(text: string, options?: TtsPlayOptions): Promise<void>

	/**
	 * Stop any ongoing speech
	 */
	stop(): void

	/**
	 * Clean up resources
	 */
	dispose(): void
}
