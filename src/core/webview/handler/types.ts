import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProvider } from "../ClineProvider"
import { MarketplaceManager } from "../../../services/marketplace"

export type WebviewMessageHandlerOptions = {
	marketplaceManager?: MarketplaceManager
}

/**
 * Interface for webview message handlers
 * Each handler is responsible for processing specific message types
 */
export interface IWebviewMessageHandler {
	/**
	 * Handle a webview message
	 * @param provider The ClineProvider instance
	 * @param message The webview message to handle
	 * @param marketplaceManager Optional marketplace manager
	 * @returns Promise that resolves when handling is complete
	 */
	handle(provider: ClineProvider, message: WebviewMessage, options?: WebviewMessageHandlerOptions): Promise<void>
}

/**
 * Interface for the WebviewMessageHandlerRegistry
 */
export interface IWebviewMessageHandlerRegistry {
	registerHandler(messageType: WebviewMessage["type"], handler: IWebviewMessageHandler): void
	getHandler(messageType: WebviewMessage["type"]): IWebviewMessageHandler | undefined
	getRegisteredTypes(): WebviewMessage["type"][]
	hasHandler(messageType: WebviewMessage["type"]): boolean
	getStats(): { totalHandlers: number; registeredTypes: WebviewMessage["type"][] }
}
