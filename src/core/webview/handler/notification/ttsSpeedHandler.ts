import { IWebviewMessageHandler } from "../types"
import { ClineProvider } from "../../ClineProvider"
import { WebviewMessage } from "../../../../shared/WebviewMessage"
import { setTtsSpeed } from "../../../../utils/tts"

export class TtsSpeedHandler implements IWebviewMessageHandler {
	async handle(provider: ClineProvider, message: WebviewMessage): Promise<void> {
		const ttsSpeed = message.value ?? 1.0
		await provider.contextProxy.setValue("ttsSpeed", ttsSpeed)
		setTtsSpeed(ttsSpeed)
		await provider.postStateToWebview()
	}
}
