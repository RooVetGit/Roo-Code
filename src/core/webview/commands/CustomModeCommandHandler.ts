import * as vscode from "vscode"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"

/**
 * Handles custom mode-related webview messages
 */
export class CustomModeCommandHandler implements WebviewCommandHandler {
	async execute(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		switch (message.type) {
			case "updateCustomMode":
				if (message.modeConfig) {
					await provider.customModesManager.updateCustomMode(message.modeConfig.slug, message.modeConfig)
					// Update state after saving the mode
					const customModes = await provider.customModesManager.getCustomModes()
					await provider.settingsManager.updateGlobalState("customModes", customModes)
					await provider.settingsManager.updateGlobalState("mode", message.modeConfig.slug)
					await provider.postStateToWebview()
				}
				break

			case "deleteCustomMode":
				if (message.slug) {
					const answer = await vscode.window.showInformationMessage(
						"Are you sure you want to delete this custom mode?",
						{ modal: true },
						"Yes",
					)

					if (answer !== "Yes") {
						break
					}

					await provider.customModesManager.deleteCustomMode(message.slug)
					// Switch back to default mode after deletion
					await provider.settingsManager.updateGlobalState("mode", "default")
					await provider.postStateToWebview()
				}
				break
		}
	}
}
