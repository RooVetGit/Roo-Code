import { execSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"

/**
 * Uninstalls the CLI tool from the user's device
 * This function removes CLI files, symlinks, and PATH entries created during installation
 */
export async function uninstallCLI(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	try {
		outputChannel.appendLine("Uninstalling roocli tool...")

		// Determine the OS
		const platform = process.platform
		const isWindows = platform === "win32"
		const isMac = platform === "darwin"
		const isLinux = platform === "linux"

		// Paths
		const HOME_DIR = os.homedir()

		// Determine installation directories based on OS
		let binDir: string = ""
		let configDir: string = ""

		if (isWindows) {
			// Windows uninstallation
			outputChannel.appendLine("Detected Windows OS for uninstallation")
			binDir = path.join(HOME_DIR, "AppData", "Local", "RooCode", "bin")
			configDir = path.join(HOME_DIR, "AppData", "Local", "RooCode", "config")

			// Remove batch file
			const batchFilePath = path.join(binDir, "roo.cmd")
			if (fs.existsSync(batchFilePath)) {
				fs.unlinkSync(batchFilePath)
				outputChannel.appendLine(`Removed batch file: ${batchFilePath}`)
			}

			// Try to remove from PATH (this is tricky and might not always work)
			try {
				// Get current user PATH
				const userPath = execSync("echo %PATH%").toString().trim()
				if (userPath.includes(binDir)) {
					outputChannel.appendLine("CLI is in PATH. Recommend manual removal with: ")
					outputChannel.appendLine(`setx PATH "%PATH:${binDir};=%"`)
					vscode.window.showInformationMessage(
						`RooCode CLI has been uninstalled, but you may need to manually remove it from your PATH: ${binDir}`,
					)
				}
			} catch (error) {
				outputChannel.appendLine(
					`Could not check PATH: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		} else if (isMac || isLinux) {
			// macOS/Linux uninstallation
			outputChannel.appendLine(`Detected ${isMac ? "macOS" : "Linux"} OS for uninstallation`)
			binDir = path.join(HOME_DIR, ".roocode", "bin")
			configDir = path.join(HOME_DIR, ".roocode", "config")

			// Remove executable script
			const scriptPath = path.join(binDir, "roo")
			if (fs.existsSync(scriptPath)) {
				fs.unlinkSync(scriptPath)
				outputChannel.appendLine(`Removed script: ${scriptPath}`)
			}

			// Remove symlink in /usr/local/bin if it exists
			const symlinkPath = "/usr/local/bin/roo"
			if (fs.existsSync(symlinkPath)) {
				try {
					fs.unlinkSync(symlinkPath)
					outputChannel.appendLine(`Removed symlink: ${symlinkPath}`)
				} catch (error) {
					outputChannel.appendLine(
						`Could not remove symlink (may require admin privileges): ${error instanceof Error ? error.message : String(error)}`,
					)
					outputChannel.appendLine(`To manually remove, run: sudo rm ${symlinkPath}`)
				}
			}

			// Check for PATH entry in shell config files
			const shellConfigFile = path.join(HOME_DIR, isMac ? ".zshrc" : ".bashrc")
			if (fs.existsSync(shellConfigFile)) {
				try {
					let content = fs.readFileSync(shellConfigFile, "utf8")
					const pathAdditionRegex = new RegExp(
						`\\n# RooCode CLI\\nexport PATH="\\$PATH:${binDir.replace(/\//g, "\\/")}"\\n`,
						"g",
					)

					if (pathAdditionRegex.test(content)) {
						content = content.replace(pathAdditionRegex, "\n")
						fs.writeFileSync(shellConfigFile, content)
						outputChannel.appendLine(`Removed CLI PATH entry from ${shellConfigFile}`)
					}
				} catch (error) {
					outputChannel.appendLine(
						`Could not update shell config file: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
		}

		// Remove CLI files
		if (fs.existsSync(binDir)) {
			try {
				fs.rmSync(binDir, { recursive: true, force: true })
				outputChannel.appendLine(`Removed CLI directory: ${binDir}`)
			} catch (error) {
				outputChannel.appendLine(
					`Could not remove CLI directory: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		// Remove config directory if it exists
		if (fs.existsSync(configDir)) {
			try {
				fs.rmSync(configDir, { recursive: true, force: true })
				outputChannel.appendLine(`Removed config directory: ${configDir}`)
			} catch (error) {
				outputChannel.appendLine(
					`Could not remove config directory: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		outputChannel.appendLine("roocli uninstallation completed.")

		// Update installation status in extension context
		context.globalState.update("cliInstalled", false)

		// Show success message to the user
		vscode.window.showInformationMessage("RooCode CLI uninstalled successfully.")
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		outputChannel.appendLine(`Error uninstalling roocli: ${errorMessage}`)

		// Log more detailed error information
		if (error instanceof Error && error.stack) {
			outputChannel.appendLine(`Stack trace: ${error.stack}`)
		}

		// Show error message to the user
		vscode.window.showErrorMessage(`Failed to uninstall RooCode CLI: ${errorMessage}`)
	}
}
