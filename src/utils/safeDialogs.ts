import * as vscode from "vscode"

/**
 * Wraps vscode.window.showSaveDialog in a non-blocking way to prevent UI freezing
 * This addresses the issue where the save dialog can cause the entire VSCode UI to freeze
 * on certain systems (particularly macOS with specific configurations).
 *
 * @param options - The save dialog options
 * @returns Promise that resolves to the selected URI or undefined if cancelled
 */
export async function showSaveDialogSafe(options: vscode.SaveDialogOptions): Promise<vscode.Uri | undefined> {
	// Use setImmediate to defer the dialog call to the next iteration of the event loop
	// This prevents the UI thread from being blocked
	return new Promise<vscode.Uri | undefined>((resolve) => {
		setImmediate(async () => {
			try {
				const result = await vscode.window.showSaveDialog(options)
				resolve(result)
			} catch (error) {
				console.error("Error showing save dialog:", error)
				resolve(undefined)
			}
		})
	})
}

/**
 * Wraps vscode.window.showOpenDialog in a non-blocking way to prevent UI freezing
 *
 * @param options - The open dialog options
 * @returns Promise that resolves to the selected URIs or undefined if cancelled
 */
export async function showOpenDialogSafe(options: vscode.OpenDialogOptions): Promise<vscode.Uri[] | undefined> {
	// Use setImmediate to defer the dialog call to the next iteration of the event loop
	return new Promise<vscode.Uri[] | undefined>((resolve) => {
		setImmediate(async () => {
			try {
				const result = await vscode.window.showOpenDialog(options)
				resolve(result)
			} catch (error) {
				console.error("Error showing open dialog:", error)
				resolve(undefined)
			}
		})
	})
}
