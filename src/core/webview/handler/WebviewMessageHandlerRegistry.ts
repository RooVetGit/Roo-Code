import { WebviewMessage } from "../../../shared/WebviewMessage"
import { registerAutoApprovalHandler } from "./auto-approval"
import { registerNotificationHandler } from "./notification"
import { IWebviewMessageHandler, IWebviewMessageHandlerRegistry } from "./types"

/**
 * Singleton registry for managing webview message handlers
 * This class maintains a mapping of message types to their respective handlers
 */
export class WebviewMessageHandlerRegistry implements IWebviewMessageHandlerRegistry {
	private static instance: WebviewMessageHandlerRegistry
	private handlers: Map<WebviewMessage["type"], IWebviewMessageHandler> = new Map()

	private constructor() {
		this.registerAllHandlers()
	}

	/**
	 * Get the singleton instance of the registry
	 */
	public static getInstance(): WebviewMessageHandlerRegistry {
		if (!WebviewMessageHandlerRegistry.instance) {
			WebviewMessageHandlerRegistry.instance = new WebviewMessageHandlerRegistry()
		}
		return WebviewMessageHandlerRegistry.instance
	}

	/**
	 * Register a handler for a specific message type
	 * @param messageType The message type to handle
	 * @param handler The handler instance
	 */
	public registerHandler(messageType: WebviewMessage["type"], handler: IWebviewMessageHandler): void {
		if (this.handlers.has(messageType)) {
			console.warn(`Handler for message type '${messageType}' is already registered. Overwriting.`)
		}
		this.handlers.set(messageType, handler)
	}

	/**
	 * Get a handler for a specific message type
	 * @param messageType The message type
	 * @returns The handler instance or undefined if not found
	 */
	public getHandler(messageType: WebviewMessage["type"]): IWebviewMessageHandler | undefined {
		return this.handlers.get(messageType)
	}

	/**
	 * Get all registered message types
	 * @returns Array of registered message types
	 */
	public getRegisteredTypes(): WebviewMessage["type"][] {
		return Array.from(this.handlers.keys())
	}

	/**
	 * Check if a message type has a registered handler
	 * @param messageType The message type to check
	 * @returns True if handler exists, false otherwise
	 */
	public hasHandler(messageType: WebviewMessage["type"]): boolean {
		return this.handlers.has(messageType)
	}

	/**
	 * Register all handlers - this method will be expanded as handlers are created
	 */
	private registerAllHandlers(): void {
		registerAutoApprovalHandler(this)
		registerNotificationHandler(this)
	}

	/**
	 * Get registry statistics for debugging
	 * @returns Object containing registry statistics
	 */
	public getStats(): { totalHandlers: number; registeredTypes: WebviewMessage["type"][] } {
		return {
			totalHandlers: this.handlers.size,
			registeredTypes: this.getRegisteredTypes(),
		}
	}
}
