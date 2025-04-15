import { execSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"

/**
 * Installs the CLI tool on the user's device
 * This function performs the same operations as the post-install.js script
 * but is called directly from the extension's activate function
 */
export async function installCLI(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): Promise<void> {
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
