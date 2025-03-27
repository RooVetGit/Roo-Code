import { ClineProvider } from "../../core/webview/ClineProvider"
import vscode from "vscode"
import delay from "delay"
import { RegisterCommandOptions, setPanel } from "../../activate/registerCommands"

/**
 * Opens a new tab for the Roo Code webview panel.
 *
 * It does this by:
 *
 * 1. Creating a new `ClineProvider` for the "editor" type.
 * 2. Determining the column to open the new panel in by taking the max of the
 *    columns of all visible text editors and adding 1. If there are no visible
 *    text editors, it opens a new group to the right.
 * 3. Creating a new webview panel with the determined column and options.
 * 4. Setting the panel as a tab type panel using `setPanel`.
 * 5. Setting the icon for the panel using a hardcoded svg icon (TODO: use a better
 *    icon).
 * 6. Resolving the webview view for the new panel using `resolveWebviewView`.
 * 7. Handling panel closing events by setting the panel to undefined in the
 *    `setPanel` function.
 * 8. Locking the editor group so clicking on files doesn't open them over the
 *    panel.
 *
 * @param options - The options to pass to the `ClineProvider` constructor.
 */
export const openClineInNewTab = async ({ context, outputChannel }: Omit<RegisterCommandOptions, "provider">) => {
	// (This example uses webviewProvider activation event which is necessary to
	// deserialize cached webview, but since we use retainContextWhenHidden, we
	// don't need to use that event).
	// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	const tabProvider = new ClineProvider(context, outputChannel, "editor")
	const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))

	// Check if there are any visible text editors, otherwise open a new group
	// to the right.
	const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0

	if (!hasVisibleEditors) {
		await vscode.commands.executeCommand("workbench.action.newGroupRight")
	}

	const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

	const newPanel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "Roo Code", targetCol, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [context.extensionUri],
	})

	// Save as tab type panel.
	setPanel(newPanel, "tab")

	// TODO: Use better svg icon with light and dark variants (see
	// https://stackoverflow.com/questions/58365687/vscode-extension-iconpath).
	newPanel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "rocket.png"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "rocket.png"),
	}

	await tabProvider.resolveWebviewView(newPanel)
	// Create and register the subscriber
	// const customInstructionsSubscriber = new CustomInstructionsSubscriber(contextProxy);
	// newPanel.webview.onDidReceiveMessage(
	// 	async (message) => {
	// 		await customInstructionsSubscriber.handleMessage(message);
	// 	}
	// );

	// Handle panel closing events.
	newPanel.onDidDispose(() => {
		setPanel(undefined, "tab")
	})

	// Lock the editor group so clicking on files doesn't open them over the panel.
	await delay(100)
	await vscode.commands.executeCommand("workbench.action.lockEditorGroup")
}
