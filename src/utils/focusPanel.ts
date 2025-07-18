import * as vscode from "vscode"
import { Package } from "../shared/package"
import { ClineProvider } from "../core/webview/ClineProvider"

/**
 * Focus the active panel (either tab or sidebar)
 * @param tabPanel - The tab panel reference
 * @param sidebarPanel - The sidebar panel reference
 * @returns Promise that resolves when focus is complete
 */
export async function focusPanel(
	tabPanel: vscode.WebviewPanel | undefined,
	sidebarPanel: vscode.WebviewView | undefined,
): Promise<void> {
	const panel = tabPanel || sidebarPanel

	if (!panel) {
		// Check if we should open the sidebar - avoid opening in multi-window scenarios
		// where the user might be working in a different VS Code window
		const shouldOpenSidebar = await shouldAllowSidebarActivation()

		if (shouldOpenSidebar) {
			// If no panel is open, open the sidebar
			await vscode.commands.executeCommand(`workbench.view.extension.${Package.name}-ActivityBar`)
		}
	} else if (panel === tabPanel && !panel.active) {
		// For tab panels, use reveal to focus
		panel.reveal(vscode.ViewColumn.Active, false)
	} else if (panel === sidebarPanel) {
		// For sidebar panels, focus the sidebar
		await vscode.commands.executeCommand(`${ClineProvider.sideBarId}.focus`)
	}
}

/**
 * Determines if we should allow automatic sidebar activation
 * This helps prevent unwanted sidebar opening in multi-window VS Code setups
 * @returns Promise<boolean> - true if sidebar activation is allowed
 */
async function shouldAllowSidebarActivation(): Promise<boolean> {
	try {
		// Check if there's a visible Roo Code instance already
		const visibleProvider = ClineProvider.getVisibleInstance()
		if (visibleProvider) {
			// If there's already a visible provider, it's safe to open the sidebar
			return true
		}

		// Check if the current window has focus and is the active window
		// This helps prevent opening sidebar when user is working in another window
		const activeEditor = vscode.window.activeTextEditor
		const visibleEditors = vscode.window.visibleTextEditors

		// If there are active editors in this window, it's likely the user's current working window
		if (activeEditor || visibleEditors.length > 0) {
			return true
		}

		// If no editors are visible and no Roo Code instance is visible,
		// be conservative and don't auto-open the sidebar to avoid disrupting
		// the user's workflow in other windows
		return false
	} catch (error) {
		// If there's any error in detection, err on the side of caution
		// and allow sidebar activation to maintain existing functionality
		console.warn("Error in shouldAllowSidebarActivation:", error)
		return true
	}
}
