/**
 * Copilot message handling module
 *
 * This module implements the Strategy pattern for handling Copilot-related messages.
 * Each message type has its own dedicated handler that implements the MessageHandler interface.
 *
 * Supported message types:
 * - requestCopilotModels: Fetches available Copilot models
 * - authenticateCopilot: Initiates Copilot authentication flow
 * - clearCopilotAuth: Clears stored Copilot authentication
 * - checkCopilotAuth: Checks current Copilot authentication status
 */

import { RequestCopilotModelsStrategy } from "./requestCopilotModels"
import { AuthenticateCopilotStrategy } from "./authenticateCopilot"
import { ClearCopilotAuthStrategy } from "./clearCopilotAuth"
import { CheckCopilotAuthStrategy } from "./checkCopilotAuth"
import { MessageHandlerRegistry } from "../types"

/**
 * Register all Copilot-related message handler strategies
 */
export function registerCopilotStrategies(messageHandlerRegistry: MessageHandlerRegistry): void {
	// Register each strategy with its corresponding message type
	messageHandlerRegistry.registerStrategy("requestCopilotModels", new RequestCopilotModelsStrategy())
	messageHandlerRegistry.registerStrategy("authenticateCopilot", new AuthenticateCopilotStrategy())
	messageHandlerRegistry.registerStrategy("clearCopilotAuth", new ClearCopilotAuthStrategy())
	messageHandlerRegistry.registerStrategy("checkCopilotAuth", new CheckCopilotAuthStrategy())
}
