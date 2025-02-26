import { WebviewMessage } from "../../../shared/WebviewMessage"
import { ClineProviderInterface } from "../ClineProviderInterface"

/**
 * Interface for command handlers that process webview messages
 */
export interface WebviewCommandHandler {
	/**
	 * Execute the command with the given message and provider
	 * @param message The webview message to process
	 * @param provider The ClineProvider instance
	 */
	execute(
		message: WebviewMessage | { type: string; [key: string]: any },
		provider: ClineProviderInterface,
	): Promise<void>
}
