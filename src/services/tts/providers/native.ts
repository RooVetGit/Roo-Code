import { TtsProvider, TtsVoice, TtsPlayOptions } from "../interfaces/provider"

interface Say {
	speak: (text: string, voice?: string, speed?: number, callback?: (err?: string) => void) => void
	stop: () => void
}

/**
 * Native TTS provider using the OS's built-in text-to-speech engine
 */
export class NativeTtsProvider implements TtsProvider {
	readonly id = "native"
	readonly name = "System TTS"

	private sayInstance: Say | undefined
	private isInitialized = false

	async initialize(): Promise<void> {
		// Native provider doesn't need initialization
		this.isInitialized = true
	}

	async isAvailable(): Promise<boolean> {
		try {
			// Check if the say module can be loaded
			require("say")
			return true
		} catch {
			return false
		}
	}

	async getVoices(): Promise<TtsVoice[]> {
		// Native provider doesn't expose voice list
		// Return a default voice
		return [
			{
				id: "default",
				name: "System Default",
				language: "en-US",
			},
		]
	}

	async speak(text: string, options?: TtsPlayOptions): Promise<void> {
		if (!this.isInitialized) {
			throw new Error("Native TTS provider not initialized")
		}

		return new Promise<void>((resolve, reject) => {
			try {
				const say: Say = require("say")
				this.sayInstance = say

				options?.onStart?.()

				say.speak(text, undefined, options?.speed ?? 1.0, (err) => {
					options?.onStop?.()

					if (err) {
						reject(new Error(err))
					} else {
						resolve()
					}

					this.sayInstance = undefined
				})
			} catch (error) {
				this.sayInstance = undefined
				reject(error)
			}
		})
	}

	stop(): void {
		this.sayInstance?.stop()
		this.sayInstance = undefined
	}

	dispose(): void {
		this.stop()
		this.isInitialized = false
	}
}
