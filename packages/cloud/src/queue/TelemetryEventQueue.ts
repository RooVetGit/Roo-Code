import { TelemetryEvent } from "@roo-code/types"
import { QueueStorage, QueueProcessor, QueuedTelemetryEvent, QueueStatus, QueueOptionsWithMultiInstance } from "./types"
import { GlobalStateQueueStorage } from "./GlobalStateQueueStorage"

/**
 * Main telemetry event queue implementation
 * Manages FIFO queue processing with retry logic and multi-instance coordination
 */
export class TelemetryEventQueue {
	private isProcessing = false
	private processingPromise?: Promise<number>
	private readonly options: Required<QueueOptionsWithMultiInstance>
	private lockReleaseTimer?: NodeJS.Timeout

	constructor(
		private storage: QueueStorage,
		private processor: QueueProcessor,
		options: QueueOptionsWithMultiInstance = {},
	) {
		this.options = {
			maxRetries: 3,
			processOnEnqueue: true,
			maxStorageSize: 1048576, // 1MB
			multiInstance: {
				enabled: true,
				lockDurationMs: 30000,
				lockCheckIntervalMs: 5000,
				lockAcquireTimeoutMs: 10000,
				mode: "compete",
				...options.multiInstance,
			},
			...options,
		}
	}

	/**
	 * Add an event to the queue and optionally trigger processing
	 */
	async enqueue(event: TelemetryEvent): Promise<void> {
		const queuedEvent: QueuedTelemetryEvent = {
			id: this.generateEventId(),
			timestamp: Date.now(),
			event,
			retryCount: 0,
		}

		try {
			await this.storage.add(queuedEvent)
		} catch (error) {
			// If storage fails due to size limit, log and continue
			console.error("[TelemetryEventQueue] Failed to enqueue event:", error)
			return
		}

		if (this.options.processOnEnqueue) {
			// Don't await, let it process in background
			this.triggerProcessing().catch((error) => {
				console.error("[TelemetryEventQueue] Background processing failed:", error)
			})
		}
	}

	/**
	 * Process all events in the queue
	 * Returns the number of successfully processed events
	 */
	async processQueue(): Promise<number> {
		// If already processing, return the existing promise
		if (this.processingPromise) {
			return this.processingPromise
		}

		// Create a new processing promise
		this.processingPromise = this.doProcessQueue().finally(() => {
			this.processingPromise = undefined
		})

		return this.processingPromise
	}

	/**
	 * Internal method to process the queue
	 */
	private async doProcessQueue(): Promise<number> {
		if (this.isProcessing) {
			return 0
		}

		// Check if multi-instance coordination is enabled
		const isMultiInstanceEnabled =
			this.options.multiInstance?.enabled && this.options.multiInstance?.mode !== "disabled"

		// Try to acquire lock if multi-instance is enabled
		let hasLock = false
		if (isMultiInstanceEnabled && this.storage instanceof GlobalStateQueueStorage) {
			hasLock = await this.storage.acquireLock()
			if (!hasLock) {
				console.debug("[TelemetryEventQueue] Could not acquire lock, another instance may be processing")
				return 0
			}

			// Set up periodic lock renewal
			this.startLockRenewal()
		} else {
			hasLock = true // No locking needed
		}

		this.isProcessing = true
		let processedCount = 0

		try {
			// Check if processor is ready
			if (!(await this.processor.isReady())) {
				console.debug("[TelemetryEventQueue] Processor not ready, skipping queue processing")
				return 0
			}

			const events = await this.storage.getAll()

			for (const event of events) {
				// Check if we still hold the lock (for multi-instance)
				if (isMultiInstanceEnabled && this.storage instanceof GlobalStateQueueStorage) {
					if (!(await this.storage.holdsLock())) {
						console.warn("[TelemetryEventQueue] Lost lock during processing, stopping")
						break
					}
				}

				// Skip events that have exceeded retry limit
				if (event.retryCount >= this.options.maxRetries) {
					console.warn(
						`[TelemetryEventQueue] Event ${event.id} exceeded retry limit (${event.retryCount}/${this.options.maxRetries}), removing`,
					)
					await this.storage.remove(event.id)
					continue
				}

				const success = await this.processor.process(event)

				if (success) {
					await this.storage.remove(event.id)
					processedCount++
				} else {
					// Update retry count and timestamp
					event.retryCount++
					event.lastAttemptTimestamp = Date.now()
					await this.storage.update(event)

					// Stop processing on failure (no automatic retry)
					console.debug(
						`[TelemetryEventQueue] Event ${event.id} failed (attempt ${event.retryCount}), stopping queue processing`,
					)
					break
				}
			}

			if (processedCount > 0) {
				console.info(`[TelemetryEventQueue] Successfully processed ${processedCount} events`)
			}
		} catch (error) {
			console.error("[TelemetryEventQueue] Queue processing error:", error)
		} finally {
			this.isProcessing = false
			this.stopLockRenewal()

			// Release lock if we acquired it
			if (hasLock && isMultiInstanceEnabled && this.storage instanceof GlobalStateQueueStorage) {
				await this.storage.releaseLock()
			}
		}

		return processedCount
	}

	/**
	 * Start periodic lock renewal to prevent lock expiration during processing
	 */
	private startLockRenewal(): void {
		if (this.lockReleaseTimer) {
			clearInterval(this.lockReleaseTimer)
		}

		const renewalInterval = Math.max((this.options.multiInstance?.lockDurationMs || 30000) / 3, 5000)

		this.lockReleaseTimer = setInterval(async () => {
			if (this.storage instanceof GlobalStateQueueStorage) {
				const hasLock = await this.storage.holdsLock()
				if (hasLock) {
					// Renew lock by re-acquiring it
					await this.storage.acquireLock()
				} else {
					// Lost lock, stop renewal
					this.stopLockRenewal()
				}
			}
		}, renewalInterval)
	}

	/**
	 * Stop lock renewal timer
	 */
	private stopLockRenewal(): void {
		if (this.lockReleaseTimer) {
			clearInterval(this.lockReleaseTimer)
			this.lockReleaseTimer = undefined
		}
	}

	/**
	 * Get the current status of the queue
	 */
	async getStatus(): Promise<QueueStatus> {
		const events = await this.storage.getAll()
		const sizeInBytes = await this.storage.getSize()

		const failedEventCount = events.filter((e) => e.retryCount > 0).length
		const oldestEvent = events.length > 0 ? events[0] : undefined

		const status: QueueStatus = {
			count: events.length,
			sizeInBytes,
			isProcessing: this.isProcessing,
			oldestEventTimestamp: oldestEvent?.timestamp,
			failedEventCount,
		}

		// Add lock information if available
		if (this.storage instanceof GlobalStateQueueStorage) {
			const lockStats = await this.storage.getLockStats()
			const instanceInfo = this.storage.getInstanceInfo()

			// Add extended status info
			;(
				status as QueueStatus & {
					lockInfo?: {
						hasLock: boolean
						lockHolder?: string
						lockAge?: number
						isExpired?: boolean
						currentInstance: string
						multiInstanceMode: string
					}
				}
			).lockInfo = {
				...lockStats,
				currentInstance: instanceInfo.instanceId,
				multiInstanceMode: this.options.multiInstance?.mode || "disabled",
			}
		}

		return status
	}

	/**
	 * Clear all events from the queue
	 */
	async clear(): Promise<void> {
		await this.storage.clear()
	}

	/**
	 * Check if the queue is currently processing
	 */
	isCurrentlyProcessing(): boolean {
		return this.isProcessing
	}

	/**
	 * Trigger queue processing
	 */
	private async triggerProcessing(): Promise<void> {
		await this.processQueue()
	}

	/**
	 * Generate a unique event ID
	 */
	private generateEventId(): string {
		const timestamp = Date.now()
		const random = Math.random().toString(36).substring(2, 9)
		return `evt_${timestamp}_${random}`
	}

	/**
	 * Cleanup resources when shutting down
	 */
	async shutdown(): Promise<void> {
		this.stopLockRenewal()

		// Release any held locks
		if (this.storage instanceof GlobalStateQueueStorage) {
			await this.storage.releaseLock()
		}
	}
}
