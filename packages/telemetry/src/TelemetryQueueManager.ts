import * as fs from "fs/promises"
import * as path from "path"
import { TelemetryEvent } from "@roo-code/types"

interface QueuedEvent {
	event: TelemetryEvent
	timestamp: number
	retryCount: number
	clientId: string
}

interface QueueState {
	events: QueuedEvent[]
	version: number
}

/**
 * TelemetryQueueManager handles queuing and retry logic for telemetry events.
 * It persists failed events to disk and retries them with exponential backoff.
 */
export class TelemetryQueueManager {
	private static instance: TelemetryQueueManager | null = null
	private queue: QueuedEvent[] = []
	private isProcessing = false
	private persistPath: string
	private maxRetries = 5
	private baseRetryDelay = 1000 // 1 second
	private maxQueueSize = 100 // Reduced to keep file size small
	private flushInterval: NodeJS.Timeout | null = null
	private cleanupInterval: NodeJS.Timeout | null = null
	private readonly QUEUE_VERSION = 1
	private readonly MAX_EVENT_AGE = 24 * 60 * 60 * 1000 // 24 hours instead of 7 days
	private debug = false
	private persistPromise: Promise<void> | null = null
	private pendingPersist = false

	private constructor(storagePath: string, debug = false) {
		this.debug = debug || process.env.DEBUG_TELEMETRY === "true"
		this.persistPath = path.join(storagePath, "telemetry-queue.json")
		this.loadQueue()
		this.startPeriodicFlush()
		this.startPeriodicCleanup()
	}

	/**
	 * Get or create the singleton instance
	 */
	public static getInstance(storagePath: string, debug = false): TelemetryQueueManager {
		if (!this.instance) {
			this.instance = new TelemetryQueueManager(storagePath, debug)
		}
		return this.instance
	}

	/**
	 * Reset the singleton instance (for testing)
	 */
	public static resetInstance(): void {
		if (this.instance) {
			this.instance.shutdown()
			this.instance = null
		}
	}

	/**
	 * Add an event to the queue
	 */
	public enqueue(event: TelemetryEvent, clientId: string): void {
		// Don't queue if we've reached the maximum size
		if (this.queue.length >= this.maxQueueSize) {
			// Remove oldest events to make room (FIFO)
			this.queue.shift()
		}

		const queuedEvent: QueuedEvent = {
			event,
			timestamp: Date.now(),
			retryCount: 0,
			clientId,
		}

		this.queue.push(queuedEvent)
		this.schedulePersist()
	}

	/**
	 * Process queued events for a specific client
	 */
	public async processQueue(clientId: string, sendFunction: (event: TelemetryEvent) => Promise<void>): Promise<void> {
		if (this.isProcessing) {
			return
		}

		this.isProcessing = true

		try {
			const clientEvents = this.queue.filter((e) => e.clientId === clientId)

			for (const queuedEvent of clientEvents) {
				try {
					await sendFunction(queuedEvent.event)
					// Remove successfully sent event
					this.removeEvent(queuedEvent)
				} catch (_error) {
					// Increment retry count
					queuedEvent.retryCount++
					// Don't remove based on retry count - let it keep trying until 24 hours
				}
			}

			await this.persistQueue()
		} finally {
			this.isProcessing = false
		}
	}

	/**
	 * Get the retry delay for an event based on retry count (exponential backoff)
	 */
	public getRetryDelay(retryCount: number): number {
		return Math.min(
			this.baseRetryDelay * Math.pow(2, retryCount),
			60000, // Max 1 minute
		)
	}

	/**
	 * Check if an event should be retried based on its timestamp and retry count
	 */
	public shouldRetry(queuedEvent: QueuedEvent): boolean {
		const now = Date.now()
		const retryDelay = this.getRetryDelay(queuedEvent.retryCount)
		return now - queuedEvent.timestamp >= retryDelay
	}

	/**
	 * Get events ready for retry for a specific client
	 */
	public getEventsForRetry(clientId: string): QueuedEvent[] {
		return this.queue.filter((e) => e.clientId === clientId && this.shouldRetry(e))
	}

	/**
	 * Remove an event from the queue
	 */
	private removeEvent(event: QueuedEvent): void {
		const index = this.queue.indexOf(event)
		if (index > -1) {
			this.queue.splice(index, 1)
		}
	}

	/**
	 * Load queue from disk
	 */
	private async loadQueue(): Promise<void> {
		try {
			const data = await fs.readFile(this.persistPath, "utf-8")
			const state: QueueState = JSON.parse(data)

			// Check version compatibility
			if (state.version === this.QUEUE_VERSION) {
				// Filter out old events on load
				const cutoffTime = Date.now() - this.MAX_EVENT_AGE
				const originalCount = state.events.length
				this.queue = state.events.filter((e) => e.timestamp > cutoffTime)

				// If we filtered out any events, persist the cleaned queue
				if (this.queue.length < originalCount) {
					this.schedulePersist()
				}
			}
		} catch (_error) {
			// File doesn't exist or is corrupted, start with empty queue
			this.queue = []
		}
	}

	/**
	 * Schedule a persist operation with debouncing to avoid race conditions
	 */
	private schedulePersist(): void {
		if (this.pendingPersist) {
			// A persist is already scheduled
			return
		}

		this.pendingPersist = true

		// Use setImmediate to batch multiple rapid enqueue operations
		setImmediate(() => {
			this.persistQueue()
		})
	}

	/**
	 * Persist queue to disk
	 */
	private async persistQueue(): Promise<void> {
		// If a persist is already in progress, wait for it to complete first
		if (this.persistPromise) {
			await this.persistPromise
		}

		// Drain all pending persist requests in a loop
		// This ensures that any enqueue that happens during a persist operation
		// will trigger another persist pass immediately after
		while (this.pendingPersist) {
			this.pendingPersist = false

			this.persistPromise = this.doPersist()
			try {
				await this.persistPromise
			} finally {
				this.persistPromise = null
			}
			// If enqueue() ran during doPersist, pendingPersist will be true again
		}
	}

	/**
	 * Actually perform the persist operation
	 */
	private async doPersist(): Promise<void> {
		try {
			const state: QueueState = {
				events: this.queue,
				version: this.QUEUE_VERSION,
			}

			// Ensure directory exists
			const dir = path.dirname(this.persistPath)
			await fs.mkdir(dir, { recursive: true })

			// Write atomically using a temp file
			const tempPath = `${this.persistPath}.tmp`
			await fs.writeFile(tempPath, JSON.stringify(state, null, 2))
			await fs.rename(tempPath, this.persistPath)
		} catch (error) {
			// Log error but don't throw - telemetry should not break the app
			console.error("[TelemetryQueue] Failed to persist telemetry queue:", error)
		}
	}

	/**
	 * Start periodic flush of old events
	 */
	private startPeriodicFlush(): void {
		// Flush old events every hour
		this.flushInterval = setInterval(
			() => {
				this.flushOldEvents()
			},
			60 * 60 * 1000,
		)
	}

	/**
	 * Start more aggressive periodic cleanup
	 */
	private startPeriodicCleanup(): void {
		// Run cleanup every 5 minutes to keep file size small
		this.cleanupInterval = setInterval(
			() => {
				this.performAggressiveCleanup()
			},
			5 * 60 * 1000,
		)
	}

	/**
	 * Perform aggressive cleanup to keep queue file small
	 */
	private performAggressiveCleanup(): void {
		const originalSize = this.queue.length

		// Remove old events
		const cutoffTime = Date.now() - this.MAX_EVENT_AGE
		this.queue = this.queue.filter((e) => e.timestamp > cutoffTime)

		// No longer removing events based on retry count - they'll expire after 24 hours

		// If queue is still too large, remove oldest events
		if (this.queue.length > this.maxQueueSize) {
			// Sort by timestamp and keep only the newest events
			this.queue.sort((a, b) => b.timestamp - a.timestamp)
			this.queue = this.queue.slice(0, this.maxQueueSize)
		}

		// Persist if we made changes
		if (this.queue.length !== originalSize) {
			this.schedulePersist()
		}
	}

	/**
	 * Remove events older than MAX_EVENT_AGE
	 */
	private flushOldEvents(): void {
		const cutoffTime = Date.now() - this.MAX_EVENT_AGE
		const originalLength = this.queue.length
		this.queue = this.queue.filter((e) => e.timestamp > cutoffTime)

		if (this.queue.length < originalLength) {
			this.schedulePersist()
		}
	}

	/**
	 * Get queue statistics
	 */
	public getStats(): {
		queueSize: number
		oldestEventAge: number | null
		eventsByClient: Record<string, number>
	} {
		const now = Date.now()
		const oldestEvent = this.queue.length > 0 ? Math.min(...this.queue.map((e) => e.timestamp)) : null

		const eventsByClient: Record<string, number> = {}
		for (const event of this.queue) {
			eventsByClient[event.clientId] = (eventsByClient[event.clientId] || 0) + 1
		}

		return {
			queueSize: this.queue.length,
			oldestEventAge: oldestEvent ? now - oldestEvent : null,
			eventsByClient,
		}
	}

	/**
	 * Clear all queued events
	 */
	public async clearQueue(): Promise<void> {
		this.queue = []
		await this.persistQueue()
	}

	/**
	 * Shutdown the queue manager
	 */
	public async shutdown(): Promise<void> {
		if (this.flushInterval) {
			clearInterval(this.flushInterval)
			this.flushInterval = null
		}
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = null
		}

		// Do a final aggressive cleanup before shutdown
		this.performAggressiveCleanup()
		await this.persistQueue()
	}
}
