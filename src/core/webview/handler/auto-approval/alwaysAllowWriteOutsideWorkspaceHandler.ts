import { IWebviewMessageHandler } from "../types"
import { ClineProvider } from "../../ClineProvider"
import { WebviewMessage } from "../../../../shared/WebviewMessage"

export class AlwaysAllowWriteOutsideWorkspaceHandler implements IWebviewMessageHandler {
	async handle(provider: ClineProvider, message: WebviewMessage): Promise<void> {
		await provider.contextProxy.setValue("alwaysAllowWriteOutsideWorkspace", message.bool ?? undefined)
		await provider.postStateToWebview()
	}
}
