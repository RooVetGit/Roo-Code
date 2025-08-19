import { MessageHandlerStrategy, MessageHandlerContext } from "../types"
import { CopilotAuthenticator } from "../../../../api/providers/fetchers/copilot"

/**
 * Strategy for handling checkCopilotAuth message
 */
export class CheckCopilotAuthStrategy implements MessageHandlerStrategy {
	async handle(context: MessageHandlerContext): Promise<void> {
		const { provider } = context

		try {
			const authenticator = CopilotAuthenticator.getInstance()
			const isAuthenticated = await authenticator.isAuthenticated()

			provider.postMessageToWebview({
				type: "copilotAuthStatus",
				copilotAuthenticated: isAuthenticated,
			})
		} catch (error) {
			console.error("Failed to check Copilot authentication:", error)
			provider.postMessageToWebview({
				type: "copilotAuthStatus",
				copilotAuthenticated: false,
			})
		}
	}
}
