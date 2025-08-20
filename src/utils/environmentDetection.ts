import * as vscode from "vscode"

/**
 * Detects if the extension is running in a Code-Server environment
 * Code-Server is a web-based VS Code that runs on remote servers
 */
export function isCodeServerEnvironment(): boolean {
	// Check for Code-Server specific environment variables
	if (process.env.CODE_SERVER_VERSION) {
		return true
	}

	// Check if running in a browser context
	// We need to check the numeric value since TypeScript may not recognize the enum comparison
	const isWebUI = vscode.env.uiKind !== vscode.UIKind.Desktop
	if (isWebUI) {
		return true
	}

	// Check for Docker/container environment indicators that might suggest Code-Server
	if (process.env.DOCKER_CONTAINER || process.env.KUBERNETES_SERVICE_HOST) {
		// Additional check for web UI to confirm it's Code-Server
		if (isWebUI) {
			return true
		}
	}

	// Check if the app name contains code-server
	const appName = vscode.env.appName.toLowerCase()
	if (appName.includes("code-server") || appName.includes("code server")) {
		return true
	}

	// Check for Coolify-specific environment variables
	if (process.env.COOLIFY_CONTAINER_NAME || process.env.COOLIFY_APP_ID) {
		return true
	}

	return false
}

/**
 * Gets information about the current environment
 */
export function getEnvironmentInfo(): {
	isCodeServer: boolean
	uiKind: string
	appName: string
	isRemote: boolean
} {
	// Map UIKind enum value to string
	const isWebUI = vscode.env.uiKind !== vscode.UIKind.Desktop
	const uiKindString = isWebUI ? "Web" : "Desktop"

	return {
		isCodeServer: isCodeServerEnvironment(),
		uiKind: uiKindString,
		appName: vscode.env.appName,
		isRemote: vscode.env.remoteName !== undefined,
	}
}

/**
 * Determines if OAuth-based authentication should be used
 * In Code-Server environments, OAuth redirects may not work properly
 */
export function shouldUseAlternativeAuth(): boolean {
	return isCodeServerEnvironment()
}
