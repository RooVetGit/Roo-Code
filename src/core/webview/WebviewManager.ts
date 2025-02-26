import * as vscode from "vscode"
import * as path from "path"
import axios from "axios"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { ExtensionMessage } from "../../shared/ExtensionMessage"
import { logger } from "../../utils/logging"

/**
 * Manages webview-related functionality for the Cline extension
 */
export class WebviewManager {
	/**
	 * Creates a new WebviewManager instance
	 * @param context The extension context
	 * @param outputChannel The output channel for logging
	 */
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel,
	) {
		logger.debug("WebviewManager initialized")
	}

	/**
	 * Posts a message to the webview
	 * @param view The webview view or panel
	 * @param message The message to post
	 */
	async postMessageToWebview(
		view: vscode.WebviewView | vscode.WebviewPanel | undefined,
		message: ExtensionMessage,
	): Promise<void> {
		try {
			await view?.webview.postMessage(message)
			logger.debug(`Posted message to webview: ${message.type}`)
		} catch (error) {
			logger.error("Failed to post message to webview:", error)
		}
	}

	/**
	 * Gets the HTML content for the webview in development mode with Hot Module Replacement
	 * @param webview The webview
	 * @returns The HTML content
	 */
	async getHMRHtmlContent(webview: vscode.Webview): Promise<string> {
		const localPort = "5173"
		const localServerUrl = `localhost:${localPort}`

		// Check if local dev server is running.
		try {
			await axios.get(`http://${localServerUrl}`)
		} catch (error) {
			vscode.window.showErrorMessage(
				"Local development server is not running, HMR will not work. Please run 'npm run dev' before launching the extension to enable HMR.",
			)

			return this.getHtmlContent(webview)
		}

		const nonce = getNonce()
		const stylesUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "assets", "index.css"])
		const codiconsUri = getUri(webview, this.context.extensionUri, [
			"node_modules",
			"@vscode",
			"codicons",
			"dist",
			"codicon.css",
		])

		const file = "src/index.tsx"
		const scriptUri = `http://${localServerUrl}/${file}`

		const reactRefresh = /*html*/ `
			<script nonce="${nonce}" type="module">
				import RefreshRuntime from "http://localhost:${localPort}/@react-refresh"
				RefreshRuntime.injectIntoGlobalHook(window)
				window.$RefreshReg$ = () => {}
				window.$RefreshSig$ = () => (type) => type
				window.__vite_plugin_react_preamble_installed__ = true
			</script>
		`

		const csp = [
			"default-src 'none'",
			`font-src ${webview.cspSource}`,
			`style-src ${webview.cspSource} 'unsafe-inline' https://* http://${localServerUrl} http://0.0.0.0:${localPort}`,
			`img-src ${webview.cspSource} data:`,
			`script-src 'unsafe-eval' https://* http://${localServerUrl} http://0.0.0.0:${localPort} 'nonce-${nonce}'`,
			`connect-src https://* ws://${localServerUrl} ws://0.0.0.0:${localPort} http://${localServerUrl} http://0.0.0.0:${localPort}`,
		]

		return /*html*/ `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
					<meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}">
					<link rel="stylesheet" type="text/css" href="${stylesUri}">
					<link href="${codiconsUri}" rel="stylesheet" />
					<title>Roo Code</title>
				</head>
				<body>
					<div id="root"></div>
					${reactRefresh}
					<script type="module" src="${scriptUri}"></script>
				</body>
			</html>
		`
	}

	/**
	 * Gets the HTML content for the webview in production mode
	 * @param webview The webview
	 * @returns The HTML content
	 */
	getHtmlContent(webview: vscode.Webview): string {
		// Get the local path to main script run in the webview,
		// then convert it to a uri we can use in the webview.

		// The CSS file from the React build output
		const stylesUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "assets", "index.css"])
		// The JS file from the React build output
		const scriptUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "assets", "index.js"])

		// The codicon font from the React build output
		const codiconsUri = getUri(webview, this.context.extensionUri, [
			"node_modules",
			"@vscode",
			"codicons",
			"dist",
			"codicon.css",
		])

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce()

		return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
			<link href="${codiconsUri}" rel="stylesheet" />
            <title>Roo Code</title>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
          </body>
        </html>
      `
	}

	/**
	 * Resolves the webview view, setting up the HTML content and event listeners
	 * @param webviewView The webview view or panel
	 * @param messageListener The function to call when a message is received from the webview
	 * @param disposables The array of disposables to add event listeners to
	 * @returns The resolved webview view or panel
	 */
	async resolveWebviewView(
		webviewView: vscode.WebviewView | vscode.WebviewPanel,
		messageListener: (message: any) => void,
		disposables: vscode.Disposable[],
	): Promise<vscode.WebviewView | vscode.WebviewPanel> {
		logger.debug("Resolving webview view")

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		}

		webviewView.webview.html =
			this.context.extensionMode === vscode.ExtensionMode.Development
				? await this.getHMRHtmlContent(webviewView.webview)
				: this.getHtmlContent(webviewView.webview)

		// Sets up an event listener to listen for messages passed from the webview view context
		webviewView.webview.onDidReceiveMessage(messageListener, null, disposables)

		// Listen for when the panel becomes visible
		if ("onDidChangeViewState" in webviewView) {
			// WebviewView and WebviewPanel have all the same properties except for this visibility listener
			// panel
			webviewView.onDidChangeViewState(
				() => {
					if (webviewView.visible) {
						this.postMessageToWebview(webviewView, { type: "action", action: "didBecomeVisible" })
					}
				},
				null,
				disposables,
			)
		} else if ("onDidChangeVisibility" in webviewView) {
			// sidebar
			webviewView.onDidChangeVisibility(
				() => {
					if (webviewView.visible) {
						this.postMessageToWebview(webviewView, { type: "action", action: "didBecomeVisible" })
					}
				},
				null,
				disposables,
			)
		}

		// Listen for when the view is disposed
		webviewView.onDidDispose(
			() => {
				this.outputChannel.appendLine("Webview disposed")
			},
			null,
			disposables,
		)

		// Listen for when color changes
		vscode.workspace.onDidChangeConfiguration(
			async (e) => {
				if (e && e.affectsConfiguration("workbench.colorTheme")) {
					// Theme change will be handled by the caller
					this.outputChannel.appendLine("Color theme changed")
				}
			},
			null,
			disposables,
		)

		logger.debug("Webview view resolved")
		return webviewView
	}
}
