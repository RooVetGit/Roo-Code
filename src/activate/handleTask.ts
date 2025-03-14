import * as vscode from "vscode"
import { COMMAND_IDS } from "../core/CodeActionProvider"
import { ClineProvider } from "../core/webview/ClineProvider"

export const handleNewTask = async (params: { prompt?: string } | null | undefined) => {
	let prompt = params?.prompt
	if (!prompt) {
		prompt = await vscode.window.showInputBox({
			prompt: "What should Roo do?",
			placeHolder: "Type your task here",
		})
	}
	if (!prompt) {
		await vscode.commands.executeCommand("roo-cline.SidebarProvider.focus")
		return
	}

	await ClineProvider.handleCodeAction(COMMAND_IDS.NEW_TASK, "NEW_TASK", {
		userInput: prompt,
	})
}
