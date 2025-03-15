import * as vscode from "vscode"
import * as dotenvx from "@dotenvx/dotenvx"

// Load environment variables from .env file
try {
	// Specify path to .env file in the project root directory
	if (process.env.VSCODE_DEBUG_MODE !== "true") {
		const envPath = __dirname + "/../.env"
		console.log("Loading .env file from path:", envPath)
		dotenvx.config({ path: envPath })
	}
} catch (e) {
	// Silently handle environment loading errors
	console.log("Loaded environment variables:", process.env)
	console.log("Environment variables loaded:", process.env)
	console.warn("Failed to load environment variables:", e)
}

import "./utils/path" // Necessary to have access to String.prototype.toPosix.

import { ClineProvider } from "./core/webview/ClineProvider"
import { CodeActionProvider } from "./core/CodeActionProvider"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { McpServerManager } from "./services/mcp/McpServerManager"
import { telemetryService } from "./services/telemetry/TelemetryService"
import { TerminalRegistry } from "./integrations/terminal/TerminalRegistry"
import { API } from "./exports/api"

import { handleUri, registerCommands, registerCodeActions, registerTerminalActions } from "./activate"

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext

// This method is called when your extension is activated.
console.log("Activating extension...")
// Your extension is activated the very first time the command is executed.
export function activate(context: vscode.ExtensionContext) {
	extensionContext = context
	outputChannel = vscode.window.createOutputChannel("Seawolf")
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine("Seawolf extension activated")

	console.log("Telemetry service initialized.")
	// Initialize telemetry service after environment variables are loaded.
	telemetryService.initialize()

	console.log("Terminal registry initialized.")
	// Initialize terminal shell execution handlers.
	TerminalRegistry.initialize()

	// Get default commands from configuration.
	const defaultCommands = vscode.workspace.getConfiguration("Seawolf").get<string[]>("allowedCommands") || []
	console.log(`[activate] Default commands from configuration: ${defaultCommands}`)

	// Initialize global state if not already set.
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}

	const provider = new ClineProvider(context, outputChannel)
	telemetryService.setProvider(provider)
	console.log(`[activate] Registering webview view provider with ID: ${ClineProvider.sideBarId}`)
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)
	console.log("Commands registered.")
	console.log("Commands registered.")

	registerCommands({ context, outputChannel, provider })

	/**
	 * We use the text document content provider API to show the left side for diff
	 * view by creating a virtual document for the original content. This makes it
	 * readonly so users know to edit the right side if they want to keep their changes.
	 *
	 * This API allows you to create readonly documents in VSCode from arbitrary
	 * sources, and works by claiming an uri-scheme for which your provider then
	 * returns text contents. The scheme must be provided when registering a
	 * provider and cannot change afterwards.
	 *
	 * Note how the provider doesn't create uris for virtual documents - its role
	 * is to provide contents given such an uri. In return, content providers are
	 * wired into the open document logic so that providers are always considered.
	 *
	 * https://code.visualstudio.com/api/extension-guides/virtual-documents
	 */
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
	)

	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	// Register code actions provider.
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, new CodeActionProvider(), {
			providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
		}),
	)

	registerCodeActions(context)
	registerTerminalActions(context)

	console.log("Extension activated successfully.")
	// Implements the `RooCodeAPI` interface.
	return new API(outputChannel, provider)
}

// This method is called when your extension is deactivated
export async function deactivate() {
	outputChannel.appendLine("Seawolf extension deactivated")
	// Clean up MCP server manager
	await McpServerManager.cleanup(extensionContext)
	telemetryService.shutdown()

	// Clean up terminal handlers
	TerminalRegistry.cleanup()
}
