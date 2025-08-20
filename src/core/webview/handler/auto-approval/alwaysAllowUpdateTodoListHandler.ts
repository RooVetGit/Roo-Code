import { IWebviewMessageHandler } from "../types"
import { ClineProvider } from "../../ClineProvider"
import { WebviewMessage } from "../../../../shared/WebviewMessage"

export class AlwaysAllowUpdateTodoListHandler implements IWebviewMessageHandler {
	async handle(provider: ClineProvider, message: WebviewMessage): Promise<void> {
		await provider.contextProxy.setValue("alwaysAllowUpdateTodoList", message.bool)
		await provider.postStateToWebview()
	}
}
