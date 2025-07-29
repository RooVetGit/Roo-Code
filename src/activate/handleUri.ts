import * as vscode from "vscode"

import { CloudService } from "@roo-code/cloud"

import { ClineProvider } from "../core/webview/ClineProvider"

/**
 * Detects if running in Firebase Studio IDE (formerly IDX Google) environment
 */
function isFirebaseStudioIDE(): boolean {
	// Check for Firebase Studio IDE specific environment indicators
	const appName = vscode.env.appName?.toLowerCase() || ""
	const remoteName = vscode.env.remoteName?.toLowerCase() || ""

	// Firebase Studio IDE typically has these characteristics
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

export const handleUri = async (uri: vscode.Uri) => {
	const path = uri.path
	const query = new URLSearchParams(uri.query.replace(/\+/g, "%2B"))
	const visibleProvider = ClineProvider.getVisibleInstance()

	// Enhanced logging for debugging authentication issues in cloud IDEs
	const isCloudIDE = isFirebaseStudioIDE()
	console.log(`[handleUri] Processing URI: ${uri.toString()}`)
	console.log(`[handleUri] Path: ${path}`)
	console.log(`[handleUri] Query params: ${query.toString()}`)
	console.log(`[handleUri] Firebase Studio IDE detected: ${isCloudIDE}`)
	console.log(`[handleUri] App name: ${vscode.env.appName}`)
	console.log(`[handleUri] Remote name: ${vscode.env.remoteName}`)
	console.log(`[handleUri] URI scheme: ${vscode.env.uriScheme}`)

	if (!visibleProvider) {
		console.warn(`[handleUri] No visible provider found for URI: ${uri.toString()}`)
		return
	}

	switch (path) {
		case "/glama": {
			const code = query.get("code")
			if (code) {
				console.log(`[handleUri] Processing Glama callback with code: ${code.substring(0, 10)}...`)
				await visibleProvider.handleGlamaCallback(code)
			}
			break
		}
		case "/openrouter": {
			const code = query.get("code")
			if (code) {
				console.log(`[handleUri] Processing OpenRouter callback with code: ${code.substring(0, 10)}...`)
				await visibleProvider.handleOpenRouterCallback(code)
			}
			break
		}
		case "/requesty": {
			const code = query.get("code")
			if (code) {
				console.log(`[handleUri] Processing Requesty callback with code: ${code.substring(0, 10)}...`)
				await visibleProvider.handleRequestyCallback(code)
			}
			break
		}
		case "/auth/clerk/callback": {
			const code = query.get("code")
			const state = query.get("state")
			const organizationId = query.get("organizationId")

			console.log(`[handleUri] Processing Clerk auth callback`)
			console.log(`[handleUri] Code present: ${!!code}`)
			console.log(`[handleUri] State present: ${!!state}`)
			console.log(`[handleUri] Organization ID: ${organizationId}`)

			if (isCloudIDE) {
				console.log(`[handleUri] Firebase Studio IDE environment detected - using enhanced callback handling`)

				// Show user feedback for cloud IDE environments
				if (code && state) {
					vscode.window.showInformationMessage(
						"Authentication callback received in Firebase Studio IDE. Processing login...",
					)
				}
			}

			try {
				await CloudService.instance.handleAuthCallback(
					code,
					state,
					organizationId === "null" ? null : organizationId,
				)

				if (isCloudIDE) {
					console.log(`[handleUri] Successfully processed auth callback in Firebase Studio IDE`)
				}
			} catch (error) {
				console.error(`[handleUri] Error processing auth callback:`, error)

				if (isCloudIDE) {
					vscode.window.showErrorMessage(
						`Authentication failed in Firebase Studio IDE: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
				throw error
			}
			break
		}
		default:
			console.log(`[handleUri] Unhandled URI path: ${path}`)
			break
	}
}
