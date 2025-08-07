import { TtsProvider, TtsVoice, TtsPlayOptions } from "../interfaces/provider"
import * as vscode from "vscode"

interface GoogleCloudConfig {
	apiKey?: string
	projectId?: string
}

/**
 * Google Cloud Text-to-Speech provider
 */
export class GoogleCloudTtsProvider implements TtsProvider {
	readonly id = "google-cloud"
	readonly name = "Google Cloud TTS"

	private client: any
	private config: GoogleCloudConfig = {}
	private isInitialized = false
	private audioPlayer: any

	async initialize(config?: GoogleCloudConfig): Promise<void> {
		this.config = config || {}

		if (!this.config.apiKey) {
			throw new Error("Google Cloud API key is required")
		}

		try {
			// Dynamic import to avoid loading the SDK until needed
			const { TextToSpeechClient } = await import("@google-cloud/text-to-speech")

			// Create client with API key authentication
			this.client = new TextToSpeechClient({
				apiKey: this.config.apiKey,
				projectId: this.config.projectId,
			})

			this.isInitialized = true
		} catch (error) {
			throw new Error(`Failed to initialize Google Cloud TTS: ${error}`)
		}
	}

	async isAvailable(): Promise<boolean> {
		return this.isInitialized && !!this.client
	}

	async getVoices(): Promise<TtsVoice[]> {
		if (!this.isInitialized || !this.client) {
			throw new Error("Google Cloud TTS provider not initialized")
		}

		try {
			const [response] = await this.client.listVoices({})

			return (
				response.voices?.map((voice: any) => ({
					id: voice.name,
					name: `${voice.name} (${voice.ssmlGender})`,
					language: voice.languageCodes?.[0],
					gender: voice.ssmlGender?.toLowerCase() as "male" | "female" | "neutral",
				})) || []
			)
		} catch (error) {
			console.error("Failed to fetch Google Cloud voices:", error)
			return []
		}
	}

	async speak(text: string, options?: TtsPlayOptions): Promise<void> {
		if (!this.isInitialized || !this.client) {
			throw new Error("Google Cloud TTS provider not initialized")
		}

		try {
			options?.onStart?.()

			// Prepare the request
			const request = {
				input: { text },
				voice: {
					languageCode: "en-US",
					name: options?.voice || "en-US-Neural2-F",
					ssmlGender: "FEMALE" as const,
				},
				audioConfig: {
					audioEncoding: "MP3" as const,
					speakingRate: options?.speed || 1.0,
					pitch: options?.pitch || 0,
					volumeGainDb: options?.volume ? (options.volume - 1) * 20 : 0,
				},
			}

			// Perform the text-to-speech request
			const [response] = await this.client.synthesizeSpeech(request)

			if (response.audioContent) {
				// Play the audio using the sound-play package
				const soundPlay = require("sound-play")

				// Save audio to temporary file
				const fs = require("fs")
				const path = require("path")
				const os = require("os")

				const tempFile = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`)
				fs.writeFileSync(tempFile, response.audioContent, "binary")

				// Play the audio file
				this.audioPlayer = soundPlay.play(tempFile)

				await this.audioPlayer

				// Clean up temp file
				fs.unlinkSync(tempFile)
			}

			options?.onStop?.()
		} catch (error) {
			options?.onStop?.()
			throw new Error(`Google Cloud TTS failed: ${error}`)
		}
	}

	stop(): void {
		// Stop any ongoing playback
		if (this.audioPlayer && typeof this.audioPlayer.kill === "function") {
			this.audioPlayer.kill()
		}
		this.audioPlayer = undefined
	}

	dispose(): void {
		this.stop()
		this.client = undefined
		this.isInitialized = false
	}
}
