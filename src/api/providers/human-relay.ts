import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandlerOptions, ModelInfo } from "../../shared/api"
import { ApiHandler, SingleCompletionHandler } from "../index"
import { ApiStream } from "../transform/stream"
import * as vscode from "vscode"
import { ExtensionMessage } from "../../shared/ExtensionMessage"
import { getPanel } from "../../activate/registerCommands" // Import the getPanel function

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
	 * @param systemPrompt System prompt text
	 * @param messages Message list
	 */
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		// Get the most recent user message
		const latestMessage = messages[messages.length - 1]

		if (!latestMessage) {
			throw new Error("No message to relay")
		}

		// If it is the first message, concatenate the system prompt with the user message
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
			// The user canceled the operation
			throw new Error("Human relay operation cancelled")
		}

		// Return the user-provided response
		yield { type: "text", text: response }
	}

	/**
	 * Get model information
	 */
	getModel(): { id: string; info: ModelInfo } {
		// Human relay does not depend on a specific model; here is a default configuration
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
	 * @param prompt Prompt content
	 */
	async completePrompt(prompt: string): Promise<string> {
		// Copy to clipboard
		await vscode.env.clipboard.writeText(prompt)

		// Display a dialog box to request user action
		const response = await showHumanRelayDialog(prompt, this.options)

		if (!response) {
			throw new Error("Human relay operation cancelled")
		}

		return response
	}
}

/**
 * Extract text content from a message object
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
	// Remove all excess whitespace and convert to lowercase for case-insensitive comparison
	return text.replace(/\s+/g, " ").trim()
}

/**
 * Compare two strings, ignoring whitespace
 * @param str1 First string
 * @param str2 Second string
 * @returns Whether they are equal
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
					const currentClipboardContent = await vscode.env.clipboard.readText()

					if (!currentClipboardContent || !currentClipboardContent.trim()) {
						return
					}

					const normalizedClipboard = normalizeText(currentClipboardContent)
					const panel = getPanel()

					// Check if it’s a duplicate response
					if (normalizedClipboard === normalizedLastResponse) {
						panel?.webview.postMessage({
							type: "showHumanRelayResponseAlert",
							text: "It seems you copied the AI's response from the last interaction instead of the current task. Please check your interaction with the web AI",
						})
						return
					}
					if (!containsValidTags(currentClipboardContent)) {
						panel?.webview.postMessage({
							type: "showHumanRelayResponseAlert",
							text: "The AI's response does not seem to meet the RooCode format requirements. Please check your interaction with the web AI.",
						})
						return
					}

					// Process new valid response
					if (normalizedClipboard !== normalizedPrompt) {
						lastAIResponse = currentClipboardContent
						normalizedLastResponse = normalizedClipboard

						// Clear timer
						if (clipboardInterval) {
							clearInterval(clipboardInterval)
							clipboardInterval = null
						}

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
	})
}

/**
 * Validate if the content contains any tag in <xxx> format
 * @param content The content to validate
 * @returns Whether the content contains a valid tag format
 */
function containsValidTags(content: string): boolean {
	// Use a regular expression to match tags in <xxx> format
	const tagPattern = /<[^>]+>/
	return tagPattern.test(content)
}
