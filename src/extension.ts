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

/**
 * Installs the CLI tool on the user's device
 * This function performs the same operations as the post-install.js script
 * but is called directly from the extension's activate function
 */
async function installCLI(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): Promise<void> {
	try {
		outputChannel.appendLine("Installing roocli tool...")

		// Determine the OS
		const platform = process.platform
		const isWindows = platform === "win32"
		const isMac = platform === "darwin"
		const isLinux = platform === "linux"

		// Paths
		const EXTENSION_DIR = context.extensionPath
		const CLI_DIR = path.join(EXTENSION_DIR, "dist", "cli")
		const HOME_DIR = os.homedir()

		// Create installation directories based on OS
		let binDir: string
		let configDir: string

		if (isWindows) {
			// Windows installation
			outputChannel.appendLine("Detected Windows OS")

			// Create directories if they don't exist
			binDir = path.join(HOME_DIR, "AppData", "Local", "RooCode", "bin")
			configDir = path.join(HOME_DIR, "AppData", "Local", "RooCode", "config")

			if (!fs.existsSync(binDir)) {
				fs.mkdirSync(binDir, { recursive: true })
			}

			if (!fs.existsSync(configDir)) {
				fs.mkdirSync(configDir, { recursive: true })
			}

			// Copy CLI files to bin directory
			fs.cpSync(CLI_DIR, binDir, { recursive: true })

			// Create batch file for CLI
			const batchFilePath = path.join(binDir, "roo.cmd")
			const batchFileContent = `@echo off\r\nnode "%~dp0\\index.js" %*`
			fs.writeFileSync(batchFilePath, batchFileContent)

			// Add to PATH if not already there
			try {
				// Get current user PATH
				const userPath = execSync("echo %PATH%").toString().trim()

				if (!userPath.includes(binDir)) {
					outputChannel.appendLine("Adding CLI to PATH...")
					// Use setx to modify user PATH
					execSync(`setx PATH "%PATH%;${binDir}"`, { stdio: "inherit" })
					outputChannel.appendLine(
						"Added CLI to PATH. You may need to restart your terminal for changes to take effect.",
					)
				}
			} catch (error) {
				outputChannel.appendLine(
					`Could not automatically add CLI to PATH. You may need to add it manually: ${binDir}`,
				)
			}
		} else if (isMac || isLinux) {
			// macOS/Linux installation
			outputChannel.appendLine(`Detected ${isMac ? "macOS" : "Linux"} OS`)

			// Create directories if they don't exist
			binDir = path.join(HOME_DIR, ".roocode", "bin")
			configDir = path.join(HOME_DIR, ".roocode", "config")

			if (!fs.existsSync(binDir)) {
				fs.mkdirSync(binDir, { recursive: true })
			}

			if (!fs.existsSync(configDir)) {
				fs.mkdirSync(configDir, { recursive: true })
			}

			// Copy CLI files to bin directory
			fs.cpSync(CLI_DIR, binDir, { recursive: true })

			// Create symlink in /usr/local/bin if possible
			const symlinkPath = "/usr/local/bin/roo"
			const cliPath = path.join(binDir, "index.js")

			// Make CLI executable
			fs.chmodSync(cliPath, "755")

			// Create executable script
			const scriptPath = path.join(binDir, "roo")
			const scriptContent = `#!/bin/bash\nnode "${cliPath}" "$@"`
			fs.writeFileSync(scriptPath, scriptContent)
			fs.chmodSync(scriptPath, "755")

			try {
				// Try to create symlink in /usr/local/bin (may require sudo)
				if (fs.existsSync(symlinkPath)) {
					fs.unlinkSync(symlinkPath)
				}

				try {
					fs.symlinkSync(scriptPath, symlinkPath)
					outputChannel.appendLine("Created symlink in /usr/local/bin")
				} catch (error) {
					// If symlink creation fails, suggest manual installation
					outputChannel.appendLine(
						"Could not create symlink in /usr/local/bin (may require admin privileges)",
					)
					outputChannel.appendLine(`To manually install, run: sudo ln -s ${scriptPath} ${symlinkPath}`)

					// Alternative: add to user's .bashrc or .zshrc
					const shellConfigFile = path.join(HOME_DIR, isMac ? ".zshrc" : ".bashrc")

					if (fs.existsSync(shellConfigFile)) {
						outputChannel.appendLine(`Adding CLI path to ${shellConfigFile}...`)
						const pathAddition = `\n# RooCode CLI\nexport PATH="$PATH:${binDir}"\n`
						fs.appendFileSync(shellConfigFile, pathAddition)
						outputChannel.appendLine(
							`Added CLI to ${shellConfigFile}. Please restart your terminal or run 'source ${shellConfigFile}'`,
						)
					}
				}
			} catch (error) {
				outputChannel.appendLine(
					`Could not set up CLI in PATH: ${error instanceof Error ? error.message : String(error)}`,
				)
				outputChannel.appendLine(
					`To manually install, add ${binDir} to your PATH or create a symlink to ${scriptPath}`,
				)
			}
		} else {
			outputChannel.appendLine(`Unsupported operating system: ${platform}`)
			outputChannel.appendLine(`Please manually install the CLI tool from: ${CLI_DIR}`)
		}

		outputChannel.appendLine("roocli installation completed.")
		outputChannel.appendLine('You can now use the "roo" command in your terminal.')

		// Store installation status in extension context
		context.globalState.update("cliInstalled", true)

		// Show success message to the user
		vscode.window.showInformationMessage(
			'RooCode CLI installed successfully. You can now use the "roo" command in your terminal.',
		)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		outputChannel.appendLine(`Error installing roocli: ${errorMessage}`)

		// Log more detailed error information
		if (error instanceof Error && error.stack) {
			outputChannel.appendLine(`Stack trace: ${error.stack}`)
		}

		// Store installation status in extension context
		context.globalState.update("cliInstalled", false)

		// Show error message to the user
		vscode.window.showErrorMessage(`Failed to install RooCode CLI: ${errorMessage}`)
	}
}

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

	// Check if CLI is already installed
	const cliInstalled = context.globalState.get("cliInstalled", false)

	// Package and install CLI if not already installed
	if (!cliInstalled) {
		try {
			// First, check if the CLI is already packaged (might be in a production build)
			const cliDistDir = path.join(context.extensionPath, "dist", "cli")
			let cliIsPackaged = fs.existsSync(cliDistDir) && fs.existsSync(path.join(cliDistDir, "index.js"))

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
				await installCLI(context, outputChannel)
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
