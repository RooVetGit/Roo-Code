import { MessageHandlerStrategy, MessageHandlerContext } from "../types"
import { CopilotAuthenticator } from "../../../../api/providers/fetchers/copilot"

/**
 * Strategy for handling authenticateCopilot message
 */
export class AuthenticateCopilotStrategy implements MessageHandlerStrategy {
	async handle(context: MessageHandlerContext): Promise<void> {
		const { provider } = context

		// Start device code authentication for Copilot
		try {
			const authenticator = CopilotAuthenticator.getInstance()

			// Set up callbacks
			authenticator.setDeviceCodeCallback((deviceInfo) => {
				provider.postMessageToWebview({
					type: "copilotDeviceCode",
					copilotDeviceCode: {
						user_code: deviceInfo.user_code,
						verification_uri: deviceInfo.verification_uri,
						expires_in: deviceInfo.expires_in,
					},
				})
			})

			authenticator.setAuthTimeoutCallback((error) => {
				provider.postMessageToWebview({
					type: "copilotAuthError",
					error: error,
				})
			})

			await authenticator.getApiKey() // This will trigger the device code flow
			provider.postMessageToWebview({
				type: "copilotAuthStatus",
				copilotAuthenticated: true,
			})
		} catch (error) {
			console.error("Failed to authenticate with Copilot:", error)
			provider.postMessageToWebview({
				type: "copilotAuthError",
				error: error instanceof Error ? error.message : "Authentication failed",
			})
		}
	}
}
