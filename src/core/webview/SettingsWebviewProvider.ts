import * as vscode from "vscode"
import { getNonce } from "./getNonce"
import { getUri } from "./getUri"
import { ContextProxy } from "../config/ContextProxy"
import { delay } from "../../utils/delay"
import { getTheme } from "../../utils/theme"

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
	}

	public async openPanel() {
		// If we already have a panel, show it
		if (this.panel) {
			this.panel.reveal(vscode.ViewColumn.One)
			return
		}

		if (!this.contextProxy.isInitialized) {
			await this.contextProxy.initialize()
		}

		// Create a new panel
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

		// Set the webview's initial html content
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
		await delay(100)
	}

	private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
		// In development mode, use the local dev server
		if (this.contextProxy.extensionMode === vscode.ExtensionMode.Development) {
			return await this.getDevHtmlContent(webview)
		}

		// In production mode, use the bundled files
		return this.getProdHtmlContent(webview)
	}

	private async getDevHtmlContent(webview: vscode.Webview): Promise<string> {
		// Local dev server port
		const localPort = 3000
		const localServerUrl = `localhost:${localPort}`

		// Check if local dev server is running
		try {
			const response = await fetch(`http://${localServerUrl}`)
			if (!response.ok) {
				throw new Error(`Dev server returned ${response.status}`)
			}
		} catch (error) {
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

		const stylesUri = getUri(webview, this.context.extensionUri, [
			"settings-webview",
			"dist",
			"assets",
			"index.css",
		])

		// CSP directives
		const csp = [
			`default-src 'none'`,
			`img-src ${webview.cspSource} data:`,
			`style-src ${webview.cspSource} 'unsafe-inline'`,
			`script-src 'nonce-${nonce}'`,
			`connect-src ${webview.cspSource}`,
			`font-src ${webview.cspSource}`,
		]

		return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="${csp.join("; ")}" />
          <link rel="stylesheet" type="text/css" href="${stylesUri}" />
          <title>Roo Code Settings</title>
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
          </script>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `
	}

	private setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			async (message) => {
				switch (message.type) {
					case "webviewDidLaunch":
						// Initialize the webview
						await this.postMessageToWebview({ type: "init" })
						break
					default:
						console.log(`Unhandled message: ${message.type}`)
				}
			},
			null,
			this.disposables,
		)
	}

	private async postMessageToWebview(message: any) {
		if (this.panel) {
			await this.panel.webview.postMessage(message)
		}
	}

	private disposePanel() {
		// Clean up resources
		while (this.disposables.length) {
			const disposable = this.disposables.pop()
			if (disposable) {
				disposable.dispose()
			}
		}
	}
}
