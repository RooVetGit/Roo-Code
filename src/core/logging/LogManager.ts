import { logLevels } from "../message-parsing/directives"
import { ClineProvider } from "../webview/ClineProvider"

/**
 * Manages logging functionality for Task instances.
 * Handles log messages from AI-generated <log_message> blocks.
 */
export class LogManager {
	private providerRef: WeakRef<ClineProvider>

	/**
	 * Creates a new LogManager instance.
	 * @param provider The ClineProvider instance to use for logging
	 */
	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
	}

	/**
	 * Logs a message to the output channel and console.
	 * This method is intended for internal logging triggered by the AI
	 * via <log_message> blocks and does not require user approval.
	 * @param message The message to log.
	 * @param level The log level (debug, info, warn, error). Defaults to "info".
	 */
	public log(message: string, level: (typeof logLevels)[number] = "info"): void {
		const timestamp = new Date().toISOString()
		const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`

		// Get the provider instance
		const provider = this.providerRef.deref()
		if (provider) {
			// Use the provider's log method which logs to both console and output channel
			provider.log(formattedMessage)
		}
	}

	/**
	 * Processes a log message directive from the assistant.
	 * @param message The log message
	 * @param level The log level
	 * @param partial Whether the log message is partial
	 * @returns true if the log was processed, false otherwise
	 */
	public processLogEntry(message: string, level: (typeof logLevels)[number], partial: boolean): boolean {
		// Only log complete (non-partial) log messages to avoid logging with incorrect levels
		if (!partial) {
			this.log(message, level)
			return true
		}
		return false
	}
}
