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
		case "/website/callback": {
			const username = query.get("username")
			const apiKey = query.get("apiKey")

			if (username && apiKey) {
				await visibleProvider.handleWebsiteAuthCallback(username, apiKey)
			}
			break
		}
		case "/import-session": {
			const id = query.get("id")
			const url = query.get("url")

			if (id) {
				await visibleProvider.importTaskFromCloudById(id)
			} else if (url) {
				await visibleProvider.importTaskFromCloudByUrl(url)
			}
			break
		}
		default:
			break
	}
}
