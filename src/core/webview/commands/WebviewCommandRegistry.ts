import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"
import { WebviewCommandHandler } from "./WebviewCommandHandler"

/**
 * Registry for webview command handlers
 * Manages the registration and execution of command handlers for different message types
 */
export class WebviewCommandRegistry {
	private handlers: Map<string, WebviewCommandHandler> = new Map()

	/**
	 * Register a command handler for a specific message type
	 * @param type The message type to handle
	 * @param handler The handler to register
	 */
	register(type: WebviewMessage["type"] | string, handler: WebviewCommandHandler): void {
		this.handlers.set(type, handler)
	}

	/**
	 * Execute the appropriate handler for a given message
	 * @param message The webview message to process
	 * @param provider The ClineProvider instance
	 */
	async execute(message: WebviewMessage | { type: string }, provider: ClineProviderInterface): Promise<void> {
		const handler = this.handlers.get(message.type)
		if (handler) {
			await handler.execute(message, provider)
		} else {
			provider.outputChannel.appendLine(`No handler registered for message type: ${message.type}`)
		}
	}
}
