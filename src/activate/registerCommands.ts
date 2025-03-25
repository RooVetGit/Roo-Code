import * as vscode from "vscode"
import { openClineInNewTab } from "../integrations/tab/OpenTab"

import { ClineProvider } from "../core/webview/ClineProvider"

import { handleHumanRelayResponse, registerHumanRelayCallback, unregisterHumanRelayCallback } from "./humanRelay"

// Store panel references in both modes
let sidebarPanel: vscode.WebviewView | undefined = undefined
let tabPanel: vscode.WebviewPanel | undefined = undefined

/**
 * Get the currently active panel
 * @returns WebviewPanel或WebviewView
 */
export function getPanel(): vscode.WebviewPanel | vscode.WebviewView | undefined {
	return tabPanel || sidebarPanel
}

/**
 * Set panel references
 */
export function setPanel(
	newPanel: vscode.WebviewPanel | vscode.WebviewView | undefined,
	type: "sidebar" | "tab",
): void {
	if (type === "sidebar") {
		sidebarPanel = newPanel as vscode.WebviewView
		tabPanel = undefined
	} else {
		tabPanel = newPanel as vscode.WebviewPanel
		sidebarPanel = undefined
	}
}

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: ClineProvider
}

/**
 * Registers all commands for the extension.
 * @param {RegisterCommandOptions} options The options to register commands with.
 * @returns {void}
 */
export const registerCommands = (options: RegisterCommandOptions): void => {
	const { context, outputChannel } = options

	for (const [command, callback] of Object.entries(getCommandsMap(options))) {
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

/**
 * Generates a map of command names to functions that handle those commands.
 *
 * @param {RegisterCommandOptions} options The options to register commands with.
 * @returns {Record<string, (...args: any[]) => void>} A map of command names to functions.
 */
const getCommandsMap = ({ context, outputChannel, provider }: RegisterCommandOptions) => {
	return {
		"roo-cline.plusButtonClicked": async () => {
			await provider.removeClineFromStack()
			await provider.postStateToWebview()
			await provider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		},
		"roo-cline.mcpButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
		},
		"roo-cline.promptsButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
		},
		"roo-cline.popoutButtonClicked": () => openClineInNewTab({ context, outputChannel }),
		"roo-cline.openInNewTab": () => openClineInNewTab({ context, outputChannel }),
		"roo-cline.settingsButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		},
		"roo-cline.historyButtonClicked": () => {
			provider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
		},
		"roo-cline.helpButtonClicked": () => {
			vscode.env.openExternal(vscode.Uri.parse("https://docs.roocode.com"))
		},
		"roo-cline.showHumanRelayDialog": (params: { requestId: string; promptText: string }) => {
			const panel = getPanel()

			if (panel) {
				panel?.webview.postMessage({
					type: "showHumanRelayDialog",
					requestId: params.requestId,
					promptText: params.promptText,
				})
			}
		},
		"roo-cline.registerHumanRelayCallback": registerHumanRelayCallback,
		"roo-cline.unregisterHumanRelayCallback": unregisterHumanRelayCallback,
		"roo-cline.handleHumanRelayResponse": handleHumanRelayResponse,
	}
}
