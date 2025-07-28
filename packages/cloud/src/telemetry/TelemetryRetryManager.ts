import { TelemetryEvent, TelemetryEventName } from "@roo-code/types"
import { TelemetryQueue, QueuedTelemetryEvent } from "./TelemetryQueue"

export interface RetryManagerConfig {
	retryIntervalMs: number
	batchSize: number
	onConnectionStatusChange?: (isConnected: boolean) => void
	onQueueSizeChange?: (size: number, isAboveWarningThreshold: boolean) => void
}

const DEFAULT_CONFIG: RetryManagerConfig = {
	retryIntervalMs: 30000, // 30 seconds
	batchSize: 10,
}

/**
 * TelemetryRetryManager handles the retry logic for failed telemetry events.
 * It processes queued events with exponential backoff and manages connection status.
 */
export class TelemetryRetryManager {
	private retryTimer?: NodeJS.Timeout
	private isProcessing = false
	private isConnected = true
	private lastConnectionCheck = 0
	private connectionCheckInterval = 60000 // 1 minute

	constructor(
		private queue: TelemetryQueue,
		private sendEvent: (event: TelemetryEvent) => Promise<void>,
		private config: RetryManagerConfig = DEFAULT_CONFIG,
	) {}

	/**
	 * Starts the retry manager
	 */
	start(): void {
		if (this.retryTimer) {
			return
		}

		// Start the retry timer
		this.retryTimer = setInterval(() => {
			this.processQueue()
		}, this.config.retryIntervalMs)

		// Process immediately on start
		this.processQueue()
	}

	/**
	 * Stops the retry manager
	 */
	stop(): void {
		if (this.retryTimer) {
			clearInterval(this.retryTimer)
			this.retryTimer = undefined
		}
	}

	/**
	 * Manually triggers queue processing
	 */
	async triggerRetry(): Promise<void> {
		await this.processQueue()
	}

	/**
	 * Adds a failed event to the queue and triggers processing
	 */
	async queueFailedEvent(event: TelemetryEvent, error?: string): Promise<void> {
		await this.queue.enqueue(event, error)

		// Update connection status if we're getting failures
		if (error && this.isConnected) {
			this.updateConnectionStatus(false)
		}

		// Notify about queue size change
		await this.notifyQueueSizeChange()
	}

	/**
	 * Gets the current connection status
	 */
	getConnectionStatus(): boolean {
		return this.isConnected
	}

	/**
	 * Processes the queue, retrying events that are ready
	 */
	private async processQueue(): Promise<void> {
		if (this.isProcessing) {
			return
		}

		this.isProcessing = true

		try {
			// Prune events that have exceeded max retries
			const prunedCount = await this.queue.pruneFailedEvents()
			if (prunedCount > 0) {
				console.log(`[TelemetryRetryManager] Pruned ${prunedCount} events that exceeded max retries`)
			}

			// Get events ready for retry
			const eventsToRetry = await this.queue.getEventsForRetry()

			if (eventsToRetry.length === 0) {
				return
			}

			console.log(`[TelemetryRetryManager] Processing ${eventsToRetry.length} events for retry`)

			// Process in batches
			const batches = this.createBatches(eventsToRetry, this.config.batchSize)

			for (const batch of batches) {
				await this.processBatch(batch)
			}

			// Check connection status periodically
			await this.checkConnectionStatus()

			// Notify about queue size change
			await this.notifyQueueSizeChange()
		} catch (error) {
			console.error("[TelemetryRetryManager] Error processing queue:", error)
		} finally {
			this.isProcessing = false
		}
	}

	/**
	 * Processes a batch of events
	 */
	private async processBatch(batch: QueuedTelemetryEvent[]): Promise<void> {
		const results = await Promise.allSettled(
			batch.map(async (queuedEvent) => {
				try {
					await this.sendEvent(queuedEvent.event)
					return { id: queuedEvent.id, success: true }
				} catch (error) {
					return {
						id: queuedEvent.id,
						success: false,
						error: error instanceof Error ? error.message : String(error),
					}
				}
			}),
		)

		// Update queue based on results
		let successCount = 0
		let failureCount = 0

		for (const result of results) {
			if (result.status === "fulfilled") {
				const { id, success, error } = result.value
				await this.queue.updateEventAfterRetry(id, success, error)

				if (success) {
					successCount++
				} else {
					failureCount++
				}
			}
		}

		console.log(`[TelemetryRetryManager] Batch complete: ${successCount} succeeded, ${failureCount} failed`)

		// Update connection status based on results
		if (successCount > 0 && !this.isConnected) {
			this.updateConnectionStatus(true)
		} else if (failureCount === batch.length && this.isConnected) {
			this.updateConnectionStatus(false)
		}
	}

	/**
	 * Checks connection status by attempting to send a test event
	 */
	private async checkConnectionStatus(): Promise<void> {
		const now = Date.now()

		// Only check periodically
		if (now - this.lastConnectionCheck < this.connectionCheckInterval) {
			return
		}

		this.lastConnectionCheck = now

		try {
			// Try to send a minimal test event
			await this.sendEvent({
				event: TelemetryEventName.TELEMETRY_CONNECTION_CHECK,
				properties: { timestamp: now },
			})

			if (!this.isConnected) {
				this.updateConnectionStatus(true)
			}
		} catch (_error) {
			if (this.isConnected) {
				this.updateConnectionStatus(false)
			}
		}
	}

	/**
	 * Updates connection status and notifies listeners
	 */
	private updateConnectionStatus(isConnected: boolean): void {
		if (this.isConnected === isConnected) {
			return
		}

		this.isConnected = isConnected
		console.log(`[TelemetryRetryManager] Connection status changed: ${isConnected ? "connected" : "disconnected"}`)

		if (this.config.onConnectionStatusChange) {
			this.config.onConnectionStatusChange(isConnected)
		}
	}

	/**
	 * Notifies about queue size changes
	 */
	private async notifyQueueSizeChange(): Promise<void> {
		const metadata = await this.queue.getQueueMetadata()

		if (this.config.onQueueSizeChange) {
			this.config.onQueueSizeChange(metadata.size, metadata.isAboveWarningThreshold)
		}
	}

	/**
	 * Creates batches from an array of events
	 */
	private createBatches<T>(items: T[], batchSize: number): T[][] {
		const batches: T[][] = []

		for (let i = 0; i < items.length; i += batchSize) {
			batches.push(items.slice(i, i + batchSize))
		}

		return batches
	}
}
