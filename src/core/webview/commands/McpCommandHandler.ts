import * as vscode from "vscode"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"
import { openFile } from "../../../integrations/misc/open-file"

/**
 * Handles MCP-related webview messages
 */
export class McpCommandHandler implements WebviewCommandHandler {
	async execute(message: WebviewMessage, provider: ClineProviderInterface): Promise<void> {
		switch (message.type) {
			case "openMcpSettings": {
				const mcpSettingsFilePath = await provider.getMcpHub()?.getMcpSettingsFilePath()
				if (mcpSettingsFilePath) {
					openFile(mcpSettingsFilePath)
				}
				break
			}

			case "deleteMcpServer": {
				if (!message.serverName) {
					break
				}

				try {
					provider.outputChannel.appendLine(`Attempting to delete MCP server: ${message.serverName}`)
					await provider.getMcpHub()?.deleteServer(message.serverName)
					provider.outputChannel.appendLine(`Successfully deleted MCP server: ${message.serverName}`)
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					provider.outputChannel.appendLine(`Failed to delete MCP server: ${errorMessage}`)
					// Error messages are already handled by McpHub.deleteServer
				}
				break
			}

			case "restartMcpServer": {
				try {
					await provider.getMcpHub()?.restartConnection(message.text!)
				} catch (error) {
					provider.outputChannel.appendLine(
						`Failed to retry connection for ${message.text}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
				}
				break
			}

			case "toggleToolAlwaysAllow": {
				try {
					await provider
						.getMcpHub()
						?.toggleToolAlwaysAllow(message.serverName!, message.toolName!, message.alwaysAllow!)
				} catch (error) {
					provider.outputChannel.appendLine(
						`Failed to toggle auto-approve for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
				}
				break
			}

			case "toggleMcpServer": {
				try {
					await provider.getMcpHub()?.toggleServerDisabled(message.serverName!, message.disabled!)
				} catch (error) {
					provider.outputChannel.appendLine(
						`Failed to toggle MCP server ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
				}
				break
			}

			case "mcpEnabled":
				const mcpEnabled = message.bool ?? true
				await provider.settingsManager.updateGlobalState("mcpEnabled", mcpEnabled)
				await provider.postStateToWebview()
				break

			case "enableMcpServerCreation":
				await provider.settingsManager.updateGlobalState("enableMcpServerCreation", message.bool ?? true)
				await provider.postStateToWebview()
				break

			case "updateMcpTimeout":
				if (message.serverName && typeof message.timeout === "number") {
					try {
						await provider.getMcpHub()?.updateServerTimeout(message.serverName, message.timeout)
					} catch (error) {
						provider.outputChannel.appendLine(
							`Failed to update timeout for ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
						)
						vscode.window.showErrorMessage("Failed to update server timeout")
					}
				}
				break
		}
	}
}
