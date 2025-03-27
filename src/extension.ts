import * as vscode from "vscode"
import * as dotenvx from "@dotenvx/dotenvx"
import * as path from "path"
import "reflect-metadata"
// Load environment variables from .env file
try {
	// Specify path to .env file in the project root directory
	const envPath = path.join(__dirname, "..", ".env")
	dotenvx.config({ path: envPath })
} catch (e) {
	// Silently handle environment loading errors
	console.warn("Failed to load environment variables:", e)
}

import "./utils/path" // Necessary to have access to String.prototype.toPosix.

import { initializeI18n } from "./i18n"
import { ClineProvider } from "./core/webview/ClineProvider"
import { CodeActionProvider } from "./core/CodeActionProvider"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { McpServerManager } from "./services/mcp/McpServerManager"
import { telemetryService } from "./services/telemetry/TelemetryService"
import { TerminalRegistry } from "./integrations/terminal/TerminalRegistry"
import { API } from "./exports/api"
import { migrateSettings } from "./utils/migrateSettings"
import { OutputChannelManager } from "./core/outputChannelManager"

import { handleUri, registerCommands, registerCodeActions, registerTerminalActions } from "./activate"
import { formatLanguage } from "./shared/language"
import { ContextHolder } from "./core/contextHolder"

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let extensionContext: ContextHolder

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export async function activate(context: vscode.ExtensionContext) {
	// register a singleton, please use this to get context going forward!
	extensionContext = ContextHolder.getInstance(context)
	//register output channel for debugging
	const outputChannelManager = OutputChannelManager.getInstance() //setup
	const outputChannel = outputChannelManager.getOutputChannel()
	// register the output channel with the context
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine("Roo-Code extension activated")

	// Migrate old settings to new
	await migrateSettings(outputChannel)

	// Initialize telemetry service after environment variables are loaded.
	telemetryService.initialize()

	// Initialize i18n for internationalization support
	initializeI18n(extensionContext.getContext().globalState.get("language") ?? formatLanguage(vscode.env.language))

	// Initialize terminal shell execution handlers.
	TerminalRegistry.initialize()

	// Get default commands from configuration.
	const defaultCommands = vscode.workspace.getConfiguration("roo-cline").get<string[]>("allowedCommands") || []

	// Initialize global state if not already set.
	if (!extensionContext.getContext().globalState.get("allowedCommands")) {
		extensionContext.getContext().globalState.update("allowedCommands", defaultCommands)
	}

	const provider = new ClineProvider(outputChannel, "sidebar")
	telemetryService.setProvider(provider)

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)
	// register the commands for the extension
	registerCommands({ context: extensionContext.getContext(), outputChannel, provider })

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
		/**
		 * Given a virtual uri, returns the contents of the text document for that uri.
		 * The uri query is expected to contain the text document contents encoded in base64.
		 * @param uri The virtual uri for which to return the contents.
		 * @returns The text document contents.
		 */
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

	registerCodeActions(extensionContext.getContext()) // TODO: use inject for the context
	registerTerminalActions(extensionContext.getContext()) // TODO: use inject for the context

	// Implements the `RooCodeAPI` interface.
	return new API(outputChannel, provider)
}

// This method is called when your extension is deactivated
export async function deactivate() {
	const outputChannelManager = OutputChannelManager.getInstance()
	const outputChannel = outputChannelManager.getOutputChannel()
	outputChannel.appendLine("Roo-Code extension deactivated")
	// Clean up MCP server manager
	await McpServerManager.cleanup(extensionContext.getContext()) // todo: refactor to call the singleton
	telemetryService.shutdown()

	// Clean up terminal handlers
	TerminalRegistry.cleanup()
}
