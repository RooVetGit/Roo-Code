import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"

/**
 * Get the base path for conversation storage
 * If the user has configured a custom path, use the custom path
 * Otherwise use the default VSCode extension global storage path
 */
export async function getStorageBasePath(defaultPath: string): Promise<string> {
	// Get the user-configured custom storage path
	const config = vscode.workspace.getConfiguration("roo-cline")
	const customStoragePath = config.get<string>("customStoragePath", "")

	// If no custom path is set, use the default path
	if (!customStoragePath) {
		return defaultPath
	}

	try {
		// Ensure the custom path exists
		await fs.mkdir(customStoragePath, { recursive: true })

		// Test if the path is writable
		const testFile = path.join(customStoragePath, ".write_test")
		await fs.writeFile(testFile, "test")
		await fs.rm(testFile)

		return customStoragePath
	} catch (error) {
		// If the path cannot be used, report the error and fall back to the default path
		console.error(`Custom storage path cannot be used: ${error instanceof Error ? error.message : String(error)}`)
		vscode.window.showErrorMessage(
			`Custom storage path "${customStoragePath}" cannot be used, will use default path instead`,
		)
		return defaultPath
	}
}

/**
 * Get the storage directory path for a task
 */
export async function getTaskDirectoryPath(globalStoragePath: string, taskId: string): Promise<string> {
	const basePath = await getStorageBasePath(globalStoragePath)
	const taskDir = path.join(basePath, "tasks", taskId)
	await fs.mkdir(taskDir, { recursive: true })
	return taskDir
}

/**
 * Get the settings directory path
 */
export async function getSettingsDirectoryPath(globalStoragePath: string): Promise<string> {
	const basePath = await getStorageBasePath(globalStoragePath)
	const settingsDir = path.join(basePath, "settings")
	await fs.mkdir(settingsDir, { recursive: true })
	return settingsDir
}

/**
 * Get the cache directory path
 */
export async function getCacheDirectoryPath(globalStoragePath: string): Promise<string> {
	const basePath = await getStorageBasePath(globalStoragePath)
	const cacheDir = path.join(basePath, "cache")
	await fs.mkdir(cacheDir, { recursive: true })
	return cacheDir
}

/**
 * Prompt user to set a custom storage path
 * Display an input box allowing users to enter a custom path
 */
export async function promptForCustomStoragePath(): Promise<void> {
	const currentConfig = vscode.workspace.getConfiguration("roo-cline")
	const currentPath = currentConfig.get<string>("customStoragePath", "")

	const result = await vscode.window.showInputBox({
		value: currentPath,
		placeHolder: "D:\\RooCodeStorage",
		prompt: "Enter custom conversation history storage path, leave empty to use default location",
		validateInput: (input) => {
			if (!input) {
				return null // Allow empty value (use default path)
			}

			try {
				// Simple validation of path validity
				path.parse(input)
				return null // Path format is valid
			} catch (e) {
				return "Please enter a valid path"
			}
		},
	})

	// If user canceled the operation, result will be undefined
	if (result !== undefined) {
		await currentConfig.update("customStoragePath", result, vscode.ConfigurationTarget.Global)

		if (result) {
			try {
				// Test if the path is accessible
				await fs.mkdir(result, { recursive: true })
				vscode.window.showInformationMessage(`Custom storage path set: ${result}`)
			} catch (error) {
				vscode.window.showErrorMessage(
					`Cannot access path ${result}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		} else {
			vscode.window.showInformationMessage("Restored default storage path")
		}
	}
}
