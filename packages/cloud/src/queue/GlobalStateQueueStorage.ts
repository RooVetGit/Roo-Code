import * as vscode from "vscode"
import * as os from "os"
import { QueueStorage, QueuedTelemetryEvent, QueueLock, MultiInstanceConfig } from "./types"

/**
 * Implementation of QueueStorage using VS Code's globalState API
 * Enforces a 1MB storage limit for the queue
 * Supports multi-instance coordination with locking
 */
export class GlobalStateQueueStorage implements QueueStorage {
	private static readonly STORAGE_KEY = "rooCode.telemetryQueue"
	private static readonly LOCK_KEY = "rooCode.telemetryQueue.lock"
	private static readonly DEFAULT_MAX_STORAGE_SIZE = 1048576 // 1MB in bytes
	private static readonly DEFAULT_LOCK_DURATION_MS = 30000 // 30 seconds
	private static readonly DEFAULT_LOCK_CHECK_INTERVAL_MS = 5000 // 5 seconds
	private static readonly DEFAULT_LOCK_ACQUIRE_TIMEOUT_MS = 10000 // 10 seconds

	private readonly instanceId: string
	private readonly hostname: string
	private readonly multiInstanceConfig: Required<MultiInstanceConfig>

	constructor(
		private context: vscode.ExtensionContext,
		private maxStorageSize = GlobalStateQueueStorage.DEFAULT_MAX_STORAGE_SIZE,
		multiInstanceConfig?: MultiInstanceConfig,
	) {
		// Generate unique instance ID
		this.instanceId = this.generateInstanceId()
		this.hostname = os.hostname()

		// Set default multi-instance configuration
		this.multiInstanceConfig = {
			enabled: true,
			lockDurationMs: GlobalStateQueueStorage.DEFAULT_LOCK_DURATION_MS,
			lockCheckIntervalMs: GlobalStateQueueStorage.DEFAULT_LOCK_CHECK_INTERVAL_MS,
			lockAcquireTimeoutMs: GlobalStateQueueStorage.DEFAULT_LOCK_ACQUIRE_TIMEOUT_MS,
			mode: "compete",
			...multiInstanceConfig,
		}

		console.info(`[QueueStorage] Initialized with instance ID: ${this.instanceId}, hostname: ${this.hostname}`)
	}

	/**
	 * Generate a unique instance ID
	 */
	private generateInstanceId(): string {
		const timestamp = Date.now()
		const random = Math.random().toString(36).substring(2, 9)
		const pid = process.pid
		return `inst_${pid}_${timestamp}_${random}`
	}

	/**
	 * Acquire a lock for queue processing
	 */
	async acquireLock(): Promise<boolean> {
		if (!this.multiInstanceConfig.enabled || this.multiInstanceConfig.mode === "disabled") {
			return true
		}

		const startTime = Date.now()
		const timeout = this.multiInstanceConfig.lockAcquireTimeoutMs

		while (Date.now() - startTime < timeout) {
			try {
				const currentLock = await this.getLock()
				const now = Date.now()

				// Check if lock is expired or doesn't exist
				if (!currentLock || currentLock.expiresAt < now) {
					// Try to acquire the lock
					const newLock: QueueLock = {
						instanceId: this.instanceId,
						acquiredAt: now,
						expiresAt: now + this.multiInstanceConfig.lockDurationMs,
						hostname: this.hostname,
					}

					// Atomic compare-and-swap
					const success = await this.compareAndSwapLock(currentLock, newLock)
					if (success) {
						console.debug(`[QueueStorage] Lock acquired by instance ${this.instanceId}`)
						return true
					}
				}

				// Wait before retrying
				await this.sleep(100 + Math.random() * 100) // 100-200ms with jitter
			} catch (error) {
				console.error("[QueueStorage] Error acquiring lock:", error)
			}
		}

		console.warn(`[QueueStorage] Failed to acquire lock within ${timeout}ms`)
		return false
	}

	/**
	 * Release the lock held by this instance
	 */
	async releaseLock(): Promise<void> {
		if (!this.multiInstanceConfig.enabled || this.multiInstanceConfig.mode === "disabled") {
			return
		}

		try {
			const currentLock = await this.getLock()
			if (currentLock && currentLock.instanceId === this.instanceId) {
				await this.context.globalState.update(GlobalStateQueueStorage.LOCK_KEY, undefined)
				console.debug(`[QueueStorage] Lock released by instance ${this.instanceId}`)
			}
		} catch (error) {
			console.error("[QueueStorage] Error releasing lock:", error)
		}
	}

	/**
	 * Check if this instance holds the lock
	 */
	async holdsLock(): Promise<boolean> {
		if (!this.multiInstanceConfig.enabled || this.multiInstanceConfig.mode === "disabled") {
			return true
		}

		const lock = await this.getLock()
		return lock !== null && lock.instanceId === this.instanceId && lock.expiresAt > Date.now()
	}

	/**
	 * Get the current lock
	 */
	private async getLock(): Promise<QueueLock | null> {
		try {
			return this.context.globalState.get<QueueLock>(GlobalStateQueueStorage.LOCK_KEY) || null
		} catch (error) {
			console.error("[QueueStorage] Error reading lock:", error)
			return null
		}
	}

	/**
	 * Atomic compare-and-swap for lock
	 */
	private async compareAndSwapLock(expectedLock: QueueLock | null, newLock: QueueLock): Promise<boolean> {
		// VS Code's globalState doesn't provide true CAS, so we implement optimistic locking
		// with a small race window. In practice, this is acceptable for our use case.
		const currentLock = await this.getLock()

		// Check if lock state matches our expectation
		if (this.locksEqual(currentLock, expectedLock)) {
			await this.context.globalState.update(GlobalStateQueueStorage.LOCK_KEY, newLock)

			// Verify the write succeeded
			const verifyLock = await this.getLock()
			return this.locksEqual(verifyLock, newLock)
		}

		return false
	}

	/**
	 * Compare two locks for equality
	 */
	private locksEqual(lock1: QueueLock | null, lock2: QueueLock | null): boolean {
		if (lock1 === null && lock2 === null) return true
		if (lock1 === null || lock2 === null) return false
		return lock1.instanceId === lock2.instanceId && lock1.acquiredAt === lock2.acquiredAt
	}

	/**
	 * Sleep for the specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	async add(event: QueuedTelemetryEvent): Promise<void> {
		// Use atomic operation with retry
		await this.atomicOperation(async () => {
			const events = await this.getAll()
			events.push(event)

			// Check storage size before saving
			const sizeInBytes = this.calculateSize(events)
			if (sizeInBytes > this.maxStorageSize) {
				// Remove oldest events until we're under the limit
				let removedCount = 0
				while (events.length > 0 && this.calculateSize(events) > this.maxStorageSize) {
					events.shift() // Remove oldest event (FIFO)
					removedCount++
				}

				if (removedCount > 0) {
					console.warn(
						`[QueueStorage] Removed ${removedCount} oldest events to stay under ${
							this.maxStorageSize / 1024 / 1024
						}MB storage limit`,
					)
				}

				// If even the single new event is too large, throw an error
				if (events.length === 0) {
					throw new Error("Event too large to store in queue")
				}
			}

			await this.save(events)
		})
	}

	async remove(id: string): Promise<boolean> {
		return await this.atomicOperation(async () => {
			const events = await this.getAll()
			const initialLength = events.length
			const filtered = events.filter((e) => e.id !== id)

			if (filtered.length < initialLength) {
				await this.save(filtered)
				return true
			}

			return false
		})
	}

	async update(event: QueuedTelemetryEvent): Promise<boolean> {
		return await this.atomicOperation(async () => {
			const events = await this.getAll()
			const index = events.findIndex((e) => e.id === event.id)

			if (index !== -1) {
				events[index] = event

				// Check if update would exceed storage limit
				const sizeInBytes = this.calculateSize(events)
				if (sizeInBytes > this.maxStorageSize) {
					console.error("[QueueStorage] Update would exceed storage limit, rejecting update")
					return false
				}

				await this.save(events)
				return true
			}

			return false
		})
	}

	async getAll(): Promise<QueuedTelemetryEvent[]> {
		try {
			const data = this.context.globalState.get<QueuedTelemetryEvent[]>(GlobalStateQueueStorage.STORAGE_KEY)
			// Ensure events are sorted by timestamp (FIFO)
			return (data || []).sort((a, b) => a.timestamp - b.timestamp)
		} catch (error) {
			console.error("[QueueStorage] Failed to read queue:", error)
			return []
		}
	}

	async getCount(): Promise<number> {
		const events = await this.getAll()
		return events.length
	}

	async clear(): Promise<void> {
		await this.atomicOperation(async () => {
			await this.context.globalState.update(GlobalStateQueueStorage.STORAGE_KEY, [])
		})
	}

	async getSize(): Promise<number> {
		const events = await this.getAll()
		return this.calculateSize(events)
	}

	private calculateSize(events: QueuedTelemetryEvent[]): number {
		const jsonString = JSON.stringify(events)
		return new TextEncoder().encode(jsonString).length
	}

	private async save(events: QueuedTelemetryEvent[]): Promise<void> {
		try {
			await this.context.globalState.update(GlobalStateQueueStorage.STORAGE_KEY, events)
		} catch (error) {
			console.error("[QueueStorage] Failed to save queue:", error)
			throw new Error(`Failed to save telemetry queue: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Get storage statistics for monitoring
	 */
	async getStorageStats(): Promise<{
		sizeInBytes: number
		sizeInMB: number
		utilizationPercent: number
		eventCount: number
		oldestEventAge?: number
	}> {
		const events = await this.getAll()
		const sizeInBytes = this.calculateSize(events)
		const now = Date.now()
		const oldestEvent = events[0]

		return {
			sizeInBytes,
			sizeInMB: sizeInBytes / 1024 / 1024,
			utilizationPercent: (sizeInBytes / this.maxStorageSize) * 100,
			eventCount: events.length,
			oldestEventAge: oldestEvent ? now - oldestEvent.timestamp : undefined,
		}
	}

	/**
	 * Perform an atomic operation with retry logic
	 */
	private async atomicOperation<T>(operation: () => Promise<T>): Promise<T> {
		const maxRetries = 3
		const baseDelay = 100

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				return await operation()
			} catch (error) {
				if (attempt === maxRetries - 1) {
					throw error
				}

				// Exponential backoff with jitter
				const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100
				console.warn(
					`[QueueStorage] Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
				)
				await this.sleep(delay)
			}
		}

		throw new Error("Atomic operation failed after all retries")
	}

	/**
	 * Get lock statistics for monitoring
	 */
	async getLockStats(): Promise<{
		hasLock: boolean
		lockHolder?: string
		lockAge?: number
		isExpired?: boolean
	}> {
		const lock = await this.getLock()
		if (!lock) {
			return { hasLock: false }
		}

		const now = Date.now()
		return {
			hasLock: true,
			lockHolder: `${lock.instanceId} (${lock.hostname || "unknown"})`,
			lockAge: now - lock.acquiredAt,
			isExpired: lock.expiresAt < now,
		}
	}

	/**
	 * Get instance information
	 */
	getInstanceInfo(): { instanceId: string; hostname: string } {
		return {
			instanceId: this.instanceId,
			hostname: this.hostname,
		}
	}
}
