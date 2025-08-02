import * as vscode from "vscode"

import { CloudService } from "@roo-code/cloud"

import { ClineProvider } from "../core/webview/ClineProvider"

export const handleUri = async (uri: vscode.Uri) => {
	const path = uri.path
	const query = new URLSearchParams(uri.query.replace(/\+/g, "%2B"))
	const visibleProvider = ClineProvider.getVisibleInstance()

	if (!visibleProvider) {
		return
	}

	switch (path) {
		case "/glama": {
			const code = query.get("code")
			if (code) {
				await visibleProvider.handleGlamaCallback(code)
			}
			break
		}
		case "/openrouter": {
			const code = query.get("code")
			if (code) {
				await visibleProvider.handleOpenRouterCallback(code)
			}
			break
		}
		case "/requesty": {
			const code = query.get("code")
			if (code) {
				await visibleProvider.handleRequestyCallback(code)
			}
			break
		}
		case "/litellm": {
			const accessToken = query.get("access_token")
			const tokenType = query.get("token_type")
			const expiresIn = query.get("expires_in")
			const scope = query.get("scope")
			const error = query.get("error")
			const errorDescription = query.get("error_description")

			if (error) {
				// Handle OAuth error
				console.error(`LiteLLM OAuth error: ${error}`, errorDescription)
				vscode.window.showErrorMessage(
					`LiteLLM authentication failed: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`,
				)
				return
			}

			if (accessToken) {
				await visibleProvider.handleLiteLLMCallback({
					accessToken,
					tokenType: tokenType || "Bearer",
					expiresIn: expiresIn ? parseInt(expiresIn, 10) : 86400,
					scope: scope || undefined,
				})
			} else {
				vscode.window.showErrorMessage("LiteLLM authentication failed: No access token received")
			}
			break
		}
		case "/auth/clerk/callback": {
			const code = query.get("code")
			const state = query.get("state")
			const organizationId = query.get("organizationId")

			await CloudService.instance.handleAuthCallback(
				code,
				state,
				organizationId === "null" ? null : organizationId,
			)
			break
		}
		default:
			break
	}
}
