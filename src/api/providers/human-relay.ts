import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandlerOptions, ModelInfo } from "../../shared/api"
import { ApiHandler, SingleCompletionHandler } from "../index"
import { ApiStream } from "../transform/stream"
import * as vscode from "vscode"
import { ExtensionMessage } from "../../shared/ExtensionMessage"
import { getPanel } from "../../activate/registerCommands" // Import the getPanel function

/**
 * Human Relay API processor
 * This processor does not directly call the API, but interacts with the model through human operations copy and paste.
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
	 * @param systemPrompt System prompt words
	 * @param messages Message list
	 */
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		// Get the most recent user message
		const latestMessage = messages[messages.length - 1]

		if (!latestMessage) {
			throw new Error("No message to relay")
		}

		// If it is the first message, splice the system prompt word with the user message
		let promptText = ""
		if (messages.length === 1) {
			promptText = `${systemPrompt}\n\n${getMessageContent(latestMessage)}`
		} else {
			promptText = getMessageContent(latestMessage)
		}

		// Copy to clipboard
		await vscode.env.clipboard.writeText(promptText)

		// A dialog box pops up to request user action
		const response = await showHumanRelayDialog(promptText, this.options)

		if (!response) {
			// The user canceled the operation
			throw new Error("Human relay operation cancelled")
		}

		// Return to the user input reply
		yield { type: "text", text: response }
	}

	/**
	 * Get model information
	 */
	getModel(): { id: string; info: ModelInfo } {
		// Human relay does not depend on a specific model, here is a default configuration
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
	 * Implementation of a single prompt
	 * @param prompt Prompt content
	 */
	async completePrompt(prompt: string): Promise<string> {
		// Copy to clipboard
		await vscode.env.clipboard.writeText(prompt)

		// A dialog box pops up to request user action
		const response = await showHumanRelayDialog(prompt, this.options)

		if (!response) {
			throw new Error("Human relay operation cancelled")
		}

		return response
	}
}

/**
 * Extract text content from message object
 * @param message
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

// Elevate lastAIResponse variable to module level to maintain state between multiple calls
let lastAIResponse: string | null = null
// Add normalized cache to avoid repeatedly processing the same content
let normalizedPrompt: string | null = null
let normalizedLastResponse: string | null = null

/**
 * Normalize string by removing excess whitespace
 * @param text Input string
 * @returns Normalized string
 */
function normalizeText(text: string | null): string {
	if (!text) return ""
	// Remove all whitespace and convert to lowercase for case-insensitive comparison
	return text.replace(/\s+/g, " ").trim()
}

/**
 * Compare two strings, ignoring whitespace
 * @param str1 First string
 * @param str2 Second string
 * @returns Whether equal
 */
function isTextEqual(str1: string | null, str2: string | null): boolean {
	if (str1 === str2) return true // Fast path: same reference
	if (!str1 || !str2) return false // One is empty

	return normalizeText(str1) === normalizeText(str2)
}

/**
 * Displays the human relay dialog and waits for user response.
 * @param promptText The prompt text that needs to be copied.
 * @returns The user's input response or undefined (if canceled).
 */
async function showHumanRelayDialog(promptText: string, options?: ApiHandlerOptions): Promise<string | undefined> {
	// Save initial clipboard content for comparison
	const initialClipboardContent = await vscode.env.clipboard.readText()
	// Pre-normalize prompt text to avoid repeated processing during polling
	normalizedPrompt = normalizeText(promptText)

	return new Promise<string | undefined>((resolve) => {
		// Create a unique request ID
		const requestId = Date.now().toString()

		// Register a global callback function
		vscode.commands.executeCommand(
			"roo-cline.registerHumanRelayCallback",
			requestId,
			(response: string | undefined) => {
				// Clear clipboard monitoring timer
				if (clipboardInterval) {
					clearInterval(clipboardInterval)
					clipboardInterval = null
				}
				resolve(response)
			},
		)

		// Open the dialog box directly using the current panel
		vscode.commands.executeCommand("roo-cline.showHumanRelayDialog", {
			requestId,
			promptText,
		})

		// If clipboard monitoring is enabled, start polling for clipboard changes
		let clipboardInterval: NodeJS.Timeout | null = null

		if (options?.humanRelayMonitorClipboard) {
			const monitorInterval = Math.min(Math.max(100, options?.humanRelayMonitorInterval ?? 500), 2000)

			clipboardInterval = setInterval(async () => {
				try {
					// Check if clipboard has changed
					const currentClipboardContent = await vscode.env.clipboard.readText()

					if (!currentClipboardContent || !currentClipboardContent.trim()) {
						return // Skip empty content
					}

					// Normalize current clipboard content to avoid repeated processing
					const normalizedClipboard = normalizeText(currentClipboardContent)

					// Validate clipboard content and check for duplicate response
					if (
						normalizedClipboard !== normalizeText(initialClipboardContent) &&
						normalizedClipboard !== normalizedPrompt &&
						normalizedClipboard !== normalizedLastResponse
					) {
						// Update last AI response
						lastAIResponse = currentClipboardContent
						normalizedLastResponse = normalizedClipboard

						// Clear timer
						if (clipboardInterval) {
							clearInterval(clipboardInterval)
							clipboardInterval = null
						}

						// Get current panel
						const panel = getPanel()
						if (panel) {
							// Send close dialog message
							panel.webview.postMessage({ type: "closeHumanRelayDialog" })
						}

						// Send response automatically
						vscode.commands.executeCommand("roo-cline.handleHumanRelayResponse", {
							requestId,
							text: currentClipboardContent,
						})
					}

					// New: Check if the last AI response content was copied
					// Use improved comparison method
					else if (
						normalizedClipboard === normalizedLastResponse &&
						normalizedClipboard !== normalizedPrompt
					) {
						// Get current panel and send warning message
						const panel = getPanel()
						panel?.webview.postMessage({ type: "showDuplicateResponseAlert" })
					}
				} catch (error) {
					console.error("Error monitoring clipboard:", error)
				}
			}, monitorInterval)
		}
	})
}
