import * as vscode from "vscode"

/**
 * Detects if running in Firebase Studio IDE (formerly IDX Google) environment
 */
function isFirebaseStudioIDE(): boolean {
	const appName = vscode.env.appName?.toLowerCase() || ""
	const remoteName = vscode.env.remoteName?.toLowerCase() || ""

	return (
		appName.includes("idx") ||
		appName.includes("firebase") ||
		appName.includes("studio") ||
		remoteName.includes("idx") ||
		remoteName.includes("firebase") ||
		process.env.IDX_WORKSPACE_ID !== undefined ||
		process.env.FIREBASE_PROJECT_ID !== undefined
	)
}

/**
 * Get the User-Agent string for API requests
 * @param context Optional extension context for more accurate version detection
 * @returns User-Agent string in format "Roo-Code {version} ({environment})"
 */
export function getUserAgent(context?: vscode.ExtensionContext): string {
	const version = context?.extension?.packageJSON?.version || "unknown"
	const baseUserAgent = `Roo-Code ${version}`

	// Add environment information for better debugging
	const environment = []

	if (isFirebaseStudioIDE()) {
		environment.push("Firebase-Studio-IDE")
	}

	if (vscode.env.remoteName) {
		environment.push(`Remote-${vscode.env.remoteName}`)
	}

	if (environment.length > 0) {
		return `${baseUserAgent} (${environment.join("; ")})`
	}

	return baseUserAgent
}
