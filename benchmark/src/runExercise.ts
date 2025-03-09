import * as vscode from "vscode"

import { ClineAPI } from "../../src/exports/cline"

import { waitFor } from "./utils"

export async function run() {
	const extension = vscode.extensions.getExtension<ClineAPI>("RooVeterinaryInc.roo-cline")

	if (!extension) {
		throw new Error("Extension not found.")
	}

	const api = extension.isActive ? extension.exports : await extension.activate()

	await api.sidebarProvider.updateGlobalState("apiProvider", "openrouter")
	await api.sidebarProvider.updateGlobalState("openRouterModelId", "anthropic/claude-3.7-sonnet")
	await api.sidebarProvider.updateGlobalState("autoApprovalEnabled", true)
	await api.sidebarProvider.updateGlobalState("alwaysAllowReadOnly", true)
	await api.sidebarProvider.updateGlobalState("alwaysAllowWrite", true)
	await api.sidebarProvider.updateGlobalState("alwaysAllowExecute", true)
	await api.sidebarProvider.updateGlobalState("alwaysAllowBrowser", true)
	await api.sidebarProvider.updateGlobalState("alwaysApproveResubmit", true)
	await api.sidebarProvider.updateGlobalState("alwaysAllowMcp", true)
	await api.sidebarProvider.updateGlobalState("alwaysAllowModeSwitch", true)

	await api.sidebarProvider.storeSecret("openRouterApiKey", process.env.OPENROUTER_API_KEY!)

	await vscode.workspace
		.getConfiguration("roo-cline")
		.update("allowedCommands", ["*"], vscode.ConfigurationTarget.Global)

	await api.sidebarProvider.resolveWebviewView(
		vscode.window.createWebviewPanel("roo-cline.SidebarProvider", "Roo Code", vscode.ViewColumn.One, {
			enableScripts: true,
			enableCommandUris: true,
			retainContextWhenHidden: true,
			localResourceRoots: [extension.extensionUri],
		}),
	)

	await waitFor(() => api.sidebarProvider.viewLaunched)

	await api.startNewTask(process.env.prompt!)

	let cursor = 0

	const getMessage = async () => {
		await waitFor(() => api.sidebarProvider.messages.length > cursor, { timeout: 120_000 }).catch(() => {})
		return api.sidebarProvider.messages[cursor++]
	}

	while (true) {
		const message = await getMessage()
		console.log("message = ", message)

		if (!message || message.say === "completion_result") {
			break
		}
	}

	console.log("🚀")
}
