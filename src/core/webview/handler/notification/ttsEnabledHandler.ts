import { IWebviewMessageHandler } from "../types"
import { ClineProvider } from "../../ClineProvider"
import { WebviewMessage } from "../../../../shared/WebviewMessage"
import { setTtsEnabled } from "../../../../utils/tts"

export class TtsEnabledHandler implements IWebviewMessageHandler {
	async handle(provider: ClineProvider, message: WebviewMessage): Promise<void> {
		const ttsEnabled = message.bool ?? true
		await provider.contextProxy.setValue("ttsEnabled", ttsEnabled)
		setTtsEnabled(ttsEnabled)
		await provider.postStateToWebview()
	}
}
