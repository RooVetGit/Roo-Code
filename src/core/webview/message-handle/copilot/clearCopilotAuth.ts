import { MessageHandlerStrategy, MessageHandlerContext } from "../types"
import { CopilotAuthenticator } from "../../../../api/providers/fetchers/copilot"

/**
 * Strategy for handling clearCopilotAuth message
 */
export class ClearCopilotAuthStrategy implements MessageHandlerStrategy {
	async handle(context: MessageHandlerContext): Promise<void> {
		const { provider } = context

		try {
			const authenticator = CopilotAuthenticator.getInstance()
			await authenticator.clearAuth()
			provider.postMessageToWebview({
				type: "copilotAuthStatus",
				copilotAuthenticated: false,
			})
		} catch (error) {
			console.error("Failed to clear Copilot authentication:", error)
			provider.postMessageToWebview({
				type: "copilotAuthError",
				error: error instanceof Error ? error.message : "Failed to clear authentication",
			})
		}
	}
}
