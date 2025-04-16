import * as vscode from "vscode"
/**
 * Human Relay API processor
 * This processor does not directly call the API, but interacts with the model through human operations copy and paste.
 */
export class HumanRelayHandler {
	options
	constructor(options) {
		this.options = options
	}
	countTokens(content) {
		return Promise.resolve(0)
	}
	/**
	 * Create a message processing flow, display a dialog box to request human assistance
	 * @param systemPrompt System prompt words
	 * @param messages Message list
	 */
	async *createMessage(systemPrompt, messages) {
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
		const response = await showHumanRelayDialog(promptText)
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
	getModel() {
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
	async completePrompt(prompt) {
		// Copy to clipboard
		await vscode.env.clipboard.writeText(prompt)
		// A dialog box pops up to request user action
		const response = await showHumanRelayDialog(prompt)
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
function getMessageContent(message) {
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
async function showHumanRelayDialog(promptText) {
	return new Promise((resolve) => {
		// Create a unique request ID
		const requestId = Date.now().toString()
		// Register a global callback function
		vscode.commands.executeCommand("roo-cline.registerHumanRelayCallback", requestId, (response) => {
			resolve(response)
		})
		// Open the dialog box directly using the current panel
		vscode.commands.executeCommand("roo-cline.showHumanRelayDialog", {
			requestId,
			promptText,
		})
	})
}
//# sourceMappingURL=human-relay.js.map
