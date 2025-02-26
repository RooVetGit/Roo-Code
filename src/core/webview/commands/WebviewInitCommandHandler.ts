import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"
import { getTheme } from "../../../integrations/theme/getTheme"
import { checkExistKey } from "../../../shared/checkExistApiConfig"

/**
 * Handles webview initialization-related messages
 */
export class WebviewInitCommandHandler implements WebviewCommandHandler {
	async execute(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		switch (message.type) {
			case "didShowAnnouncement":
				await provider.settingsManager.updateGlobalState(
					"lastShownAnnouncementId",
					provider.latestAnnouncementId,
				)
				await provider.postStateToWebview()
				break
		}
	}
}
