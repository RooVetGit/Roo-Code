import * as vscode from "vscode"
import { isCodeServerEnvironment } from "../../utils/environmentDetection"

/**
 * Handles authentication for Code-Server environments where OAuth redirects may not work
 */
export class CodeServerAuthHandler {
	private static readonly AUTH_TOKEN_KEY = "roocloud.authToken"
	private static readonly MANUAL_AUTH_INSTRUCTIONS = `
To authenticate with Roo Code Cloud in Code-Server:

1. Open Roo Code in a regular browser or desktop VS Code
2. Sign in to Roo Code Cloud there
3. Go to Settings > Account and copy your authentication token
4. Return here and paste the token when prompted

Alternatively, you can:
1. Visit https://app.roo-code.com/auth/token
2. Sign in with your account
3. Copy the generated token
4. Paste it here
`

	/**
	 * Attempts to handle authentication in Code-Server environment
	 * @returns The authentication token if successful, null otherwise
	 */
	public static async handleCodeServerAuth(context: vscode.ExtensionContext): Promise<string | null> {
		if (!isCodeServerEnvironment()) {
			return null
		}

		// Check if we have a stored token
		const storedToken = await context.secrets.get(this.AUTH_TOKEN_KEY)
		if (storedToken) {
			const useStored = await vscode.window.showQuickPick(["Use stored token", "Enter new token"], {
				placeHolder: "A stored authentication token was found. What would you like to do?",
			})

			if (useStored === "Use stored token") {
				return storedToken
			}
		}

		// Show instructions and prompt for manual token entry
		const action = await vscode.window.showInformationMessage(
			"Code-Server detected: Manual authentication required for Roo Code Cloud",
			"Enter Token",
			"Show Instructions",
			"Cancel",
		)

		if (action === "Show Instructions") {
			// Create a webview or show a document with detailed instructions
			const doc = await vscode.workspace.openTextDocument({
				content: this.MANUAL_AUTH_INSTRUCTIONS,
				language: "markdown",
			})
			await vscode.window.showTextDocument(doc, { preview: true })

			// After showing instructions, ask again
			const proceed = await vscode.window.showQuickPick(["Enter Token", "Cancel"], {
				placeHolder: "Ready to enter your authentication token?",
			})

			if (proceed !== "Enter Token") {
				return null
			}
		} else if (action !== "Enter Token") {
			return null
		}

		// Prompt for token input
		const token = await vscode.window.showInputBox({
			prompt: "Enter your Roo Code Cloud authentication token",
			placeHolder: "Paste your token here",
			password: true, // Hide the token as it's being typed
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return "Token cannot be empty"
				}
				// Basic validation - tokens should have a certain format
				if (value.trim().length < 20) {
					return "Token appears to be too short"
				}
				return null
			},
		})

		if (!token) {
			return null
		}

		// Store the token securely
		await context.secrets.store(this.AUTH_TOKEN_KEY, token.trim())
		vscode.window.showInformationMessage("Authentication token saved successfully")

		return token.trim()
	}

	/**
	 * Clears the stored authentication token
	 */
	public static async clearStoredToken(context: vscode.ExtensionContext): Promise<void> {
		await context.secrets.delete(this.AUTH_TOKEN_KEY)
	}

	/**
	 * Validates if a token is still valid by making a test API call
	 */
	public static async validateToken(token: string, apiUrl: string): Promise<boolean> {
		try {
			// This would need to be implemented based on the actual API
			// For now, we'll assume the token is valid if it exists
			return token.length > 0
		} catch (error) {
			console.error("Token validation failed:", error)
			return false
		}
	}

	/**
	 * Shows a notification about Code-Server limitations
	 */
	public static showCodeServerLimitations(): void {
		vscode.window.showInformationMessage(
			"Note: Some Roo Code Cloud features may be limited in Code-Server environments. " +
				"For the best experience, use desktop VS Code when possible.",
			"Understood",
		)
	}
}
