import { TtsManager } from "../services/tts/TtsManager"

type PlayTtsOptions = {
	onStart?: () => void
	onStop?: () => void
}

// Get the singleton TTS manager instance
const ttsManager = TtsManager.getInstance()

/**
 * Enable or disable TTS
 */
export const setTtsEnabled = (enabled: boolean) => {
	ttsManager.setEnabled(enabled)
}

/**
 * Set the TTS speed
 */
export const setTtsSpeed = (newSpeed: number) => {
	ttsManager.setSpeed(newSpeed)
}

/**
 * Play text-to-speech
 */
export const playTts = async (message: string, options: PlayTtsOptions = {}) => {
	await ttsManager.speak(message, options)
}

/**
 * Stop any ongoing TTS playback
 */
export const stopTts = () => {
	ttsManager.stop()
}

/**
 * Initialize TTS with configuration
 * This should be called when the extension activates
 */
export const initializeTts = async (config?: {
	provider?: "native" | "google-cloud" | "azure"
	googleCloudApiKey?: string
	googleCloudProjectId?: string
	azureSubscriptionKey?: string
	azureRegion?: string
}) => {
	await ttsManager.initialize({
		provider: config?.provider,
		googleCloud: {
			apiKey: config?.googleCloudApiKey,
			projectId: config?.googleCloudProjectId,
		},
		azure: {
			subscriptionKey: config?.azureSubscriptionKey,
			region: config?.azureRegion,
		},
	})
}

/**
 * Get available TTS providers
 */
export const getAvailableTtsProviders = async () => {
	return await ttsManager.getAvailableProviders()
}

/**
 * Set the active TTS provider
 */
export const setTtsProvider = async (provider: "native" | "google-cloud" | "azure") => {
	await ttsManager.setActiveProvider(provider)
}

/**
 * Get voices from the active provider
 */
export const getTtsVoices = async () => {
	return await ttsManager.getVoices()
}
