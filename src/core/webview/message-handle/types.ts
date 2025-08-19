import { ClineProvider } from "../ClineProvider"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { MarketplaceManager } from "../../../services/marketplace"

/**
 * Context provided to message handlers
 */
export interface MessageHandlerContext {
	/** The ClineProvider instance */
	provider: ClineProvider
	/** The webview message to handle */
	message: WebviewMessage
	/** Optional marketplace manager */
	marketplaceManager?: MarketplaceManager
}

/**
 * Strategy interface for handling specific message types
 */
export interface MessageHandlerStrategy {
	/**
	 * Handles a specific webview message type
	 * @param context The message handler context
	 */
	handle(context: MessageHandlerContext): Promise<void>
}

/**
 * Registry for message handler strategies
 */
export interface MessageHandlerRegistry {
	/**
	 * Registers a strategy for handling a specific message type
	 * @param messageType The type of message to handle
	 * @param strategy The strategy to register
	 */
	registerStrategy(messageType: string, strategy: MessageHandlerStrategy): void

	/**
	 * Gets a strategy for the given message type
	 * @param messageType The type of message to handle
	 * @returns MessageHandlerStrategy instance or null if not supported
	 */
	getStrategy(messageType: string): MessageHandlerStrategy | null

	/**
	 * Gets all registered message types
	 * @returns Array of supported message type strings
	 */
	getSupportedTypes(): string[]
}
