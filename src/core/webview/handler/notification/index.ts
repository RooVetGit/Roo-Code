import { IWebviewMessageHandlerRegistry } from "../types"
import { SoundEnabledHandler } from "./soundEnabledHandler"
import { SoundVolumeHandler } from "./soundVolumeHandler"
import { TtsEnabledHandler } from "./ttsEnabledHandler"
import { TtsSpeedHandler } from "./ttsSpeedHandler"
import { PlayTtsHandler } from "./playTtsHandler"
import { StopTtsHandler } from "./stopTtsHandler"

export function registerNotificationHandler(register: IWebviewMessageHandlerRegistry) {
	register.registerHandler("soundEnabled", new SoundEnabledHandler())
	register.registerHandler("soundVolume", new SoundVolumeHandler())
	register.registerHandler("ttsEnabled", new TtsEnabledHandler())
	register.registerHandler("ttsSpeed", new TtsSpeedHandler())
	register.registerHandler("playTts", new PlayTtsHandler())
	register.registerHandler("stopTts", new StopTtsHandler())
}
