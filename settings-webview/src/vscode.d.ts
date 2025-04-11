/**
 * Type definition for the VS Code API
 * Using types from @types/vscode-webview
 */

// Re-export the vscode webview API types
import type { WebviewApi } from "vscode-webview"

// Make the vscode API available globally
declare global {
	const vscode: WebviewApi<unknown>
}
