import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"

/**
 * Handles task history-related webview messages
 */
export class TaskHistoryCommandHandler implements WebviewCommandHandler {
	async execute(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		switch (message.type) {
			case "showTaskWithId":
				await provider.taskHistoryManager.showTaskWithId(message.text!)
				break

			case "deleteTaskWithId":
				if (message.text === provider.cline?.taskId) {
					await provider.clearTask()
				}
				await provider.taskHistoryManager.deleteTaskWithId(message.text!)
				await provider.postStateToWebview()
				break

			case "exportTaskWithId":
				await provider.taskHistoryManager.exportTaskWithId(message.text!)
				break
		}
	}
}
