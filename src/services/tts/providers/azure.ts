import { TtsProvider, TtsVoice, TtsPlayOptions } from "../interfaces/provider"

interface AzureConfig {
	subscriptionKey?: string
	region?: string
}

/**
 * Microsoft Azure Speech Services TTS provider
 */
export class AzureTtsProvider implements TtsProvider {
	readonly id = "azure"
	readonly name = "Azure Speech Services"

	private speechConfig: any
	private synthesizer: any
	private config: AzureConfig = {}
	private isInitialized = false
	private currentSynthesis: any

	async initialize(config?: AzureConfig): Promise<void> {
		this.config = config || {}

		if (!this.config.subscriptionKey || !this.config.region) {
			throw new Error("Azure subscription key and region are required")
		}

		try {
			// Dynamic import to avoid loading the SDK until needed
			const sdk = await import("microsoft-cognitiveservices-speech-sdk")

			// Create speech config with subscription key and region
			this.speechConfig = sdk.SpeechConfig.fromSubscription(this.config.subscriptionKey, this.config.region)

			// Create speech synthesizer
			this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig)

			this.isInitialized = true
		} catch (error) {
			throw new Error(`Failed to initialize Azure TTS: ${error}`)
		}
	}

	async isAvailable(): Promise<boolean> {
		return this.isInitialized && !!this.synthesizer
	}

	async getVoices(): Promise<TtsVoice[]> {
		if (!this.isInitialized || !this.synthesizer) {
			throw new Error("Azure TTS provider not initialized")
		}

		try {
			// Get available voices
			const result = await this.synthesizer.getVoicesAsync()

			if (result.voices) {
				return result.voices.map((voice: any) => ({
					id: voice.shortName,
					name: `${voice.localName} (${voice.locale})`,
					language: voice.locale,
					gender: voice.gender === 0 ? "female" : voice.gender === 1 ? "male" : "neutral",
					premium: voice.voiceType === "Neural",
				}))
			}

			return []
		} catch (error) {
			console.error("Failed to fetch Azure voices:", error)
			return []
		}
	}

	async speak(text: string, options?: TtsPlayOptions): Promise<void> {
		if (!this.isInitialized || !this.synthesizer) {
			throw new Error("Azure TTS provider not initialized")
		}

		return new Promise<void>((resolve, reject) => {
			try {
				options?.onStart?.()

				// Set voice if specified
				if (options?.voice) {
					this.speechConfig.speechSynthesisVoiceName = options.voice
				}

				// Set speech rate if specified
				if (options?.speed !== undefined) {
					// Azure uses a percentage format: 0% = normal, -50% = half speed, +100% = double speed
					const rate = ((options.speed - 1) * 100).toFixed(0)
					const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
						<prosody rate="${rate}%" pitch="${options?.pitch || 0}Hz" volume="${options?.volume ? options.volume * 100 : 100}">
							${this.escapeXml(text)}
						</prosody>
					</speak>`

					// Use SSML for synthesis
					this.currentSynthesis = this.synthesizer.speakSsmlAsync(
						ssml,
						(result: any) => {
							if (result) {
								options?.onStop?.()
								resolve()
							} else {
								options?.onStop?.()
								reject(new Error("Azure TTS synthesis failed"))
							}
							this.currentSynthesis = undefined
						},
						(error: any) => {
							options?.onStop?.()
							reject(new Error(`Azure TTS error: ${error}`))
							this.currentSynthesis = undefined
						},
					)
				} else {
					// Use plain text synthesis
					this.currentSynthesis = this.synthesizer.speakTextAsync(
						text,
						(result: any) => {
							if (result) {
								options?.onStop?.()
								resolve()
							} else {
								options?.onStop?.()
								reject(new Error("Azure TTS synthesis failed"))
							}
							this.currentSynthesis = undefined
						},
						(error: any) => {
							options?.onStop?.()
							reject(new Error(`Azure TTS error: ${error}`))
							this.currentSynthesis = undefined
						},
					)
				}
			} catch (error) {
				options?.onStop?.()
				reject(error)
				this.currentSynthesis = undefined
			}
		})
	}

	stop(): void {
		// Stop any ongoing synthesis
		if (this.synthesizer) {
			try {
				this.synthesizer.close()
				// Recreate synthesizer for next use
				const sdk = require("microsoft-cognitiveservices-speech-sdk")
				this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig)
			} catch (error) {
				console.error("Error stopping Azure TTS:", error)
			}
		}
		this.currentSynthesis = undefined
	}

	dispose(): void {
		this.stop()
		if (this.synthesizer) {
			this.synthesizer.close()
		}
		this.synthesizer = undefined
		this.speechConfig = undefined
		this.isInitialized = false
	}

	private escapeXml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;")
	}
}
