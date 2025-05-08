import * as vscode from "vscode"
import * as dotenvx from "@dotenvx/dotenvx"
import * as path from "path"

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
import { ContextProxy } from "./core/config/ContextProxy"
import { ClineProvider } from "./core/webview/ClineProvider"
import { CodeActionProvider } from "./core/CodeActionProvider"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { McpServerManager } from "./services/mcp/McpServerManager"
import { telemetryService } from "./services/telemetry/TelemetryService"
import { TerminalRegistry } from "./integrations/terminal/TerminalRegistry"
import { API } from "./exports/api"
import { migrateSettings } from "./utils/migrateSettings"

import { handleUri, registerCommands, registerCodeActions, registerTerminalActions } from "./activate"
import { formatLanguage } from "./shared/language"

// Define the scheme for API request virtual documents
export const API_REQUEST_VIEW_URI_SCHEME = "roo-api-request"
export const TOOL_OUTPUT_VIEW_URI_SCHEME = "roo-fragment"

// Define the scheme for generic tool output virtual documents
interface ToolOutputData {
	content: string
	language: string
}

// Simple in-memory storage for tool output content and language
// Simple in-memory storage for API request content
const apiRequestContentStore = new Map<string, string>()
const toolOutputContentStore = new Map<string, ToolOutputData>()

class ApiRequestContentProvider implements vscode.TextDocumentContentProvider {
	// Optional: Add an event emitter if you need to signal updates
	// private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	// readonly onDidChange = this._onDidChange.event;

	provideTextDocumentContent(uri: vscode.Uri): string {
		const contentId = uri.path // Assuming ID is stored in the query part
		return (
			apiRequestContentStore.get(contentId) || `// Error: Could not find API request details for ID: ${contentId}`
		)
	}

	// Helper to add content and return the URI
	static addContent(content: string): vscode.Uri {
		const id = Date.now().toString() // Simple unique ID
		const path = `api-request-${id}.md`
		apiRequestContentStore.set(path, content)
		// Optional: Clean up old entries after a while
		setTimeout(() => apiRequestContentStore.delete(id), 60 * 1000 * 5) // Clear after 5 minutes
		return vscode.Uri.parse(`${API_REQUEST_VIEW_URI_SCHEME}:${path}`)
	}
}

// Content provider for generic tool outputs
class ToolOutputContentProvider implements vscode.TextDocumentContentProvider {
	provideTextDocumentContent(uri: vscode.Uri): string {
		const contentId = uri.path
		return (
			toolOutputContentStore.get(contentId)?.content ||
			`// Error: Could not find tool output for ID: ${contentId}`
		)
	}

	// Helper to add content and return the URI
	static addContent(content: string, language: string): vscode.Uri {
		const id = Date.now().toString()
		// Include language in the path for potential hints, though we don't use it in provideTextDocumentContent directly
		const path = `fragment-${id}.${language || "txt"}`

		toolOutputContentStore.set(path, { content, language })
		// Optional: Clean up old entries after a while
		setTimeout(() => toolOutputContentStore.delete(path), 60 * 1000 * 5) // Clear after 5 minutes

		return vscode.Uri.parse(`${TOOL_OUTPUT_VIEW_URI_SCHEME}:${path}`)
		// Use a fixed path instead of dynamic one based on language
		// const fixedPath = "output.txt" // Example fixed path
		// return vscode.Uri.parse(`${TOOL_OUTPUT_VIEW_URI_SCHEME}:${fixedPath}?${id}`)
	}
}

// Export the static method for use in the message handler
export { ApiRequestContentProvider, ToolOutputContentProvider }

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
// Your extension is activated the very first time the command is executed.
export async function activate(context: vscode.ExtensionContext) {
	extensionContext = context
	outputChannel = vscode.window.createOutputChannel("Roo-Code")
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine("Roo-Code extension activated")

	// Migrate old settings to new
	await migrateSettings(context, outputChannel)

	// Initialize telemetry service after environment variables are loaded.
	telemetryService.initialize()

	// Initialize i18n for internationalization support
	initializeI18n(context.globalState.get("language") ?? formatLanguage(vscode.env.language))

	// Initialize terminal shell execution handlers.
	TerminalRegistry.initialize()

	// Get default commands from configuration.
	const defaultCommands = vscode.workspace.getConfiguration("roo-cline").get<string[]>("allowedCommands") || []

	// Initialize global state if not already set.
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}

	const contextProxy = await ContextProxy.getInstance(context)
	const provider = new ClineProvider(context, outputChannel, "sidebar", contextProxy)
	telemetryService.setProvider(provider)

	// Register the webview view provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	) // Add missing closing parenthesis

	// Register commands (should be outside the push call)
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
	// Content provider for diff view
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			// Content is expected to be base64 encoded in the query parameter
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
	)

	// Register the content provider for generic tool outputs
	const toolOutputProvider = new ToolOutputContentProvider()
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(TOOL_OUTPUT_VIEW_URI_SCHEME, toolOutputProvider),
	)

	// Register the content provider for API request details
	const apiRequestProvider = new ApiRequestContentProvider()
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(API_REQUEST_VIEW_URI_SCHEME, apiRequestProvider),
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

	// Allows other extensions to activate once Roo is ready.
	vscode.commands.executeCommand("roo-cline.activationCompleted")

	// Implements the `RooCodeAPI` interface.
	const socketPath = process.env.ROO_CODE_IPC_SOCKET_PATH
	const enableLogging = typeof socketPath === "string"
	return new API(outputChannel, provider, socketPath, enableLogging)
}

// This method is called when your extension is deactivated
export async function deactivate() {
	outputChannel.appendLine("Roo-Code extension deactivated")
	// Clean up MCP server manager
	await McpServerManager.cleanup(extensionContext)
	telemetryService.shutdown()

	// Clean up terminal handlers
	TerminalRegistry.cleanup()
}
