import { IWebviewMessageHandler } from "../types"
import { ClineProvider } from "../../ClineProvider"
import { WebviewMessage } from "../../../../shared/WebviewMessage"
import { playTts } from "../../../../utils/tts"

export class PlayTtsHandler implements IWebviewMessageHandler {
	async handle(provider: ClineProvider, message: WebviewMessage): Promise<void> {
		if (message.text) {
			playTts(message.text, {
				onStart: () => provider.postMessageToWebview({ type: "ttsStart", text: message.text }),
				onStop: () => provider.postMessageToWebview({ type: "ttsStop", text: message.text }),
			})
		}
	}
}
