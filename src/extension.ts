import * as dotenvx from "@dotenvx/dotenvx"
import { execSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"

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

import { installCLI, uninstallCLI } from "./cli-utils"
import { CodeActionProvider } from "./core/CodeActionProvider"
import { ClineProvider } from "./core/webview/ClineProvider"
import { API } from "./exports/api"
import { initializeI18n } from "./i18n"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { TerminalRegistry } from "./integrations/terminal/TerminalRegistry"
import { WebSocketServer } from "./services/extend/websocket-server"
import { McpServerManager } from "./services/mcp/McpServerManager"
import { telemetryService } from "./services/telemetry/TelemetryService"
import { migrateSettings } from "./utils/migrateSettings"
import { getWebSocketConfigPath, writeWebSocketConfig } from "./utils/websocket-config"

import { handleUri, registerCodeActions, registerCommands, registerTerminalActions } from "./activate"
import { formatLanguage } from "./shared/language"

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext
let webSocketServer: WebSocketServer | null = null

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export async function activate(context: vscode.ExtensionContext) {
	extensionContext = context
	outputChannel = vscode.window.createOutputChannel("Roo-Code")
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine("Roo-Code extension activated")
	// Force CLI reinstallation by resetting the flag
	await context.globalState.update("cliInstalled", false)
	outputChannel.appendLine("Forcing CLI reinstallation by resetting cliInstalled flag")

	// Check if CLI is already installed
	const cliInstalled = context.globalState.get("cliInstalled", false)
	outputChannel.appendLine(
		`CLI installation status from global state: ${cliInstalled ? "installed" : "not installed"}`,
	)

	// Check if CLI is actually installed in the expected location
	const platform = process.platform
	const HOME_DIR = os.homedir()
	let cliScriptPath = ""

	if (platform === "win32") {
		cliScriptPath = path.join(HOME_DIR, "AppData", "Local", "RooCode", "bin", "roo.cmd")
	} else if (platform === "darwin" || platform === "linux") {
		cliScriptPath = path.join(HOME_DIR, ".roocode", "bin", "roo")
	}

	const cliActuallyInstalled = fs.existsSync(cliScriptPath)
	outputChannel.appendLine(`Checking if CLI is actually installed at ${cliScriptPath}: ${cliActuallyInstalled}`)

	// Package and install CLI if not already installed or if the CLI script doesn't exist
	if (!cliInstalled || !cliActuallyInstalled) {
		outputChannel.appendLine("CLI needs to be installed or reinstalled")
		try {
			// First, check if the CLI is already packaged (might be in a production build)
			const cliDistDir = path.join(context.extensionPath, "dist", "cli")
			const cliIndexPath = path.join(cliDistDir, "index.js")
			outputChannel.appendLine(`Checking if CLI dist directory exists: ${fs.existsSync(cliDistDir)}`)
			outputChannel.appendLine(`Checking if CLI index.js exists: ${fs.existsSync(cliIndexPath)}`)
			let cliIsPackaged = fs.existsSync(cliDistDir) && fs.existsSync(cliIndexPath)
			outputChannel.appendLine(`CLI is packaged: ${cliIsPackaged}`)

			if (!cliIsPackaged) {
				// Need to package the CLI
				outputChannel.appendLine("Packaging CLI tool...")
				const packageCliPath = path.join(context.extensionPath, "scripts", "package-cli.js")

				if (fs.existsSync(packageCliPath)) {
					// Execute the package-cli.js script
					try {
						execSync(`node "${packageCliPath}"`, {
							cwd: context.extensionPath,
							stdio: "pipe",
						})
						outputChannel.appendLine("CLI tool successfully packaged.")
						cliIsPackaged = true
					} catch (error) {
						outputChannel.appendLine(
							`Error packaging CLI: ${error instanceof Error ? error.message : String(error)}`,
						)

						// Try to build the CLI directly if the script fails
						try {
							outputChannel.appendLine("Attempting to build CLI directly...")

							// Ensure the CLI dist directory exists
							if (!fs.existsSync(cliDistDir)) {
								fs.mkdirSync(cliDistDir, { recursive: true })
							}

							// Build the CLI directly
							const roocliDir = path.join(context.extensionPath, "roocli")
							if (fs.existsSync(roocliDir)) {
								process.chdir(roocliDir)
								execSync("npm run build", { stdio: "pipe" })
								process.chdir(context.extensionPath)

								// Copy the built files
								const cliBuiltDir = path.join(roocliDir, "dist")
								if (fs.existsSync(cliBuiltDir)) {
									fs.cpSync(cliBuiltDir, cliDistDir, { recursive: true })

									// Copy package.json
									fs.copyFileSync(
										path.join(roocliDir, "package.json"),
										path.join(cliDistDir, "package.json"),
									)

									outputChannel.appendLine("CLI tool built and packaged successfully.")
									cliIsPackaged = true
								}
							}
						} catch (buildError) {
							outputChannel.appendLine(
								`Error building CLI directly: ${buildError instanceof Error ? buildError.message : String(buildError)}`,
							)
						}
					}
				} else {
					outputChannel.appendLine(`CLI packaging script not found at: ${packageCliPath}`)
				}
			} else {
				outputChannel.appendLine("CLI is already packaged, skipping packaging step.")
			}

			// Now install the CLI if it was packaged successfully
			if (cliIsPackaged) {
				outputChannel.appendLine("Starting CLI installation process...")
				try {
					await installCLI(context, outputChannel)
					outputChannel.appendLine("CLI installation process completed successfully")
				} catch (installError) {
					outputChannel.appendLine(
						`Error during CLI installation: ${installError instanceof Error ? installError.message : String(installError)}`,
					)
					if (installError instanceof Error && installError.stack) {
						outputChannel.appendLine(`Installation error stack trace: ${installError.stack}`)
					}
				}
			} else {
				outputChannel.appendLine("CLI installation skipped because packaging failed.")
				vscode.window.showErrorMessage("Failed to package RooCode CLI. Some features may not work properly.")
			}
		} catch (error) {
			outputChannel.appendLine(
				`Error during CLI setup: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

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

	const provider = new ClineProvider(context, outputChannel, "sidebar")
	telemetryService.setProvider(provider)

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)

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

	// Allows other extensions to activate once Roo is ready.
	vscode.commands.executeCommand("roo-cline.activationCompleted")

	// Implements the `RooCodeAPI` interface.
	const socketPath = process.env.ROO_CODE_IPC_SOCKET_PATH
	const enableLogging = typeof socketPath === "string"
	const api = new API(outputChannel, provider, socketPath, enableLogging)

	// Initialize and start WebSocket server
	// Get configuration and enable WebSocket by default if not explicitly set
	const config = vscode.workspace.getConfiguration("roo-cline")

	// Check if websocket.enabled setting exists
	const websocketEnabledExists = config.has("websocket.enabled")

	// If setting doesn't exist, enable it by default
	if (!websocketEnabledExists) {
		await config.update("websocket.enabled", true, vscode.ConfigurationTarget.Global)
		outputChannel.appendLine("WebSocket server enabled by default for CLI communication")
	}

	// Get the current setting (will be true if we just set it, or whatever the user has configured)
	const websocketEnabled = config.get<boolean>("websocket.enabled", true)

	if (websocketEnabled) {
		outputChannel.appendLine("Starting WebSocket server for CLI communication...")

		// Use port 0 to let the OS assign a random available port
		const websocketPort = 0
		// Generate a simple token for WebSocket authentication
		const token = Math.random().toString(36).substring(2, 15)
		webSocketServer = new WebSocketServer(api, token, outputChannel, websocketPort)
		webSocketServer.start()

		// Write the port and token to a file in the temp directory
		const actualPort = webSocketServer.getPort()
		if (actualPort !== null) {
			try {
				await writeWebSocketConfig({ port: actualPort, token })
				outputChannel.appendLine(`WebSocket server started on port ${actualPort}`)
				outputChannel.appendLine(`WebSocket configuration written to: ${getWebSocketConfigPath()}`)

				// Show information message to the user
				vscode.window.showInformationMessage(`RooCode CLI communication server started on port ${actualPort}`)
			} catch (error) {
				outputChannel.appendLine(
					`Error writing WebSocket configuration: ${error instanceof Error ? error.message : String(error)}`,
				)
				vscode.window.showErrorMessage(
					"Failed to configure CLI communication. CLI commands may not work properly.",
				)
			}
		}
	} else {
		outputChannel.appendLine("WebSocket server is disabled. CLI commands will not work.")
		vscode.window.showWarningMessage(
			"RooCode CLI communication is disabled. Enable it in settings to use CLI commands.",
		)
	}

	return api
}

// This method is called when your extension is deactivated
export async function deactivate() {
	outputChannel.appendLine("Roo-Code extension deactivated")

	// Uninstall CLI when extension is deactivated
	try {
		outputChannel.appendLine("Starting CLI uninstallation process...")
		await uninstallCLI(extensionContext, outputChannel)
		outputChannel.appendLine("CLI uninstallation process completed successfully")
	} catch (uninstallError) {
		outputChannel.appendLine(
			`Error during CLI uninstallation: ${uninstallError instanceof Error ? uninstallError.message : String(uninstallError)}`,
		)
		if (uninstallError instanceof Error && uninstallError.stack) {
			outputChannel.appendLine(`Uninstallation error stack trace: ${uninstallError.stack}`)
		}
	}

	// Clean up MCP server manager
	await McpServerManager.cleanup(extensionContext)
	telemetryService.shutdown()

	// Clean up terminal handlers
	TerminalRegistry.cleanup()

	// Dispose WebSocket server if it was started
	if (webSocketServer) {
		webSocketServer.dispose()
		webSocketServer = null
	}
}
