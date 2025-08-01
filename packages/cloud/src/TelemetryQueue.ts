import * as vscode from "vscode"
import { TelemetryEvent } from "@roo-code/types"

interface QueuedEvent {
	event: TelemetryEvent
	timestamp: number
	retryCount: number
	lastRetryTimestamp?: number
}

interface QueueState {
	events: QueuedEvent[]
	connectionStatus: "online" | "offline"
	lastConnectionCheck: number
}

export class TelemetryQueue {
	private static readonly QUEUE_STATE_KEY = "telemetryQueueState"
	private static readonly MAX_QUEUE_SIZE = 1000
	private static readonly MAX_RETRY_COUNT = 5
	private static readonly BASE_RETRY_DELAY_MS = 1000 // 1 second
	private static readonly MAX_RETRY_DELAY_MS = 60000 // 1 minute
	private static readonly CONNECTION_CHECK_INTERVAL_MS = 30000 // 30 seconds
	private static readonly EVENT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

	private context: vscode.ExtensionContext
	private queueState: QueueState
	private processingQueue = false
	private connectionCheckTimer?: NodeJS.Timeout
	private retryTimer?: NodeJS.Timeout

	constructor(context: vscode.ExtensionContext) {
		this.context = context
		this.queueState = this.loadQueueState()
		this.startConnectionMonitoring()
	}

	/**
	 * Adds an event to the queue
	 */
	public async enqueue(event: TelemetryEvent): Promise<void> {
		const queuedEvent: QueuedEvent = {
			event,
			timestamp: Date.now(),
			retryCount: 0,
		}

		// Add to queue with size limit
		this.queueState.events.push(queuedEvent)

		// Remove oldest events if queue is too large
		if (this.queueState.events.length > TelemetryQueue.MAX_QUEUE_SIZE) {
			const eventsToRemove = this.queueState.events.length - TelemetryQueue.MAX_QUEUE_SIZE
			this.queueState.events.splice(0, eventsToRemove)
			console.warn(`[TelemetryQueue] Queue size exceeded limit, removed ${eventsToRemove} oldest events`)
		}

		await this.saveQueueState()
	}

	/**
	 * Processes the queue, attempting to send all queued events
	 */
	public async processQueue(sendFunction: (event: TelemetryEvent) => Promise<boolean>): Promise<void> {
		if (this.processingQueue || this.queueState.events.length === 0) {
			return
		}

		this.processingQueue = true

		try {
			const now = Date.now()
			const eventsToProcess = [...this.queueState.events]
			const successfulEvents: QueuedEvent[] = []
			const failedEvents: QueuedEvent[] = []

			for (const queuedEvent of eventsToProcess) {
				// Skip expired events
				if (now - queuedEvent.timestamp > TelemetryQueue.EVENT_EXPIRY_MS) {
					console.warn(`[TelemetryQueue] Dropping expired event: ${queuedEvent.event.event}`)
					continue
				}

				// Check if we should retry this event yet
				if (queuedEvent.lastRetryTimestamp) {
					const retryDelay = this.calculateRetryDelay(queuedEvent.retryCount)
					if (now - queuedEvent.lastRetryTimestamp < retryDelay) {
						failedEvents.push(queuedEvent)
						continue
					}
				}

				try {
					const success = await sendFunction(queuedEvent.event)
					if (success) {
						successfulEvents.push(queuedEvent)
					} else {
						queuedEvent.retryCount++
						queuedEvent.lastRetryTimestamp = now

						if (queuedEvent.retryCount >= TelemetryQueue.MAX_RETRY_COUNT) {
							console.error(`[TelemetryQueue] Max retries exceeded for event: ${queuedEvent.event.event}`)
						} else {
							failedEvents.push(queuedEvent)
						}
					}
				} catch (error) {
					console.error(`[TelemetryQueue] Error sending event: ${error}`)
					queuedEvent.retryCount++
					queuedEvent.lastRetryTimestamp = now

					if (queuedEvent.retryCount < TelemetryQueue.MAX_RETRY_COUNT) {
						failedEvents.push(queuedEvent)
					}
				}
			}

			// Update queue with only failed events
			this.queueState.events = failedEvents
			await this.saveQueueState()

			// Schedule next retry if there are failed events
			if (failedEvents.length > 0) {
				this.scheduleRetry()
			}

			console.log(
				`[TelemetryQueue] Processed ${eventsToProcess.length} events: ` +
					`${successfulEvents.length} successful, ${failedEvents.length} failed`,
			)
		} finally {
			this.processingQueue = false
		}
	}

	/**
	 * Updates the connection status
	 */
	public async updateConnectionStatus(isOnline: boolean): Promise<void> {
		const newStatus = isOnline ? "online" : "offline"
		if (this.queueState.connectionStatus !== newStatus) {
			this.queueState.connectionStatus = newStatus
			this.queueState.lastConnectionCheck = Date.now()
			await this.saveQueueState()

			// Emit event for UI updates
			vscode.commands.executeCommand("roo-code.telemetryConnectionStatusChanged", newStatus)
		}
	}

	/**
	 * Gets the current connection status
	 */
	public getConnectionStatus(): "online" | "offline" {
		return this.queueState.connectionStatus
	}

	/**
	 * Gets the number of queued events
	 */
	public getQueueSize(): number {
		return this.queueState.events.length
	}

	/**
	 * Clears the queue
	 */
	public async clearQueue(): Promise<void> {
		this.queueState.events = []
		await this.saveQueueState()
	}

	/**
	 * Disposes of the queue, cleaning up timers
	 */
	public dispose(): void {
		if (this.connectionCheckTimer) {
			clearInterval(this.connectionCheckTimer)
		}
		if (this.retryTimer) {
			clearTimeout(this.retryTimer)
		}
	}

	private loadQueueState(): QueueState {
		const savedState = this.context.globalState.get<QueueState>(TelemetryQueue.QUEUE_STATE_KEY)

		if (savedState) {
			// Clean up expired events on load
			const now = Date.now()
			savedState.events = savedState.events.filter(
				(event) => now - event.timestamp <= TelemetryQueue.EVENT_EXPIRY_MS,
			)
			return savedState
		}

		return {
			events: [],
			connectionStatus: "online",
			lastConnectionCheck: Date.now(),
		}
	}

	private async saveQueueState(): Promise<void> {
		try {
			await this.context.globalState.update(TelemetryQueue.QUEUE_STATE_KEY, this.queueState)
		} catch (error) {
			console.error(`[TelemetryQueue] Failed to save queue state: ${error}`)
			// Continue operation even if persistence fails
		}
	}

	private calculateRetryDelay(retryCount: number): number {
		// Exponential backoff with jitter
		const baseDelay = Math.min(
			TelemetryQueue.BASE_RETRY_DELAY_MS * Math.pow(2, retryCount),
			TelemetryQueue.MAX_RETRY_DELAY_MS,
		)
		// Add jitter (±25%)
		const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1)
		return Math.floor(baseDelay + jitter)
	}

	private scheduleRetry(): void {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer)
		}

		// Find the earliest retry time
		let earliestRetryTime = Infinity
		const now = Date.now()

		for (const event of this.queueState.events) {
			if (event.lastRetryTimestamp) {
				const retryDelay = this.calculateRetryDelay(event.retryCount)
				const nextRetryTime = event.lastRetryTimestamp + retryDelay
				if (nextRetryTime < earliestRetryTime) {
					earliestRetryTime = nextRetryTime
				}
			} else {
				// Event hasn't been retried yet, can retry immediately
				earliestRetryTime = now
				break
			}
		}

		if (earliestRetryTime !== Infinity) {
			const delay = Math.max(0, earliestRetryTime - now)
			this.retryTimer = setTimeout(() => {
				// Trigger queue processing through command
				vscode.commands.executeCommand("roo-code.processTelemetryQueue")
			}, delay)
		}
	}

	private startConnectionMonitoring(): void {
		// Check connection status periodically
		this.connectionCheckTimer = setInterval(() => {
			vscode.commands.executeCommand("roo-code.checkTelemetryConnection")
		}, TelemetryQueue.CONNECTION_CHECK_INTERVAL_MS)
	}
}
