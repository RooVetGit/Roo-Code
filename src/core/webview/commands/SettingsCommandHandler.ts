import * as vscode from "vscode"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"
import { Mode } from "../../../shared/modes"

/**
 * Handles settings-related webview messages
 */
export class SettingsCommandHandler implements WebviewCommandHandler {
	async execute(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		switch (message.type) {
			case "customInstructions":
				await provider.updateCustomInstructions(message.text)
				break

			case "alwaysAllowReadOnly":
				await provider.settingsManager.updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined)
				await provider.postStateToWebview()
				break

			case "alwaysAllowWrite":
				await provider.settingsManager.updateGlobalState("alwaysAllowWrite", message.bool ?? undefined)
				await provider.postStateToWebview()
				break

			case "alwaysAllowExecute":
				await provider.settingsManager.updateGlobalState("alwaysAllowExecute", message.bool ?? undefined)
				await provider.postStateToWebview()
				break

			case "alwaysAllowBrowser":
				await provider.settingsManager.updateGlobalState("alwaysAllowBrowser", message.bool ?? undefined)
				await provider.postStateToWebview()
				break

			case "alwaysAllowMcp":
				await provider.settingsManager.updateGlobalState("alwaysAllowMcp", message.bool)
				await provider.postStateToWebview()
				break

			case "alwaysAllowModeSwitch":
				await provider.settingsManager.updateGlobalState("alwaysAllowModeSwitch", message.bool)
				await provider.postStateToWebview()
				break

			case "diffEnabled":
				const diffEnabled = message.bool ?? true
				await provider.settingsManager.updateGlobalState("diffEnabled", diffEnabled)
				await provider.postStateToWebview()
				break

			case "checkpointsEnabled":
				const checkpointsEnabled = message.bool ?? false
				await provider.settingsManager.updateGlobalState("checkpointsEnabled", checkpointsEnabled)
				await provider.postStateToWebview()
				break

			case "browserViewportSize":
				const browserViewportSize = message.text ?? "900x600"
				await provider.settingsManager.updateGlobalState("browserViewportSize", browserViewportSize)
				await provider.postStateToWebview()
				break

			case "fuzzyMatchThreshold":
				await provider.settingsManager.updateGlobalState("fuzzyMatchThreshold", message.value)
				await provider.postStateToWebview()
				break

			case "alwaysApproveResubmit":
				await provider.settingsManager.updateGlobalState("alwaysApproveResubmit", message.bool ?? false)
				await provider.postStateToWebview()
				break

			case "requestDelaySeconds":
				await provider.settingsManager.updateGlobalState("requestDelaySeconds", message.value ?? 5)
				await provider.postStateToWebview()
				break

			case "rateLimitSeconds":
				await provider.settingsManager.updateGlobalState("rateLimitSeconds", message.value ?? 0)
				await provider.postStateToWebview()
				break

			case "preferredLanguage":
				await provider.settingsManager.updateGlobalState("preferredLanguage", message.text)
				await provider.postStateToWebview()
				break

			case "writeDelayMs":
				await provider.settingsManager.updateGlobalState("writeDelayMs", message.value)
				await provider.postStateToWebview()
				break

			case "terminalOutputLineLimit":
				await provider.settingsManager.updateGlobalState("terminalOutputLineLimit", message.value)
				await provider.postStateToWebview()
				break

			case "screenshotQuality":
				await provider.settingsManager.updateGlobalState("screenshotQuality", message.value)
				await provider.postStateToWebview()
				break

			case "maxOpenTabsContext":
				const tabCount = Math.min(Math.max(0, message.value ?? 20), 500)
				await provider.settingsManager.updateGlobalState("maxOpenTabsContext", tabCount)
				await provider.postStateToWebview()
				break

			case "enhancementApiConfigId":
				await provider.settingsManager.updateGlobalState("enhancementApiConfigId", message.text)
				await provider.postStateToWebview()
				break

			case "autoApprovalEnabled":
				await provider.settingsManager.updateGlobalState("autoApprovalEnabled", message.bool ?? false)
				await provider.postStateToWebview()
				break

			case "mode":
				await provider.handleModeSwitch(message.text as Mode)
				break

			case "allowedCommands":
				await provider.context.globalState.update("allowedCommands", message.commands)
				// Also update workspace settings
				await vscode.workspace
					.getConfiguration("roo-cline")
					.update("allowedCommands", message.commands, vscode.ConfigurationTarget.Global)
				break
		}
	}
}
