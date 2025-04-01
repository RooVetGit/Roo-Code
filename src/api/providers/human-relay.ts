import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandlerOptions, ModelInfo } from "../../shared/api"
import { ApiHandler, SingleCompletionHandler } from "../index"
import { ApiStream } from "../transform/stream"
import * as vscode from "vscode"
import { ExtensionMessage } from "../../shared/ExtensionMessage"

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
		try {
			// Get the most recent user message
			const latestMessage = messages[messages.length - 1]

			if (!latestMessage) {
				throw new Error(
					JSON.stringify({
						status: 400,
						message: "No message to relay",
						error: {
							metadata: {
								raw: "Message list is empty",
								provider: "human-relay",
							},
						},
					}),
				)
			}

			// If it is the first message, splice the system prompt word with the user message
			let promptText = ""
			try {
				if (messages.length === 1) {
					promptText = `${systemPrompt}\n\n${getMessageContent(latestMessage)}`
				} else {
					promptText = getMessageContent(latestMessage)
				}
			} catch (error) {
				throw new Error(
					JSON.stringify({
						status: 400,
						message: "Invalid message format",
						error: {
							metadata: {
								raw: error instanceof Error ? error.message : String(error),
								provider: "human-relay",
							},
						},
					}),
				)
			}

			// Copy to clipboard
			try {
				await vscode.env.clipboard.writeText(promptText)
			} catch (error) {
				throw new Error(
					JSON.stringify({
						status: 500,
						message: "Clipboard access error",
						error: {
							metadata: {
								raw: error instanceof Error ? error.message : "Failed to access clipboard",
								provider: "human-relay",
							},
						},
					}),
				)
			}

			// Show dialog and wait for response
			let response: string | undefined
			try {
				response = await showHumanRelayDialog(promptText)
			} catch (error) {
				throw new Error(
					JSON.stringify({
						status: 500,
						message: "Dialog interaction error",
						error: {
							metadata: {
								raw: error instanceof Error ? error.message : "Failed to show dialog",
								provider: "human-relay",
							},
						},
					}),
				)
			}

			if (!response) {
				throw new Error(
					JSON.stringify({
						status: 499, // Client Closed Request
						message: "Operation cancelled",
						error: {
							metadata: {
								raw: "Human relay operation cancelled by user",
								provider: "human-relay",
							},
						},
					}),
				)
			}

			if (!response.trim()) {
				throw new Error(
					JSON.stringify({
						status: 400,
						message: "Empty response",
						error: {
							metadata: {
								raw: "Response contains only whitespace",
								provider: "human-relay",
							},
						},
					}),
				)
			}

			// Return the user input reply
			yield { type: "text", text: response }
		} catch (error) {
			// If error is already formatted, re-throw it
			if (error instanceof Error && error.message.startsWith("{")) {
				throw error
			}

			// Handle any other unexpected errors
			console.error("Human relay error:", error)
			throw new Error(
				JSON.stringify({
					status: 500,
					message: "Internal error",
					error: {
						metadata: {
							raw: error instanceof Error ? error.message : String(error),
							provider: "human-relay",
						},
					},
				}),
			)
		}
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
	 * Implementation of a single prompt
	 * @param prompt Prompt content
	 */
	async completePrompt(prompt: string): Promise<string> {
		try {
			// Copy to clipboard
			try {
				await vscode.env.clipboard.writeText(prompt)
			} catch (error) {
				throw new Error(
					JSON.stringify({
						status: 500,
						message: "Clipboard access error",
						error: {
							metadata: {
								raw: error instanceof Error ? error.message : "Failed to access clipboard",
								provider: "human-relay",
							},
						},
					}),
				)
			}

			// Show dialog and wait for response
			const response = await showHumanRelayDialog(prompt)

			if (!response) {
				throw new Error(
					JSON.stringify({
						status: 499,
						message: "Operation cancelled",
						error: {
							metadata: {
								raw: "Human relay operation cancelled by user",
								provider: "human-relay",
							},
						},
					}),
				)
			}

			if (!response.trim()) {
				throw new Error(
					JSON.stringify({
						status: 400,
						message: "Empty response",
						error: {
							metadata: {
								raw: "Response contains only whitespace",
								provider: "human-relay",
							},
						},
					}),
				)
			}

			return response
		} catch (error) {
			// If error is already formatted, re-throw it
			if (error instanceof Error && error.message.startsWith("{")) {
				throw error
			}

			// Handle any other unexpected errors
			console.error("Human relay error:", error)
			throw new Error(
				JSON.stringify({
					status: 500,
					message: "Internal error",
					error: {
						metadata: {
							raw: error instanceof Error ? error.message : String(error),
							provider: "human-relay",
						},
					},
				}),
			)
		}
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
/**
 * Displays the human relay dialog and waits for user response.
 * @param promptText The prompt text that needs to be copied.
 * @returns The user's input response or undefined (if canceled).
 */
async function showHumanRelayDialog(promptText: string): Promise<string | undefined> {
	return new Promise<string | undefined>((resolve) => {
		// Create a unique request ID
		const requestId = Date.now().toString()

		// Register a global callback function
		vscode.commands.executeCommand(
			"roo-cline.registerHumanRelayCallback",
			requestId,
			(response: string | undefined) => {
				resolve(response)
			},
		)

		// Open the dialog box directly using the current panel
		vscode.commands.executeCommand("roo-cline.showHumanRelayDialog", {
			requestId,
			promptText,
		})
	})
}
