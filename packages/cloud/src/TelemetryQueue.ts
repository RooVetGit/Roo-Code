import * as vscode from "vscode"
import { randomUUID } from "crypto"
import type { RooCodeTelemetryEvent } from "@roo-code/types"

export interface QueuedTelemetryEvent {
	id: string
	event: RooCodeTelemetryEvent
	timestamp: number
	retryCount: number
}

export class TelemetryQueue {
	private static readonly QUEUE_KEY = "rooCode.telemetryQueue"
	private static readonly MAX_QUEUE_SIZE = 1000 // Prevent unbounded growth
	private static readonly MAX_RETRY_COUNT = 3 // Limit retries per event

	private context: vscode.ExtensionContext
	private isProcessing = false
	private debug: boolean

	constructor(context: vscode.ExtensionContext, debug = false) {
		this.context = context
		this.debug = debug
	}

	/**
	 * Adds a telemetry event to the queue
	 */
	public async enqueue(event: RooCodeTelemetryEvent): Promise<void> {
		const queue = await this.getQueue()

		// Prevent unbounded growth
		if (queue.length >= TelemetryQueue.MAX_QUEUE_SIZE) {
			if (this.debug) {
				console.warn(
					`[TelemetryQueue] Queue is full (${TelemetryQueue.MAX_QUEUE_SIZE} items), dropping oldest event`,
				)
			}
			queue.shift() // Remove oldest event
		}

		const queuedEvent: QueuedTelemetryEvent = {
			id: randomUUID(),
			event,
			timestamp: Date.now(),
			retryCount: 0,
		}

		queue.push(queuedEvent)
		await this.saveQueue(queue)

		if (this.debug) {
			console.info(
				`[TelemetryQueue] Enqueued event ${queuedEvent.id} (${event.type}), queue size: ${queue.length}`,
			)
		}
	}

	/**
	 * Retrieves the next event from the queue without removing it
	 */
	public async peek(): Promise<QueuedTelemetryEvent | null> {
		const queue = await this.getQueue()
		return queue.length > 0 ? queue[0] : null
	}

	/**
	 * Removes a successfully sent event from the queue
	 */
	public async dequeue(eventId: string): Promise<void> {
		const queue = await this.getQueue()
		const filteredQueue = queue.filter((e) => e.id !== eventId)

		if (queue.length !== filteredQueue.length) {
			await this.saveQueue(filteredQueue)
			if (this.debug) {
				console.info(`[TelemetryQueue] Dequeued event ${eventId}, queue size: ${filteredQueue.length}`)
			}
		}
	}

	/**
	 * Increments retry count for a failed event and moves it to the end of the queue
	 */
	public async markFailed(eventId: string): Promise<void> {
		const queue = await this.getQueue()
		const eventIndex = queue.findIndex((e) => e.id === eventId)

		if (eventIndex === -1) {
			return
		}

		const event = queue[eventIndex]
		event.retryCount++

		// Remove from current position
		queue.splice(eventIndex, 1)

		// If max retries not exceeded, add back to end of queue
		if (event.retryCount < TelemetryQueue.MAX_RETRY_COUNT) {
			queue.push(event)
			if (this.debug) {
				console.info(
					`[TelemetryQueue] Marked event ${eventId} as failed (retry ${event.retryCount}/${TelemetryQueue.MAX_RETRY_COUNT})`,
				)
			}
		} else {
			if (this.debug) {
				console.warn(`[TelemetryQueue] Event ${eventId} exceeded max retries, removing from queue`)
			}
		}

		await this.saveQueue(queue)
	}

	/**
	 * Gets the current queue size
	 */
	public async size(): Promise<number> {
		const queue = await this.getQueue()
		return queue.length
	}

	/**
	 * Checks if the queue is currently being processed
	 */
	public isProcessingQueue(): boolean {
		return this.isProcessing
	}

	/**
	 * Sets the processing state
	 */
	public setProcessingState(processing: boolean): void {
		this.isProcessing = processing
	}

	/**
	 * Clears all events from the queue
	 */
	public async clear(): Promise<void> {
		await this.saveQueue([])
		if (this.debug) {
			console.info("[TelemetryQueue] Queue cleared")
		}
	}

	/**
	 * Gets all queued events (for testing/debugging)
	 */
	public async getAll(): Promise<QueuedTelemetryEvent[]> {
		return await this.getQueue()
	}

	private async getQueue(): Promise<QueuedTelemetryEvent[]> {
		try {
			const queue = this.context.globalState.get<QueuedTelemetryEvent[]>(TelemetryQueue.QUEUE_KEY)
			// Validate that we got an array
			if (Array.isArray(queue)) {
				return queue
			}
			// If we got corrupted data, try to reset to empty array
			if (queue !== undefined) {
				console.warn("[TelemetryQueue] Corrupted queue data detected, resetting to empty array")
				try {
					await this.context.globalState.update(TelemetryQueue.QUEUE_KEY, [])
				} catch (updateError) {
					// If update fails, just log and continue with empty array
					console.error("[TelemetryQueue] Failed to reset corrupted queue:", updateError)
				}
			}
			return []
		} catch (error) {
			console.error("[TelemetryQueue] Failed to get queue:", error)
			return []
		}
	}

	private async saveQueue(queue: QueuedTelemetryEvent[]): Promise<void> {
		try {
			await this.context.globalState.update(TelemetryQueue.QUEUE_KEY, queue)
		} catch (error) {
			console.error("[TelemetryQueue] Failed to save queue:", error)
		}
	}
}
