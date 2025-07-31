import * as vscode from "vscode"

export function getUserAgent(context?: vscode.ExtensionContext): string {
	return `Roo-Code ${context?.extension?.packageJSON?.version || "unknown"}`
}
