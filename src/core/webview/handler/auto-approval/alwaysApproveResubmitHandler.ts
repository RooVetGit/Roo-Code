import { IWebviewMessageHandler } from "../types"
import { ClineProvider } from "../../ClineProvider"
import { WebviewMessage } from "../../../../shared/WebviewMessage"

export class AlwaysApproveResubmitHandler implements IWebviewMessageHandler {
	async handle(provider: ClineProvider, message: WebviewMessage): Promise<void> {
		await provider.contextProxy.setValue("alwaysApproveResubmit", message.bool ?? false)
		await provider.postStateToWebview()
	}
}
