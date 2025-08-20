import { IWebviewMessageHandler } from "../types"
import { ClineProvider } from "../../ClineProvider"
import { WebviewMessage } from "../../../../shared/WebviewMessage"

export class SoundVolumeHandler implements IWebviewMessageHandler {
	async handle(provider: ClineProvider, message: WebviewMessage): Promise<void> {
		const soundVolume = message.value ?? 0.5
		await provider.contextProxy.setValue("soundVolume", soundVolume)
		await provider.postStateToWebview()
	}
}
