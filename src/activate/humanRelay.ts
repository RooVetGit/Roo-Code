import * as vscode from "vscode"
import { getPanel } from "./registerCommands"

// Callback mapping of human relay response.
const humanRelayCallbacks = new Map<string, (response: string | undefined) => void>()

/**
 * Register a callback function for human relay response.
 * @param requestId
 * @param callback
 */
export const registerHumanRelayCallback = (requestId: string, callback: (response: string | undefined) => void) =>
	humanRelayCallbacks.set(requestId, callback)

export const unregisterHumanRelayCallback = (requestId: string) => humanRelayCallbacks.delete(requestId)

export const handleHumanRelayResponse = (response: { requestId: string; text?: string; cancelled?: boolean }) => {
	const callback = humanRelayCallbacks.get(response.requestId)

	if (callback) {
		if (response.cancelled) {
			callback(undefined)
		} else {
			callback(response.text)
		}

		humanRelayCallbacks.delete(response.requestId)
	}
}

/**
 * Validate if content contains any tags in <xxx> format
 */
export function containsValidTags(content: string): boolean {
	const tagPattern = /<[^>]+>/
	return tagPattern.test(content)
}

export const sendClipboardToHumanRelay = async () => {
	const panel = getPanel()
	if (!panel) {
		return
	}

	try {
		const clipboardText = await vscode.env.clipboard.readText()
		if (!clipboardText) {
			return
		}

		const requestId = "SendAIResponse"

		panel?.webview.postMessage({ type: "closeHumanRelayDialog" })

		vscode.commands.executeCommand("roo-cline.handleHumanRelayResponse", {
			requestId,
			text: clipboardText,
		})
	} catch (error) {
		console.error("Failed to process clipboard content:", error)
	}
}
