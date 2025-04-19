import * as vscode from "vscode"

/**
 * Gets the user's locale from VS Code environment
 * @returns The user's locale code (e.g., 'en', 'fr')
 */
export function getUserLocale(): string {
	// Get from VS Code API
	const vscodeLocale = vscode.env.language

	// Extract just the language part (e.g., "en-US" -> "en")
	return vscodeLocale.split("-")[0].toLowerCase()
}
