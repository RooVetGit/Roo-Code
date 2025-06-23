import * as vscode from "vscode"
import { TelemetryEvent, TelemetryClient, TelemetryPropertiesProvider, TelemetryEventName } from "@roo-code/types"
import { TelemetryRetryQueue, RetryQueueConfig } from "./TelemetryRetryQueue"

/**
 * ResilientTelemetryClient wraps any TelemetryClient with retry functionality.
 * It provides:
 * - Automatic retry with exponential backoff for failed sends
 * - Persistent queue that survives extension restarts
 * - Connection status monitoring
 * - Priority handling for critical events
 * - User notifications for prolonged disconnection
 */
export class ResilientTelemetryClient implements TelemetryClient {
	private wrappedClient: TelemetryClient
	private retryQueue: TelemetryRetryQueue
	private context: vscode.ExtensionContext
	private isOnline = true
	private retryInterval: NodeJS.Timeout | null = null

	// Events that should be treated as high priority
	private readonly highPriorityEvents = new Set([
		TelemetryEventName.SCHEMA_VALIDATION_ERROR,
		TelemetryEventName.DIFF_APPLICATION_ERROR,
		TelemetryEventName.SHELL_INTEGRATION_ERROR,
		TelemetryEventName.CONSECUTIVE_MISTAKE_ERROR,
	])

	constructor(
		wrappedClient: TelemetryClient,
		context: vscode.ExtensionContext,
		config: Partial<RetryQueueConfig> = {},
	) {
		this.wrappedClient = wrappedClient
		this.context = context
		this.retryQueue = new TelemetryRetryQueue(context, config)

		// Start periodic retry processing
		this.startRetryProcessor()

		// Register commands for manual control
		this.registerCommands()
	}

	public get subscription() {
		return this.wrappedClient.subscription
	}

	public setProvider(provider: TelemetryPropertiesProvider): void {
		this.wrappedClient.setProvider(provider)
	}

	public async capture(event: TelemetryEvent): Promise<void> {
		// Always try to send immediately first, regardless of telemetry state
		// The wrapped client will handle telemetry state checking
		const success = await this.attemptSend(event)

		// Only queue if telemetry is enabled and send failed
		if (!success && this.wrappedClient.isTelemetryEnabled()) {
			const priority = this.highPriorityEvents.has(event.event) ? "high" : "normal"
			await this.retryQueue.enqueue(event, priority)
		}
	}

	public updateTelemetryState(didUserOptIn: boolean): void {
		this.wrappedClient.updateTelemetryState(didUserOptIn)
	}

	public isTelemetryEnabled(): boolean {
		return this.wrappedClient.isTelemetryEnabled()
	}

	public async shutdown(): Promise<void> {
		// Stop retry processor
		if (this.retryInterval) {
			clearInterval(this.retryInterval)
			this.retryInterval = null
		}

		// Dispose retry queue
		this.retryQueue.dispose()

		// Shutdown wrapped client
		await this.wrappedClient.shutdown()
	}

	/**
	 * Gets the current retry queue status
	 */
	public async getQueueStatus(): Promise<{
		queueSize: number
		connectionStatus: ReturnType<TelemetryRetryQueue["getConnectionStatus"]>
	}> {
		return {
			queueSize: await this.retryQueue.getQueueSize(),
			connectionStatus: this.retryQueue.getConnectionStatus(),
		}
	}

	/**
	 * Manually triggers a retry of queued events
	 */
	public async retryNow(): Promise<void> {
		await this.retryQueue.triggerRetry((event) => this.attemptSend(event))
	}

	/**
	 * Clears all queued events
	 */
	public async clearQueue(): Promise<void> {
		await this.retryQueue.clearQueue()
	}

	/**
	 * Updates the retry queue configuration
	 */
	public updateRetryConfig(config: Partial<RetryQueueConfig>): void {
		this.retryQueue.updateConfig(config)
	}

	private async attemptSend(event: TelemetryEvent): Promise<boolean> {
		try {
			await this.wrappedClient.capture(event)
			return true
		} catch (error) {
			// Only log as warning if telemetry is actually enabled
			if (this.wrappedClient.isTelemetryEnabled()) {
				console.warn(`[ResilientTelemetryClient] Failed to send telemetry event: ${error}`)
			}
			return false
		}
	}

	private startRetryProcessor(): void {
		// Process retry queue every 30 seconds
		this.retryInterval = setInterval(async () => {
			try {
				await this.retryQueue.processQueue((event) => this.attemptSend(event))
			} catch (error) {
				console.error(`[ResilientTelemetryClient] Error processing retry queue: ${error}`)
			}
		}, 30000) // 30 seconds
	}

	private registerCommands(): void {
		// Register command to show queue status
		vscode.commands.registerCommand("roo-code.telemetry.showQueue", async () => {
			const status = await this.getQueueStatus()
			const connectionStatus = status.connectionStatus.isConnected ? "Connected" : "Disconnected"
			const lastSuccess = new Date(status.connectionStatus.lastSuccessfulSend).toLocaleString()

			const message = `Telemetry Queue Status:
• Queue Size: ${status.queueSize} events
• Connection: ${connectionStatus}
• Last Successful Send: ${lastSuccess}
• Consecutive Failures: ${status.connectionStatus.consecutiveFailures}`

			const actions = ["Retry Now", "Clear Queue", "Close"]
			const selection = await vscode.window.showInformationMessage(message, ...actions)

			switch (selection) {
				case "Retry Now":
					await this.retryNow()
					vscode.window.showInformationMessage("Telemetry retry triggered")
					break
				case "Clear Queue":
					await this.clearQueue()
					vscode.window.showInformationMessage("Telemetry queue cleared")
					break
			}
		})

		// Register command to manually retry now
		vscode.commands.registerCommand("roo-code.telemetry.retryNow", async () => {
			await this.retryNow()
		})

		// Register command to clear queue
		vscode.commands.registerCommand("roo-code.telemetry.clearQueue", async () => {
			const confirmation = await vscode.window.showWarningMessage(
				"Are you sure you want to clear all queued telemetry events?",
				"Yes",
				"No",
			)

			if (confirmation === "Yes") {
				await this.clearQueue()
				vscode.window.showInformationMessage("Telemetry queue cleared")
			}
		})
	}
}
