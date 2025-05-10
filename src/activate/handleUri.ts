import * as vscode from "vscode"

import { ClineProvider } from "../core/webview/ClineProvider"

export const handleUri = async (uri: vscode.Uri) => {
	const path = uri.path
	const query = new URLSearchParams(uri.query.replace(/\+/g, "%2B"))
	const activeProvider = ClineProvider.getActiveProvider()
	if (!activeProvider) {
		return
	}

	switch (path) {
		case "/glama": {
			const code = query.get("code")
			if (code) {
				await activeProvider.handleGlamaCallback(code)
			}
			break
		}
		case "/openrouter": {
			const code = query.get("code")
			if (code) {
				await activeProvider.handleOpenRouterCallback(code)
			}
			break
		}
		case "/requesty": {
			const code = query.get("code")
			if (code) {
				await activeProvider.handleRequestyCallback(code)
			}
			break
		}
		default:
			break
	}
}
