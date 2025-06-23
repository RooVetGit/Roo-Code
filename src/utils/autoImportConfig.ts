import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"

import { Package } from "../shared/package"
import { fileExistsAtPath } from "./fs"

import { importSettingsFromPath, ImportOptions } from "../core/config/importExport"

/**
 * Automatically imports RooCode configuration from a specified path if it exists.
 * This function is called during extension activation to allow users to pre-configure
 * their settings by placing a config file at a predefined location.
 */
export async function autoImportConfig(
	outputChannel: vscode.OutputChannel,
	{ providerSettingsManager, contextProxy, customModesManager }: ImportOptions,
): Promise<void> {
	try {
		// Get the auto-import config path from VSCode settings
		const configPath = vscode.workspace.getConfiguration(Package.name).get<string>("autoImportConfigPath")

		if (!configPath || configPath.trim() === "") {
			outputChannel.appendLine("[AutoImport] No auto-import config path specified, skipping auto-import")
			return
		}

		// Resolve the path (handle ~ for home directory and relative paths)
		const resolvedPath = resolvePath(configPath.trim())
		outputChannel.appendLine(`[AutoImport] Checking for config file at: ${resolvedPath}`)

		// Check if the file exists
		if (!(await fileExistsAtPath(resolvedPath))) {
			outputChannel.appendLine(`[AutoImport] Config file not found at ${resolvedPath}, skipping auto-import`)
			return
		}

		// Attempt to import the configuration
		const result = await importSettingsFromPath(resolvedPath, {
			providerSettingsManager,
			contextProxy,
			customModesManager,
		})

		if (result.success) {
			outputChannel.appendLine(`[AutoImport] Successfully imported configuration from ${resolvedPath}`)

			// Show a notification to the user
			vscode.window.showInformationMessage(
				`RooCode configuration automatically imported from ${path.basename(resolvedPath)}`,
			)
		} else {
			outputChannel.appendLine(`[AutoImport] Failed to import configuration: ${result.error}`)

			// Show a warning but don't fail the extension activation
			vscode.window.showWarningMessage(`Failed to auto-import RooCode configuration: ${result.error}`)
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		outputChannel.appendLine(`[AutoImport] Unexpected error during auto-import: ${errorMessage}`)

		// Log error but don't fail extension activation
		console.warn("Auto-import config error:", error)
	}
}

/**
 * Resolves a file path, handling home directory expansion and relative paths
 */
function resolvePath(configPath: string): string {
	// Handle home directory expansion
	if (configPath.startsWith("~/")) {
		return path.join(os.homedir(), configPath.slice(2))
	}

	// Handle absolute paths
	if (path.isAbsolute(configPath)) {
		return configPath
	}

	// Handle relative paths (relative to home directory for safety)
	return path.join(os.homedir(), configPath)
}
