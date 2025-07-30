import * as vscode from "vscode"
import { randomUUID } from "crypto"
import { TelemetryEvent } from "@roo-code/types"

/**
 * Represents a telemetry event that has been queued for retry
 */
export interface QueuedTelemetryEvent {
	/** Unique identifier for the queued event */
	id: string
	/** Timestamp when the event was first queued */
	timestamp: number
	/** The original telemetry event */
	event: TelemetryEvent
	/** The client type that should process this event */
	clientType: "posthog" | "cloud"
	/** Number of times this event has been retried */
	retryCount: number
	/** Timestamp of the last retry attempt */
	lastAttempt?: number
	/** Timestamp when the next retry should occur */
	nextAttempt?: number
}

/**
 * TelemetryQueue manages failed telemetry events with persistent storage and retry logic.
 * It uses VSCode's globalState for persistence and implements exponential backoff for retries.
 */
export class TelemetryQueue {
	private static readonly STORAGE_KEY = "telemetryQueue"
	private static readonly MAX_QUEUE_SIZE = 1000
	private static readonly MAX_RETRY_COUNT = 10
	private static readonly SUCCESS_INTERVAL = 30000 // 30 seconds
	private static readonly INITIAL_BACKOFF_MS = 1000 // 1 second
	private static readonly MAX_BACKOFF_MS = 300000 // 5 minutes

	private events: QueuedTelemetryEvent[] = []
	private context: vscode.ExtensionContext
	private isProcessing = false
	private retryCallback?: (event: QueuedTelemetryEvent) => Promise<boolean>
	private timerId: NodeJS.Timeout | null = null
	private currentBackoffMs: number
	private attemptCount: number = 0
	private isRunning: boolean = false

	constructor(context: vscode.ExtensionContext) {
		this.context = context
		this.currentBackoffMs = TelemetryQueue.INITIAL_BACKOFF_MS

		// Load persisted queue on initialization
		this.loadQueue()
	}

	/**
	 * Sets the callback function that will be used to retry events
	 * @param callback Function that attempts to send an event, returns true if successful
	 */
	public setRetryCallback(callback: (event: QueuedTelemetryEvent) => Promise<boolean>): void {
		this.retryCallback = callback
	}

	/**
	 * Adds a failed event to the queue for retry
	 * @param event The telemetry event that failed to send
	 * @param clientType The client type that should process this event
	 */
	public async addEvent(event: TelemetryEvent, clientType: "posthog" | "cloud"): Promise<void> {
		const queuedEvent: QueuedTelemetryEvent = {
			id: randomUUID(),
			timestamp: Date.now(),
			event,
			clientType,
			retryCount: 0,
		}

		// Add to queue
		this.events.push(queuedEvent)

		// Enforce queue size limit (FIFO eviction)
		if (this.events.length > TelemetryQueue.MAX_QUEUE_SIZE) {
			this.events = this.events.slice(-TelemetryQueue.MAX_QUEUE_SIZE)
		}

		// Persist the updated queue
		await this.saveQueue()

		// Start the timer if not already running
		if (!this.isRunning) {
			this.start()
		}
	}

	/**
	 * Processes the queue, attempting to send all pending events
	 * @returns True if all events were processed successfully, false otherwise
	 */
	public async processQueue(): Promise<boolean> {
		if (this.isProcessing || !this.retryCallback) {
			return false
		}

		this.isProcessing = true
		const now = Date.now()
		let allSuccessful = true
		const remainingEvents: QueuedTelemetryEvent[] = []

		try {
			// Process events that are ready for retry
			for (const event of this.events) {
				// Skip if not ready for retry yet
				if (event.nextAttempt && event.nextAttempt > now) {
					remainingEvents.push(event)
					continue
				}

				// Skip if max retries exceeded
				if (event.retryCount >= TelemetryQueue.MAX_RETRY_COUNT) {
					// Silently drop events that have exceeded max retries
					continue
				}

				try {
					// Attempt to send the event
					const success = await this.retryCallback(event)

					if (!success) {
						// Update retry metadata
						event.retryCount++
						event.lastAttempt = now
						// Calculate next attempt with exponential backoff
						const backoffMs = Math.min(1000 * Math.pow(2, event.retryCount), 300000) // Max 5 minutes
						event.nextAttempt = now + backoffMs
						remainingEvents.push(event)
						allSuccessful = false
					}
					// If successful, don't add back to remainingEvents (effectively removing it)
				} catch (_error) {
					// Treat errors as failures - silently retry
					event.retryCount++
					event.lastAttempt = now
					const backoffMs = Math.min(1000 * Math.pow(2, event.retryCount), 300000)
					event.nextAttempt = now + backoffMs
					remainingEvents.push(event)
					allSuccessful = false
				}
			}

			// Update the queue with remaining events
			this.events = remainingEvents
			await this.saveQueue()

			// Schedule next attempt based on result
			this.scheduleNextAttempt(allSuccessful)

			return allSuccessful
		} finally {
			this.isProcessing = false
		}
	}

	/**
	 * Gracefully shuts down the queue, attempting to flush pending events
	 * @param timeoutMs Maximum time to wait for queue processing
	 */
	public async shutdown(timeoutMs: number = 5000): Promise<void> {
		// Stop the timer
		this.stop()

		// Try to process remaining events with timeout
		const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
		const processPromise = this.processQueue()

		await Promise.race([processPromise, timeoutPromise])

		// Save any remaining events
		await this.saveQueue()
	}

	/**
	 * Gets the current size of the queue
	 * @returns Number of events in the queue
	 */
	public getQueueSize(): number {
		return this.events.length
	}

	/**
	 * Clears all events from the queue
	 */
	public async clearQueue(): Promise<void> {
		this.events = []
		await this.saveQueue()
	}

	/**
	 * Loads the queue from persistent storage
	 */
	private async loadQueue(): Promise<void> {
		try {
			const stored = this.context.globalState.get<QueuedTelemetryEvent[]>(TelemetryQueue.STORAGE_KEY)
			if (stored && Array.isArray(stored)) {
				this.events = stored
			}
		} catch (_error) {
			// If loading fails, start with empty queue
			this.events = []
		}
	}

	/**
	 * Saves the queue to persistent storage
	 */
	private async saveQueue(): Promise<void> {
		try {
			await this.context.globalState.update(TelemetryQueue.STORAGE_KEY, this.events)
		} catch (_error) {
			// Silently fail - queue will be lost but telemetry shouldn't break the app
		}
	}

	/**
	 * Schedules the next attempt based on the success/failure of the current attempt
	 * @param wasSuccessful Whether the current attempt was successful
	 */
	private scheduleNextAttempt(wasSuccessful: boolean): void {
		if (!this.isRunning) {
			return
		}

		if (wasSuccessful) {
			// Reset backoff on success
			this.currentBackoffMs = TelemetryQueue.INITIAL_BACKOFF_MS
			this.attemptCount = 0

			this.timerId = setTimeout(() => this.executeCallback(), TelemetryQueue.SUCCESS_INTERVAL)
		} else {
			// Increment attempt count
			this.attemptCount++

			// Calculate backoff time with exponential increase
			this.currentBackoffMs = Math.min(
				TelemetryQueue.INITIAL_BACKOFF_MS * Math.pow(2, this.attemptCount - 1),
				TelemetryQueue.MAX_BACKOFF_MS,
			)

			this.timerId = setTimeout(() => this.executeCallback(), this.currentBackoffMs)
		}
	}

	/**
	 * Executes the callback and handles the result
	 */
	private async executeCallback(): Promise<void> {
		if (!this.isRunning) {
			return
		}

		await this.processQueue()
	}

	/**
	 * Starts the queue processing timer
	 */
	public start(): void {
		if (this.isRunning) {
			return
		}

		this.isRunning = true

		// Execute the callback immediately
		this.executeCallback()
	}

	/**
	 * Stops the queue processing timer
	 */
	public stop(): void {
		if (!this.isRunning) {
			return
		}

		if (this.timerId) {
			clearTimeout(this.timerId)
			this.timerId = null
		}

		this.isRunning = false
	}
}
