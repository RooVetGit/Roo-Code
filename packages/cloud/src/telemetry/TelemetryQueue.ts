import * as vscode from "vscode"
import { TelemetryEvent } from "@roo-code/types"

export interface QueuedTelemetryEvent {
	id: string
	event: TelemetryEvent
	timestamp: number
	retryCount: number
	lastRetryTimestamp?: number
	error?: string
}

export interface TelemetryQueueConfig {
	maxQueueSize: number
	maxRetries: number
	queueSizeWarningThreshold: number
}

const DEFAULT_CONFIG: TelemetryQueueConfig = {
	maxQueueSize: 1000,
	maxRetries: 5,
	queueSizeWarningThreshold: 100,
}

/**
 * TelemetryQueue manages failed telemetry events with persistent storage
 * using VSCode's globalState API. It provides queue management, size limits,
 * and methods for adding, retrieving, and removing events.
 */
export class TelemetryQueue {
	private static readonly QUEUE_KEY = "telemetryQueue"
	private static readonly QUEUE_METADATA_KEY = "telemetryQueueMetadata"

	constructor(
		private context: vscode.ExtensionContext,
		private config: TelemetryQueueConfig = DEFAULT_CONFIG,
	) {}

	/**
	 * Adds a failed telemetry event to the queue
	 */
	async enqueue(event: TelemetryEvent, error?: string): Promise<void> {
		const queue = await this.getQueue()

		// Check if we've reached the max queue size
		if (queue.length >= this.config.maxQueueSize) {
			// Remove the oldest event to make room
			queue.shift()
		}

		const queuedEvent: QueuedTelemetryEvent = {
			id: this.generateId(),
			event,
			timestamp: Date.now(),
			retryCount: 0,
			error,
		}

		queue.push(queuedEvent)
		await this.saveQueue(queue)
		await this.updateMetadata(queue)
	}

	/**
	 * Retrieves events that are ready for retry based on exponential backoff
	 */
	async getEventsForRetry(): Promise<QueuedTelemetryEvent[]> {
		const queue = await this.getQueue()
		const now = Date.now()

		return queue.filter((item) => {
			// Skip if max retries reached
			if (item.retryCount >= this.config.maxRetries) {
				return false
			}

			// First retry - immediate
			if (!item.lastRetryTimestamp) {
				return true
			}

			// Calculate exponential backoff: 2^retryCount seconds
			const backoffMs = Math.pow(2, item.retryCount) * 1000
			const nextRetryTime = item.lastRetryTimestamp + backoffMs

			return now >= nextRetryTime
		})
	}

	/**
	 * Updates an event after a retry attempt
	 */
	async updateEventAfterRetry(id: string, success: boolean, error?: string): Promise<void> {
		const queue = await this.getQueue()
		const index = queue.findIndex((item) => item.id === id)

		if (index === -1) {
			return
		}

		if (success) {
			// Remove successful event from queue
			queue.splice(index, 1)
		} else {
			// Update retry information
			queue[index].retryCount++
			queue[index].lastRetryTimestamp = Date.now()
			queue[index].error = error
		}

		await this.saveQueue(queue)
		await this.updateMetadata(queue)
	}

	/**
	 * Gets the current queue size
	 */
	async getQueueSize(): Promise<number> {
		const queue = await this.getQueue()
		return queue.length
	}

	/**
	 * Gets queue metadata including size and oldest event timestamp
	 */
	async getQueueMetadata(): Promise<{
		size: number
		oldestEventTimestamp?: number
		newestEventTimestamp?: number
		isAboveWarningThreshold: boolean
	}> {
		const queue = await this.getQueue()
		const size = queue.length

		return {
			size,
			oldestEventTimestamp: queue[0]?.timestamp,
			newestEventTimestamp: queue[queue.length - 1]?.timestamp,
			isAboveWarningThreshold: size >= this.config.queueSizeWarningThreshold,
		}
	}

	/**
	 * Clears all events from the queue
	 */
	async clear(): Promise<void> {
		await this.saveQueue([])
		await this.context.globalState.update(TelemetryQueue.QUEUE_METADATA_KEY, undefined)
	}

	/**
	 * Removes events that have exceeded max retries
	 */
	async pruneFailedEvents(): Promise<number> {
		const queue = await this.getQueue()
		const originalSize = queue.length

		const prunedQueue = queue.filter((item) => item.retryCount < this.config.maxRetries)

		if (prunedQueue.length !== originalSize) {
			await this.saveQueue(prunedQueue)
			await this.updateMetadata(prunedQueue)
		}

		return originalSize - prunedQueue.length
	}

	/**
	 * Gets all events in the queue (for debugging/monitoring)
	 */
	async getAllEvents(): Promise<QueuedTelemetryEvent[]> {
		return this.getQueue()
	}

	private async getQueue(): Promise<QueuedTelemetryEvent[]> {
		return (await this.context.globalState.get<QueuedTelemetryEvent[]>(TelemetryQueue.QUEUE_KEY)) || []
	}

	private async saveQueue(queue: QueuedTelemetryEvent[]): Promise<void> {
		await this.context.globalState.update(TelemetryQueue.QUEUE_KEY, queue)
	}

	private async updateMetadata(queue: QueuedTelemetryEvent[]): Promise<void> {
		const metadata = {
			size: queue.length,
			lastUpdated: Date.now(),
		}
		await this.context.globalState.update(TelemetryQueue.QUEUE_METADATA_KEY, metadata)
	}

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
	}
}
