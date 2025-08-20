import { IWebviewMessageHandler } from "../types"
import { ClineProvider } from "../../ClineProvider"
import { WebviewMessage } from "../../../../shared/WebviewMessage"

export class AlwaysAllowWriteProtectedHandler implements IWebviewMessageHandler {
	async handle(provider: ClineProvider, message: WebviewMessage): Promise<void> {
		await provider.contextProxy.setValue("alwaysAllowWriteProtected", message.bool ?? undefined)
		await provider.postStateToWebview()
	}
}
