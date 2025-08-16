import { TelemetryEvent, TelemetryEventSubscription } from "@roo-code/types"
import { BaseTelemetryClient } from "./BaseTelemetryClient"
import { TelemetryQueueManager } from "./TelemetryQueueManager"

/**
 * QueuedTelemetryClient extends BaseTelemetryClient to add queuing and retry capabilities.
 * Failed events are automatically queued and retried with exponential backoff.
 */
export abstract class QueuedTelemetryClient extends BaseTelemetryClient {
	protected queueManager: TelemetryQueueManager | null = null
	protected clientId: string
	private retryTimer: NodeJS.Timeout | null = null
	private isOnline = true
	private readonly retryCheckInterval: number

	constructor(
		clientId: string,
		storagePath: string,
		subscription?: TelemetryEventSubscription,
		debug = false,
		retryCheckInterval = 30000, // Default: Check for retries every 30 seconds
	) {
		super(subscription, debug)
		this.clientId = clientId
		this.retryCheckInterval = retryCheckInterval

		// Initialize queue manager
		try {
			this.queueManager = TelemetryQueueManager.getInstance(storagePath, debug)
			this.startRetryTimer()
		} catch (error) {
			console.error(`Failed to initialize queue manager: ${error}`)
		}
	}

	/**
	 * Capture an event with automatic queuing on failure
	 */
	public async capture(event: TelemetryEvent): Promise<void> {
		if (!this.isTelemetryEnabled() || !this.isEventCapturable(event.event)) {
			return
		}

		try {
			// Try to send the event
			await this.sendEvent(event)

			// If successful and we have queued events, try to process them
			if (this.queueManager && this.isOnline) {
				this.processQueuedEvents()
			}
		} catch (error) {
			// Queue the event for retry
			if (this.queueManager) {
				this.queueManager.enqueue(event, this.clientId)
				this.isOnline = false
			}

			// Re-throw if no queue manager (maintains original behavior)
			if (!this.queueManager) {
				throw error
			}
		}
	}

	/**
	 * Abstract method that subclasses must implement to actually send the event
	 */
	protected abstract sendEvent(event: TelemetryEvent): Promise<void>

	/**
	 * Process queued events
	 */
	private async processQueuedEvents(): Promise<void> {
		if (!this.queueManager) {
			return
		}

		const eventsToRetry = this.queueManager.getEventsForRetry(this.clientId)

		if (eventsToRetry.length === 0) {
			return
		}

		await this.queueManager.processQueue(this.clientId, async (event) => {
			await this.sendEvent(event)
			this.isOnline = true
		})
	}

	/**
	 * Start the retry timer
	 */
	private startRetryTimer(): void {
		this.retryTimer = setInterval(() => {
			this.processQueuedEvents()
		}, this.retryCheckInterval)
	}

	/**
	 * Stop the retry timer
	 */
	private stopRetryTimer(): void {
		if (this.retryTimer) {
			clearInterval(this.retryTimer)
			this.retryTimer = null
		}
	}

	/**
	 * Get queue statistics for this client
	 */
	public getQueueStats(): { queueSize: number; oldestEventAge: number | null } | null {
		if (!this.queueManager) {
			return null
		}

		const stats = this.queueManager.getStats()
		const clientEventCount = stats.eventsByClient[this.clientId] || 0

		return {
			queueSize: clientEventCount,
			oldestEventAge: stats.oldestEventAge,
		}
	}

	/**
	 * Shutdown the client and persist any queued events
	 */
	public async shutdown(): Promise<void> {
		this.stopRetryTimer()

		// Try to send any remaining queued events one last time
		if (this.queueManager) {
			await this.processQueuedEvents()
		}
	}
}
