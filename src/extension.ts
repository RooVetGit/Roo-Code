// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import delay from "delay"
import * as vscode from "vscode"
import { ClineProvider } from "./core/webview/ClineProvider"
import { createClineAPI } from "./exports"
import "./utils/path" // necessary to have access to String.prototype.toPosix
import { ACTION_NAMES, CodeActionProvider } from "./core/CodeActionProvider"
import { explainCodePrompt, fixCodePrompt, improveCodePrompt } from "./core/prompts/code-actions"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { SemanticSearchConfig, SemanticSearchService } from "./services/semantic-search"
import * as path from "path"
import fs from "fs/promises"

/*
Built using https://github.com/microsoft/vscode-webview-ui-toolkit

Inspired by
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra

*/

let outputChannel: vscode.OutputChannel

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel("Roo-Code")
	context.subscriptions.push(outputChannel)

	outputChannel.appendLine("Roo-Code extension activated")

	// Get default commands from configuration
	const defaultCommands = vscode.workspace.getConfiguration("roo-cline").get<string[]>("allowedCommands") || []

	// Initialize global state if not already set
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}

	const semanticSearchService = initializeSemanticSearchService(context)

	const sidebarProvider = new ClineProvider(context, outputChannel, semanticSearchService)

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, sidebarProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.plusButtonClicked", async () => {
			outputChannel.appendLine("Plus button Clicked")
			await sidebarProvider.clearTask()
			await sidebarProvider.postStateToWebview()
			await sidebarProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.mcpButtonClicked", () => {
			sidebarProvider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.promptsButtonClicked", () => {
			sidebarProvider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
		}),
	)

	const openClineInNewTab = async () => {
		outputChannel.appendLine("Opening Roo Code in new tab")
		// (this example uses webviewProvider activation event which is necessary to deserialize cached webview, but since we use retainContextWhenHidden, we don't need to use that event)
		// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
		const tabProvider = new ClineProvider(context, outputChannel)
		//const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined
		const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))

		// Check if there are any visible text editors, otherwise open a new group to the right
		const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0
		if (!hasVisibleEditors) {
			await vscode.commands.executeCommand("workbench.action.newGroupRight")
		}
		const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

		const panel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "Roo Code", targetCol, {
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [context.extensionUri],
		})
		// TODO: use better svg icon with light and dark variants (see https://stackoverflow.com/questions/58365687/vscode-extension-iconpath)

		panel.iconPath = {
			light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "rocket.png"),
			dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "rocket.png"),
		}
		tabProvider.resolveWebviewView(panel)

		// Lock the editor group so clicking on files doesn't open them over the panel
		await delay(100)
		await vscode.commands.executeCommand("workbench.action.lockEditorGroup")
	}

	context.subscriptions.push(vscode.commands.registerCommand("roo-cline.popoutButtonClicked", openClineInNewTab))
	context.subscriptions.push(vscode.commands.registerCommand("roo-cline.openInNewTab", openClineInNewTab))

	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.settingsButtonClicked", () => {
			//vscode.window.showInformationMessage(message)
			sidebarProvider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.historyButtonClicked", () => {
			sidebarProvider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
		}),
	)

	/*
	We use the text document content provider API to show the left side for diff view by creating a virtual document for the original content. This makes it readonly so users know to edit the right side if they want to keep their changes.

	- This API allows you to create readonly documents in VSCode from arbitrary sources, and works by claiming an uri-scheme for which your provider then returns text contents. The scheme must be provided when registering a provider and cannot change afterwards.
	- Note how the provider doesn't create uris for virtual documents - its role is to provide contents given such an uri. In return, content providers are wired into the open document logic so that providers are always considered.
	https://code.visualstudio.com/api/extension-guides/virtual-documents
	*/
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
	)

	// URI Handler
	const handleUri = async (uri: vscode.Uri) => {
		const path = uri.path
		const query = new URLSearchParams(uri.query.replace(/\+/g, "%2B"))
		const visibleProvider = ClineProvider.getVisibleInstance()
		if (!visibleProvider) {
			return
		}
		switch (path) {
			case "/glama": {
				const code = query.get("code")
				if (code) {
					await visibleProvider.handleGlamaCallback(code)
				}
				break
			}

			case "/openrouter": {
				const code = query.get("code")
				if (code) {
					await visibleProvider.handleOpenRouterCallback(code)
				}
				break
			}
			default:
				break
		}
	}
	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	// Register code actions provider
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			{ pattern: "**/*" },
			new CodeActionProvider(),
			{
				providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds
			}
		)
	);

	// Helper function to handle code actions
	const registerCodeAction = (
		context: vscode.ExtensionContext,
		command: string,
		promptType: keyof typeof ACTION_NAMES,
		inputPrompt: string,
		inputPlaceholder: string
	) => {
		context.subscriptions.push(
			vscode.commands.registerCommand(command, async (filePath: string, selectedText: string, diagnostics?: any[]) => {
				const userInput = await vscode.window.showInputBox({
					prompt: inputPrompt,
					placeHolder: inputPlaceholder
				});

				const params = {
					filePath,
					selectedText,
					...(diagnostics ? { diagnostics } : {}),
					...(userInput ? { userInput } : {})
				};

				await ClineProvider.handleCodeAction(promptType, params);
			})
		);
	};

	// Register code action commands
	registerCodeAction(
		context,
		"roo-cline.explainCode",
		'EXPLAIN',
		"Any specific questions about this code?",
		"E.g. How does the error handling work?"
	);

	registerCodeAction(
		context,
		"roo-cline.fixCode",
		'FIX',
		"Any specific concerns about fixing this code?",
		"E.g. Maintain backward compatibility"
	);

	registerCodeAction(
		context,
		"roo-cline.improveCode",
		'IMPROVE',
		"Any specific aspects you want to improve?",
		"E.g. Focus on performance optimization"
	);

	return createClineAPI(outputChannel, sidebarProvider)
}

// This method is called when your extension is deactivated
export function deactivate() {
	outputChannel.appendLine("Roo-Code extension deactivated")
}

async function initializeSemanticSearchService(context: vscode.ExtensionContext): Promise<SemanticSearchService> {
	const cacheDir = path.join(context.globalStorageUri.fsPath, "cache")
	await fs.mkdir(cacheDir, { recursive: true })

	const config: SemanticSearchConfig = {
		storageDir: cacheDir,
		context: context,
		maxResults: (await context.globalState.get("semanticSearchMaxResults")) as number | undefined,
	}

	const service = new SemanticSearchService(config)

	await service.initialize()

	return service
}
