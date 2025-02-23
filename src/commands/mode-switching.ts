import * as vscode from "vscode"
import { modes } from "../shared/modes"
import { ClineProvider } from "../core/webview/ClineProvider"

export function registerModeSwitchingCommands(context: vscode.ExtensionContext) {
	let currentModeIndex = 0

	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.cycleModes", async () => {
			try {
				// Get next mode index
				currentModeIndex = (currentModeIndex + 1) % modes.length
				const nextMode = modes[currentModeIndex]

				// Get visible instance and send message
				const provider = await ClineProvider.getInstance()
				if (provider) {
					await provider.postMessageToWebview({
						type: "mode",
						text: nextMode.slug,
					})
				}

				vscode.window.showInformationMessage(`Switched to ${nextMode.name} mode`)
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to switch mode: ${error}`)
			}
		}),
	)
}
