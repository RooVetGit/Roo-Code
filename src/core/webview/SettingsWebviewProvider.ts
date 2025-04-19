import * as vscode from "vscode"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { ContextProxy } from "../config/ContextProxy"
import delay from "delay"
import { getTheme } from "../../integrations/theme/getTheme"

export class SettingsWebviewProvider {
	public static readonly viewType = "roo-cline.SettingsWebviewProvider"
	private panel: vscode.WebviewPanel | undefined
	private disposables: vscode.Disposable[] = []
	private contextProxy: ContextProxy

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel,
	) {
		this.contextProxy = new ContextProxy(context)
		this.log("SettingsWebviewProvider instantiated")
	}

	private log(message: string) {
		this.outputChannel.appendLine(`[SettingsWebviewProvider] ${message}`)
	}

	public async openPanel() {
		this.log("Opening settings webview panel")
		// If we already have a panel, show it
		if (this.panel) {
			this.log("Panel already exists, revealing it")
			this.panel.reveal(vscode.ViewColumn.One)
			return
		}

		if (!this.contextProxy.isInitialized) {
			this.log("Initializing context proxy")
			await this.contextProxy.initialize()
		}

		// Create a new panel
		this.log("Creating new webview panel")
		this.panel = vscode.window.createWebviewPanel(
			SettingsWebviewProvider.viewType,
			"Roo Code Settings",
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [this.context.extensionUri],
			},
		)
		this.log("Webview panel created")

		// Set the webview's initial html content
		this.log("Setting webview HTML content")
		this.panel.webview.html = await this.getHtmlForWebview(this.panel.webview)

		// Set up event listeners
		this.setWebviewMessageListener(this.panel.webview)

		// Handle panel closing
		this.panel.onDidDispose(
			() => {
				this.panel = undefined
				this.disposePanel()
			},
			null,
			this.disposables,
		)

		// Listen for when color theme changes
		vscode.workspace.onDidChangeConfiguration(
			async (e) => {
				if (e && e.affectsConfiguration("workbench.colorTheme")) {
					// Sends latest theme name to webview
					await this.postMessageToWebview({ type: "theme", text: JSON.stringify(await getTheme()) })
				}
			},
			null,
			this.disposables,
		)

		// Wait briefly for the panel to be ready
		this.log("Waiting for panel to be ready")
		await delay(100)
		this.log("Settings webview panel opened successfully")
	}

	private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
		// In development mode, use the local dev server
		if (this.contextProxy.extensionMode === vscode.ExtensionMode.Development) {
			this.log("Using development HTML content")
			return await this.getDevHtmlContent(webview)
		}

		// In production mode, use the bundled files
		this.log("Using production HTML content")
		return this.getProdHtmlContent(webview)
	}

	private async getDevHtmlContent(webview: vscode.Webview): Promise<string> {
		// Local dev server port
		const localPort = 3000
		const localServerUrl = `localhost:${localPort}`
		this.log(`Checking if dev server is running at ${localServerUrl}`)

		// Check if local dev server is running
		try {
			this.log("Attempting to connect to dev server")
			const response = await fetch(`http://${localServerUrl}`)
			if (!response.ok) {
				throw new Error(`Dev server returned ${response.status}`)
			}
			this.log("Dev server is running")
		} catch (error) {
			this.log(`Dev server not running: ${error.message}`)
			vscode.window.showErrorMessage(`Settings webview dev server not running: ${error.message}`)
			return this.getProdHtmlContent(webview)
		}

		const nonce = getNonce()

		// CSP directives
		const csp = [
			`default-src 'none'`,
			`img-src ${webview.cspSource} http: https: data:`,
			`style-src ${webview.cspSource} 'unsafe-inline' http: https:`,
			`script-src 'nonce-${nonce}' 'unsafe-eval' http: https:`,
			`connect-src http: https: ws: wss: ${webview.cspSource}`,
			`font-src ${webview.cspSource} http: https:`,
		]

		return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}" />
          <title>Roo Code Settings</title>
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            window.addEventListener('message', event => {
              // Forward messages from the extension to the dev server
              window.postMessage(event.data, '*');
            });
          </script>
        </head>
        <body>
          <div id="root"></div>
          <script nonce="${nonce}">
            // Redirect to dev server
            window.location.href = 'http://${localServerUrl}';
          </script>
        </body>
      </html>
    `
	}

	private getProdHtmlContent(webview: vscode.Webview): string {
		const nonce = getNonce()

		// Get URIs for resources
		const scriptUri = getUri(webview, this.context.extensionUri, ["settings-webview", "dist", "assets", "index.js"])
		this.log(`scriptUri: ${scriptUri}`)

		const stylesUri = getUri(webview, this.context.extensionUri, [
			"settings-webview",
			"dist",
			"assets",
			"index.css",
		])
		this.log(`stylesUri: ${stylesUri}`)

		// Get codicons URI
		const codiconsUri = getUri(webview, this.context.extensionUri, [
			"node_modules",
			"@vscode",
			"codicons",
			"dist",
			"codicon.css",
		])
		this.log(`codiconsUri: ${codiconsUri}`)

		// Get images URI
		const imagesUri = getUri(webview, this.context.extensionUri, ["assets", "images"])
		this.log(`imagesUri: ${imagesUri}`)

		return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}'; connect-src ${webview.cspSource};">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
			<link href="${codiconsUri}" rel="stylesheet" />
			<script nonce="${nonce}">
				window.IMAGES_BASE_URI = "${imagesUri}";
				// Make sure vscode is defined for the webview
				window.vscode = acquireVsCodeApi();
			</script>
            <title>Roo Code Settings</title>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
          </body>
        </html>
      `
	}

	private setWebviewMessageListener(webview: vscode.Webview) {
		this.log("Setting up webview message listener")
		webview.onDidReceiveMessage(
			async (message) => {
				this.log(`Received message from webview: ${message.type}`)
				switch (message.type) {
					case "webviewDidLaunch":
						// Initialize the webview
						this.log("Webview launched, initializing")
						await this.postMessageToWebview({ type: "init" })
						break
					default:
						this.log(`Unhandled message: ${message.type}`)
				}
			},
			null,
			this.disposables,
		)
	}

	private async postMessageToWebview(message: any) {
		this.log(`Posting message to webview: ${message.type}`)
		if (this.panel) {
			await this.panel.webview.postMessage(message)
			this.log(`Message posted to webview: ${message.type}`)
		} else {
			this.log(`Failed to post message: panel is undefined`)
		}
	}

	private disposePanel() {
		this.log("Disposing panel resources")
		// Clean up resources
		while (this.disposables.length) {
			const disposable = this.disposables.pop()
			if (disposable) {
				disposable.dispose()
			}
		}
		this.log("Panel resources disposed")
	}
}
