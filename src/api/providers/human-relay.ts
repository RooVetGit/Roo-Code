import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandlerOptions, ModelInfo } from "../../shared/api"
import { ApiHandler, SingleCompletionHandler } from "../index"
import { ApiStream } from "../transform/stream"
import * as vscode from "vscode"
import { getPanel } from "../../activate/registerCommands"
import { containsValidTags } from "../../activate/humanRelay"

/**
 * Human Relay API processor
 * This processor does not directly call the API, but interacts with the model through human operations like copy and paste.
 */
export class HumanRelayHandler implements ApiHandler, SingleCompletionHandler {
	private options: ApiHandlerOptions

	constructor(options: ApiHandlerOptions) {
		this.options = options
	}

	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		return Promise.resolve(0)
	}

	/**
	 * Create a message processing flow, display a dialog box to request human assistance
	 */
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const latestMessage = messages[messages.length - 1]

		if (!latestMessage) {
			throw new Error("No message to relay")
		}

		// Concatenate system prompt with user message if this is the first message
		let promptText = ""
		if (messages.length === 1) {
			promptText = `${systemPrompt}\n\n${getMessageContent(latestMessage)}`
		} else {
			promptText = getMessageContent(latestMessage)
		}

		// Copy to clipboard
		await vscode.env.clipboard.writeText(promptText)

		// Display a dialog box to request user action
		const response = await showHumanRelayDialog(promptText, this.options)

		if (!response) {
			throw new Error("Human relay operation cancelled")
		}

		yield { type: "text", text: response }
	}

	/**
	 * Get model information
	 */
	getModel(): { id: string; info: ModelInfo } {
		return {
			id: "human-relay",
			info: {
				maxTokens: 16384,
				contextWindow: 100000,
				supportsImages: true,
				supportsPromptCache: false,
				supportsComputerUse: true,
				inputPrice: 0,
				outputPrice: 0,
				description: "Calling web-side AI model through human relay",
			},
		}
	}

	/**
	 * Implementation of a single prompt completion
	 */
	async completePrompt(prompt: string): Promise<string> {
		await vscode.env.clipboard.writeText(prompt)

		const response = await showHumanRelayDialog(prompt, this.options)

		if (!response) {
			throw new Error("Human relay operation cancelled")
		}

		return response
	}
}

/**
 * Extract text content from a message object
 */
function getMessageContent(message: Anthropic.Messages.MessageParam): string {
	if (typeof message.content === "string") {
		return message.content
	} else if (Array.isArray(message.content)) {
		return message.content
			.filter((item) => item.type === "text")
			.map((item) => (item.type === "text" ? item.text : ""))
			.join("\n")
	}
	return ""
}

// Global variables
let normalizedPrompt: string | null = null
let currentPrompt: string | null = null
let normalizedLastResponse: string | null = null
let globalClipboardInterval: NodeJS.Timeout | null = null

/**
 * Normalize text by removing extra spaces
 */
function normalizeText(text: string | null): string {
	if (!text) return ""
	return text.replace(/\s+/g, " ").trim()
}

/**
 * Compare if two strings are equal (ignoring whitespace differences)
 */
function isTextEqual(str1: string | null, str2: string | null): boolean {
	if (str1 === str2) return true
	if (!str1 || !str2) return false
	return normalizeText(str1) === normalizeText(str2)
}

/**
 * Stop clipboard monitoring
 */
function stopClipboardMonitoring() {
	if (globalClipboardInterval) {
		clearInterval(globalClipboardInterval)
		globalClipboardInterval = null
	}
}

/**
 * Start clipboard monitoring
 */
async function startClipboardMonitoring(requestId: string, options?: ApiHandlerOptions) {
	// Stop any existing monitoring
	stopClipboardMonitoring()
	vscode.env.clipboard.writeText(currentPrompt ?? "")

	// Start new monitoring
	const monitorInterval = Math.min(Math.max(100, options?.humanRelayMonitorInterval ?? 500), 2000)

	globalClipboardInterval = setInterval(async () => {
		try {
			const currentClipboardContent = await vscode.env.clipboard.readText()
			if (!currentClipboardContent) {
				return
			}

			const normalizedClipboard = normalizeText(currentClipboardContent)

			const panel = getPanel()

			// Check if response is duplicate
			if (normalizedClipboard === normalizedLastResponse) {
				panel?.webview.postMessage({
					type: "showHumanRelayResponseAlert",
					requestId: "lastInteraction",
				})
				return
			}
			if (!containsValidTags(currentClipboardContent)) {
				panel?.webview.postMessage({
					type: "showHumanRelayResponseAlert",
					requestId: "invalidResponse",
				})
				return
			}

			// Process valid new response
			if (normalizedClipboard !== normalizedPrompt) {
				normalizedLastResponse = normalizedClipboard

				// Clear timer
				stopClipboardMonitoring()

				// Close dialog and send response
				panel?.webview.postMessage({ type: "closeHumanRelayDialog" })
				vscode.commands.executeCommand("roo-cline.handleHumanRelayResponse", {
					requestId,
					text: currentClipboardContent,
				})
			}
		} catch (error) {
			console.error("Error monitoring clipboard:", error)
		}
	}, monitorInterval)
}

/**
 * Display human relay dialog and wait for user response
 */
async function showHumanRelayDialog(promptText: string, options?: ApiHandlerOptions): Promise<string | undefined> {
	currentPrompt = promptText
	normalizedPrompt = normalizeText(promptText)

	return new Promise<string | undefined>((resolve) => {
		// Create unique request ID
		const requestId = "SendAIResponse"

		// Register global callback function
		vscode.commands.executeCommand(
			"roo-cline.registerHumanRelayCallback",
			requestId,
			(response: string | undefined) => {
				stopClipboardMonitoring()
				resolve(response)
			},
		)

		// Get panel and register message handler
		const panel = getPanel()
		if (panel) {
			panel.webview.onDidReceiveMessage((message) => {
				if (message.type === "toggleHumanRelayMonitor" && message.requestId === requestId) {
					if (message.bool) {
						startClipboardMonitoring(requestId, options)
					} else {
						stopClipboardMonitoring()
					}
				}
			})
		}

		// Open dialog
		vscode.commands.executeCommand("roo-cline.showHumanRelayDialog", {
			requestId,
			promptText,
		})

		// Start polling clipboard changes if enabled
		if (options?.humanRelayMonitorClipboard) {
			startClipboardMonitoring(requestId, options)
		}
	})
}
