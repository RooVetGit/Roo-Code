import * as vscode from "vscode"
import pWaitFor from "p-wait-for"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"
import { checkoutDiffPayloadSchema, checkoutRestorePayloadSchema } from "../../../shared/WebviewMessage"

/**
 * Handles task-related webview messages
 */
export class TaskCommandHandler implements WebviewCommandHandler {
	async execute(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		switch (message.type) {
			case "newTask":
				await provider.initClineWithTask(message.text, message.images)
				break

			case "clearTask":
				await provider.clearTask()
				await provider.postStateToWebview()
				break

			case "cancelTask":
				await provider.cancelTask()
				break

			case "askResponse":
				provider.cline?.handleWebviewAskResponse(message.askResponse!, message.text, message.images)
				break

			case "deleteMessage":
				await this.handleDeleteMessage(message, provider)
				break

			case "exportCurrentTask":
				const currentTaskId = provider.cline?.taskId
				if (currentTaskId) {
					await provider.taskHistoryManager.exportTaskWithId(currentTaskId)
				}
				break

			case "checkpointDiff":
				const diffResult = checkoutDiffPayloadSchema.safeParse(message.payload)
				if (diffResult.success) {
					await provider.cline?.checkpointDiff(diffResult.data)
				}
				break

			case "checkpointRestore": {
				const restoreResult = checkoutRestorePayloadSchema.safeParse(message.payload)
				if (restoreResult.success) {
					await provider.cancelTask()

					try {
						await pWaitFor(() => provider.cline?.isInitialized === true, { timeout: 3_000 })
					} catch (error) {
						vscode.window.showErrorMessage("Timed out when attempting to restore checkpoint.")
					}

					try {
						await provider.cline?.checkpointRestore(restoreResult.data)
					} catch (error) {
						vscode.window.showErrorMessage("Failed to restore checkpoint.")
					}
				}
				break
			}
		}
	}

	/**
	 * Handle message deletion
	 */
	private async handleDeleteMessage(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		const answer = await vscode.window.showInformationMessage(
			"What would you like to delete?",
			{ modal: true },
			"Just this message",
			"This and all subsequent messages",
		)

		if (
			(answer === "Just this message" || answer === "This and all subsequent messages") &&
			provider.cline &&
			typeof message.value === "number" &&
			message.value
		) {
			const timeCutoff = message.value - 1000 // 1 second buffer before the message to delete
			const messageIndex = provider.cline.clineMessages.findIndex((msg) => msg.ts && msg.ts >= timeCutoff)
			const apiConversationHistoryIndex = provider.cline.apiConversationHistory.findIndex(
				(msg) => msg.ts && msg.ts >= timeCutoff,
			)

			if (messageIndex !== -1) {
				const { historyItem } = await provider.taskHistoryManager.getTaskWithId(provider.cline.taskId)

				if (answer === "Just this message") {
					// Find the next user message first
					const nextUserMessage = provider.cline.clineMessages
						.slice(messageIndex + 1)
						.find((msg) => msg.type === "say" && msg.say === "user_feedback")

					// Handle UI messages
					if (nextUserMessage) {
						// Find absolute index of next user message
						const nextUserMessageIndex = provider.cline.clineMessages.findIndex(
							(msg) => msg === nextUserMessage,
						)
						// Keep messages before current message and after next user message
						await provider.cline.overwriteClineMessages([
							...provider.cline.clineMessages.slice(0, messageIndex),
							...provider.cline.clineMessages.slice(nextUserMessageIndex),
						])
					} else {
						// If no next user message, keep only messages before current message
						await provider.cline.overwriteClineMessages(provider.cline.clineMessages.slice(0, messageIndex))
					}

					// Handle API messages
					if (apiConversationHistoryIndex !== -1) {
						if (nextUserMessage && nextUserMessage.ts) {
							// Keep messages before current API message and after next user message
							await provider.cline.overwriteApiConversationHistory([
								...provider.cline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
								...provider.cline.apiConversationHistory.filter(
									(msg) => msg.ts && msg.ts >= nextUserMessage.ts,
								),
							])
						} else {
							// If no next user message, keep only messages before current API message
							await provider.cline.overwriteApiConversationHistory(
								provider.cline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
							)
						}
					}
				} else if (answer === "This and all subsequent messages") {
					// Delete this message and all that follow
					await provider.cline.overwriteClineMessages(provider.cline.clineMessages.slice(0, messageIndex))
					if (apiConversationHistoryIndex !== -1) {
						await provider.cline.overwriteApiConversationHistory(
							provider.cline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
						)
					}
				}

				await provider.initClineWithHistoryItem(historyItem)
			}
		}
	}
}
