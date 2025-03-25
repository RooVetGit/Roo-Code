import * as vscode from "vscode"
import { ContextProxy } from "../../contextProxy"
import { SecretKey } from "../../../shared/globalState"

// Define our custom secret key type
type CustomSecretKey = "customInstructionsApiKey"

export class CustomInstructionsSubscriber {
	private contextProxy: ContextProxy

	constructor(contextProxy: ContextProxy) {
		this.contextProxy = contextProxy
	}

	public async handleMessage(message: any): Promise<void> {
		if (message.type === "customInstructions") {
			await this.updateCustomInstructions(message.text)
		}
	}

	private async updateCustomInstructions(text: string): Promise<void> {
		// Save instructions to global state
		await this.contextProxy.updateGlobalState("customInstructions", text)

		// If in development mode, log the update
		if (this.contextProxy.extensionMode === vscode.ExtensionMode.Development) {
			console.log("Custom instructions updated:", text)
		}

		// Example of using secrets
		const apiKey = await this.contextProxy.getSecret("customInstructionsApiKey" as SecretKey)
		if (apiKey) {
			// Process with API key
		}
	}
}
