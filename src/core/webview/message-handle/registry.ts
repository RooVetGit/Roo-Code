import { registerCopilotStrategies } from "./copilot"
import { MessageHandlerStrategy, MessageHandlerRegistry, MessageHandlerContext } from "./types"

/**
 * Central registry for message handler strategies
 * Implements strategy pattern with key-based registration
 */
export class DefaultMessageHandlerRegistry implements MessageHandlerRegistry {
	private static instance: DefaultMessageHandlerRegistry | null = null
	private strategies: Map<string, MessageHandlerStrategy> = new Map()

	private constructor() {}

	public static getInstance() {
		if (DefaultMessageHandlerRegistry.instance === null) {
			DefaultMessageHandlerRegistry.instance = new DefaultMessageHandlerRegistry()
			registerCopilotStrategies(DefaultMessageHandlerRegistry.instance)
		}
		return DefaultMessageHandlerRegistry.instance
	}

	/**
	 * Registers a strategy for handling a specific message type
	 */
	registerStrategy(messageType: string, strategy: MessageHandlerStrategy): void {
		this.strategies.set(messageType, strategy)
	}

	/**
	 * Gets a strategy for the given message type
	 */
	getStrategy(messageType: string): MessageHandlerStrategy | null {
		return this.strategies.get(messageType) || null
	}

	/**
	 * Gets all registered message types
	 */
	getSupportedTypes(): string[] {
		return Array.from(this.strategies.keys())
	}
}
