// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import delay from "delay"
import * as vscode from "vscode"
import { ClineProvider } from "./core/webview/ClineProvider"
import { createClineAPI } from "./exports"
import "./utils/path" // necessary to have access to String.prototype.toPosix
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { SemanticSearchService } from "./services/semantic-search"
import * as path from "path"

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
	outputChannel = vscode.window.createOutputChannel("Roo-Cline")
	context.subscriptions.push(outputChannel)

	outputChannel.appendLine("Roo-Cline extension activated")

	// Initialize Semantic Search Service
	const semanticSearchService = new SemanticSearchService({
		storageDir: path.join(context.globalStorageUri.fsPath, "semantic-search"),
		context: context,
		maxMemoryBytes: 100 * 1024 * 1024, // 100MB
		minScore: 0.75,
		maxResults: 10,
	})

	// Attempt to initialize semantic search service
	const initializeSemanticSearch = async () => {
		try {
			// Check if workspace is already indexed
			const workspaceFolders = vscode.workspace.workspaceFolders
			if (workspaceFolders && workspaceFolders.length > 0) {
				const workspaceUri = workspaceFolders[0].uri
				outputChannel.appendLine(`Initializing semantic search for workspace: ${workspaceUri.path}`)

				// Create a progress notification
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: "Semantic Search Indexing",
						cancellable: false,
					},
					async (progress) => {
						try {
							// Update progress at the start
							progress.report({ message: "Starting indexing...", increment: 10 })

							// Initialize model
							progress.report({ message: "Initializing model...", increment: 20 })
							await semanticSearchService.initialize()

							// Index workspace files
							progress.report({ message: "Indexing workspace files...", increment: 40 })
							const files = await vscode.workspace.findFiles(
								"**/*.{ts,js,tsx,jsx,py,java,cpp,c,h,hpp}",
								"**/node_modules/**",
							)
							outputChannel.appendLine(`Found ${files.length} files to index`)

							// Read and index files
							const definitions = await Promise.all(
								files.map(async (file) => {
									const content = await vscode.workspace.fs.readFile(file)
									return {
										type: "file",
										name: path.basename(file.fsPath),
										filePath: file.fsPath,
										content: Buffer.from(content).toString("utf-8"),
										startLine: 0,
										endLine: 100, // TODO: Get actual line count
									}
								}),
							)

							// Batch index the files
							await semanticSearchService.addBatchToIndex(definitions)

							// Final progress update
							progress.report({ message: "Indexing completed successfully", increment: 100 })
							outputChannel.appendLine("Semantic search service initialized successfully")

							// Give time for the success message to be visible
							await new Promise((resolve) => setTimeout(resolve, 1500))
						} catch (initError) {
							// Update progress to show failure
							progress.report({ message: "Indexing failed", increment: 100 })

							// Log full error details
							outputChannel.appendLine(
								`Error initializing semantic search: ${initError instanceof Error ? initError.message : String(initError)}`,
							)

							// Log stack trace if it's an Error object
							if (initError instanceof Error) {
								outputChannel.appendLine(`Error stack: ${initError.stack}`)
							}

							// Additional context logging
							outputChannel.appendLine(
								`Workspace folders: ${workspaceFolders.map((f) => f.uri.path).join(", ")}`,
							)
							outputChannel.appendLine(`Current workspace: ${workspaceUri.path}`)

							// Try to get more system information
							try {
								const workspaceConfiguration = vscode.workspace.getConfiguration()
								outputChannel.appendLine(`Workspace trust: ${vscode.workspace.isTrusted}`)
								outputChannel.appendLine(`Workspace folders count: ${workspaceFolders.length}`)
							} catch (contextError) {
								outputChannel.appendLine(`Error gathering additional context: ${contextError}`)
							}

							// If initialization fails, show a warning but don't block extension activation
							const selection = await vscode.window.showWarningMessage(
								"Semantic search initialization encountered an issue. Some features may be limited.",
								"Retry",
								"Ignore",
							)

							if (selection === "Retry") {
								try {
									outputChannel.appendLine("Attempting retry of semantic search initialization...")
									progress.report({ message: "Retrying indexing...", increment: 10 })

									await semanticSearchService.initialize()

									progress.report({ message: "Retry successful", increment: 100 })
									outputChannel.appendLine(
										"Semantic search service initialized successfully on retry",
									)

									// Give time for the success message to be visible
									await new Promise((resolve) => setTimeout(resolve, 1500))
								} catch (retryError) {
									progress.report({ message: "Retry failed", increment: 100 })
									outputChannel.appendLine(
										`Retry failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
									)

									// Log retry error details
									if (retryError instanceof Error) {
										outputChannel.appendLine(`Retry error stack: ${retryError.stack}`)
									}

									vscode.window.showWarningMessage(
										"Could not initialize semantic search after retry.",
									)
								}
							}

							// Throw the original error to ensure proper error handling
							throw initError
						}
					},
				)
			} else {
				outputChannel.appendLine("No workspace folders found for semantic search initialization")
			}
		} catch (outerError) {
			outputChannel.appendLine(
				`Unexpected error during semantic search initialization: ${outerError instanceof Error ? outerError.message : String(outerError)}`,
			)

			// Log stack trace for outer error
			if (outerError instanceof Error) {
				outputChannel.appendLine(`Outer error stack: ${outerError.stack}`)
			}

			vscode.window.showWarningMessage("Unexpected error initializing semantic search.")
		}
	}

	// Run initialization in the background
	initializeSemanticSearch()

	// Get default commands from configuration
	const defaultCommands = vscode.workspace.getConfiguration("roo-cline").get<string[]>("allowedCommands") || []

	// Initialize global state if not already set
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}

	const sidebarProvider = new ClineProvider(context, outputChannel)

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
		outputChannel.appendLine("Opening Cline in new tab")
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

		const panel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "Cline", targetCol, {
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

	return createClineAPI(outputChannel, sidebarProvider)
}

// This method is called when your extension is deactivated
export function deactivate() {
	outputChannel.appendLine("Roo-Cline extension deactivated")
}
