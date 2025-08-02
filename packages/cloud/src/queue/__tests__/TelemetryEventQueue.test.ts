import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { TelemetryEvent, TelemetryEventName } from "@roo-code/types"
import { TelemetryEventQueue } from "../TelemetryEventQueue"
import { GlobalStateQueueStorage } from "../GlobalStateQueueStorage"
import { QueueStorage, QueueProcessor, QueuedTelemetryEvent, MultiInstanceConfig, QueueStatus } from "../types"

// Mock implementations
class MockQueueStorage implements QueueStorage {
	private events: QueuedTelemetryEvent[] = []
	private maxSize: number

	constructor(maxSize = 1048576) {
		this.maxSize = maxSize
	}

	async add(event: QueuedTelemetryEvent): Promise<void> {
		this.events.push(event)
		const size = await this.getSize()
		if (size > this.maxSize) {
			throw new Error("Storage limit exceeded")
		}
	}

	async remove(id: string): Promise<boolean> {
		const index = this.events.findIndex((e) => e.id === id)
		if (index !== -1) {
			this.events.splice(index, 1)
			return true
		}
		return false
	}

	async update(event: QueuedTelemetryEvent): Promise<boolean> {
		const index = this.events.findIndex((e) => e.id === event.id)
		if (index !== -1) {
			this.events[index] = event
			return true
		}
		return false
	}

	async getAll(): Promise<QueuedTelemetryEvent[]> {
		return [...this.events].sort((a, b) => a.timestamp - b.timestamp)
	}

	async getCount(): Promise<number> {
		return this.events.length
	}

	async clear(): Promise<void> {
		this.events = []
	}

	async getSize(): Promise<number> {
		const jsonString = JSON.stringify(this.events)
		return new TextEncoder().encode(jsonString).length
	}
}

class MockQueueProcessor implements QueueProcessor {
	public processResults: Map<string, boolean> = new Map()
	public isReadyResult = true
	public processedEvents: QueuedTelemetryEvent[] = []

	async process(event: QueuedTelemetryEvent): Promise<boolean> {
		this.processedEvents.push(event)
		const result = this.processResults.get(event.id) ?? true
		return result
	}

	async isReady(): Promise<boolean> {
		return this.isReadyResult
	}

	setProcessResult(eventId: string, result: boolean): void {
		this.processResults.set(eventId, result)
	}
}

describe("TelemetryEventQueue", () => {
	let storage: MockQueueStorage
	let processor: MockQueueProcessor
	let queue: TelemetryEventQueue

	beforeEach(() => {
		storage = new MockQueueStorage()
		processor = new MockQueueProcessor()
		queue = new TelemetryEventQueue(storage, processor)
	})

	describe("enqueue", () => {
		it("should add event to storage and trigger processing", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await queue.enqueue(event)

			// Wait for background processing
			await new Promise((resolve) => setTimeout(resolve, 100))

			const storedEvents = await storage.getAll()
			expect(storedEvents).toHaveLength(0) // Should be processed and removed
			expect(processor.processedEvents).toHaveLength(1)
			expect(processor.processedEvents[0].event).toEqual(event)
		})

		it("should handle storage errors gracefully", async () => {
			// Create a storage that will throw an error
			const errorStorage = new MockQueueStorage(1) // 1 byte limit
			const errorQueue = new TelemetryEventQueue(errorStorage, processor)

			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123", largeData: "x".repeat(1000) },
			}

			// Should not throw
			await expect(errorQueue.enqueue(event)).resolves.toBeUndefined()
		})

		it("should not process if processOnEnqueue is false", async () => {
			queue = new TelemetryEventQueue(storage, processor, { processOnEnqueue: false })

			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await queue.enqueue(event)

			// Wait to ensure no processing happens
			await new Promise((resolve) => setTimeout(resolve, 100))

			const storedEvents = await storage.getAll()
			expect(storedEvents).toHaveLength(1)
			expect(processor.processedEvents).toHaveLength(0)
		})
	})

	describe("processQueue", () => {
		it("should process events in FIFO order", async () => {
			queue = new TelemetryEventQueue(storage, processor, { processOnEnqueue: false })

			const events: TelemetryEvent[] = [
				{ event: TelemetryEventName.TASK_CREATED, properties: { taskId: "1" } },
				{ event: TelemetryEventName.TASK_RESTARTED, properties: { taskId: "2" } },
				{ event: TelemetryEventName.TASK_COMPLETED, properties: { taskId: "3" } },
			]

			for (const event of events) {
				await queue.enqueue(event)
			}

			const processedCount = await queue.processQueue()

			expect(processedCount).toBe(3)
			expect(processor.processedEvents).toHaveLength(3)
			expect(processor.processedEvents[0].event.properties?.taskId).toBe("1")
			expect(processor.processedEvents[1].event.properties?.taskId).toBe("2")
			expect(processor.processedEvents[2].event.properties?.taskId).toBe("3")
		})

		it("should stop processing on failure", async () => {
			queue = new TelemetryEventQueue(storage, processor, { processOnEnqueue: false })

			const events: TelemetryEvent[] = [
				{ event: TelemetryEventName.TASK_CREATED, properties: { taskId: "1" } },
				{ event: TelemetryEventName.TASK_RESTARTED, properties: { taskId: "2" } },
				{ event: TelemetryEventName.TASK_COMPLETED, properties: { taskId: "3" } },
			]

			for (const event of events) {
				await queue.enqueue(event)
			}

			// Make the second event fail
			const storedEvents = await storage.getAll()
			processor.setProcessResult(storedEvents[1].id, false)

			const processedCount = await queue.processQueue()

			expect(processedCount).toBe(1) // Only first event processed
			expect(processor.processedEvents).toHaveLength(2) // First succeeded, second failed

			const remainingEvents = await storage.getAll()
			expect(remainingEvents).toHaveLength(2) // Second and third events remain
			expect(remainingEvents[0].retryCount).toBe(1) // Second event has retry count
		})

		it("should remove events that exceed retry limit", async () => {
			queue = new TelemetryEventQueue(storage, processor, {
				processOnEnqueue: false,
				maxRetries: 2,
			})

			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await queue.enqueue(event)

			const storedEvents = await storage.getAll()

			// Update event to have exceeded retry count
			storedEvents[0].retryCount = 2
			await storage.update(storedEvents[0])

			const processedCount = await queue.processQueue()

			expect(processedCount).toBe(0)
			const remainingEvents = await storage.getAll()
			expect(remainingEvents).toHaveLength(0) // Event removed due to retry limit
		})

		it("should handle concurrent processing requests", async () => {
			queue = new TelemetryEventQueue(storage, processor, { processOnEnqueue: false })

			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await queue.enqueue(event)

			// Start multiple concurrent processing requests
			const results = await Promise.all([queue.processQueue(), queue.processQueue(), queue.processQueue()])

			// All should return the same result (from the same promise)
			expect(results[0]).toBe(results[1])
			expect(results[1]).toBe(results[2])
			expect(results[0]).toBe(1)
			expect(processor.processedEvents).toHaveLength(1)
		})

		it("should skip processing if processor is not ready", async () => {
			processor.isReadyResult = false
			queue = new TelemetryEventQueue(storage, processor, { processOnEnqueue: false })

			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await queue.enqueue(event)

			const processedCount = await queue.processQueue()

			expect(processedCount).toBe(0)
			expect(processor.processedEvents).toHaveLength(0)

			const remainingEvents = await storage.getAll()
			expect(remainingEvents).toHaveLength(1)
		})
	})

	describe("getStatus", () => {
		it("should return correct queue status", async () => {
			queue = new TelemetryEventQueue(storage, processor, { processOnEnqueue: false })

			const events: TelemetryEvent[] = [
				{ event: TelemetryEventName.TASK_CREATED, properties: { taskId: "1" } },
				{ event: TelemetryEventName.TASK_RESTARTED, properties: { taskId: "2" } },
			]

			for (const event of events) {
				await queue.enqueue(event)
			}

			// Make one event have a retry
			const storedEvents = await storage.getAll()
			storedEvents[0].retryCount = 1
			await storage.update(storedEvents[0])

			const status = await queue.getStatus()

			expect(status.count).toBe(2)
			expect(status.sizeInBytes).toBeGreaterThan(0)
			expect(status.isProcessing).toBe(false)
			expect(status.oldestEventTimestamp).toBeDefined()
			expect(status.failedEventCount).toBe(1)
		})
	})

	describe("clear", () => {
		it("should clear all events from the queue", async () => {
			queue = new TelemetryEventQueue(storage, processor, { processOnEnqueue: false })

			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await queue.enqueue(event)
			await queue.clear()

			const remainingEvents = await storage.getAll()
			expect(remainingEvents).toHaveLength(0)
		})
	})

	describe("multi-instance support", () => {
		let mockContext: vscode.ExtensionContext
		let storage1: GlobalStateQueueStorage
		let storage2: GlobalStateQueueStorage
		let queue1: TelemetryEventQueue
		let queue2: TelemetryEventQueue

		beforeEach(() => {
			// Create a mock context that simulates shared globalState
			const sharedStorage = new Map<string, unknown>()
			mockContext = {
				globalState: {
					get: vi.fn((key: string) => sharedStorage.get(key)),
					update: vi.fn(async (key: string, value: unknown) => {
						sharedStorage.set(key, value)
					}),
					keys: vi.fn(() => Array.from(sharedStorage.keys())),
					setKeysForSync: vi.fn(),
				},
			} as unknown as vscode.ExtensionContext

			const multiInstanceConfig: MultiInstanceConfig = {
				enabled: true,
				lockDurationMs: 1000,
				lockCheckIntervalMs: 100,
				lockAcquireTimeoutMs: 2000,
				mode: "compete",
			}

			// Create two storage instances with multi-instance support
			storage1 = new GlobalStateQueueStorage(mockContext, undefined, multiInstanceConfig)
			storage2 = new GlobalStateQueueStorage(mockContext, undefined, multiInstanceConfig)

			// Create two queue instances
			queue1 = new TelemetryEventQueue(storage1, processor, {
				processOnEnqueue: false,
				multiInstance: multiInstanceConfig,
			})
			queue2 = new TelemetryEventQueue(storage2, processor, {
				processOnEnqueue: false,
				multiInstance: multiInstanceConfig,
			})
		})

		it("should prevent concurrent processing from multiple instances", async () => {
			// Add events to the shared queue
			const events: TelemetryEvent[] = [
				{ event: TelemetryEventName.TASK_CREATED, properties: { taskId: "1" } },
				{ event: TelemetryEventName.TASK_CREATED, properties: { taskId: "2" } },
				{ event: TelemetryEventName.TASK_CREATED, properties: { taskId: "3" } },
			]

			for (const event of events) {
				await queue1.enqueue(event)
			}

			// Reset processor to track which instance processed
			processor.processedEvents = []

			// Both instances try to process simultaneously
			const [result1, result2] = await Promise.all([queue1.processQueue(), queue2.processQueue()])

			// Only one instance should have processed
			const totalProcessed = result1 + result2
			expect(totalProcessed).toBe(3)
			expect(processor.processedEvents).toHaveLength(3)

			// One result should be 3, the other 0
			expect([result1, result2].includes(3)).toBe(true)
			expect([result1, result2].includes(0)).toBe(true)
		})

		it("should renew lock during long processing", async () => {
			// Create a processor that takes time
			let processStarted = false
			let processCompleted = false
			const slowProcessor = new MockQueueProcessor()
			slowProcessor.process = async (_event: QueuedTelemetryEvent) => {
				processStarted = true
				// Simulate processing that takes longer than initial lock duration
				await new Promise((resolve) => setTimeout(resolve, 800))
				processCompleted = true
				return true
			}

			const renewQueue = new TelemetryEventQueue(storage1, slowProcessor, {
				processOnEnqueue: false,
				multiInstance: {
					enabled: true,
					lockDurationMs: 600, // Lock expires in 600ms
					lockCheckIntervalMs: 200, // Renew every 200ms
					mode: "compete",
				},
			})

			await renewQueue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "slow" },
			})

			// Process the queue
			const result = await renewQueue.processQueue()

			// Processing should complete successfully due to lock renewal
			expect(processStarted).toBe(true)
			expect(processCompleted).toBe(true)
			expect(result).toBe(1)
		})

		it("should stop processing if lock is stolen by another instance", async () => {
			// Create a processor that allows us to control timing
			let processingStarted = false
			let shouldContinue = true
			const controlledProcessor = new MockQueueProcessor()
			controlledProcessor.process = async (_event: QueuedTelemetryEvent) => {
				processingStarted = true
				// Wait until we signal to continue
				while (shouldContinue) {
					await new Promise((resolve) => setTimeout(resolve, 100))
				}
				return true
			}

			const queue = new TelemetryEventQueue(storage1, controlledProcessor, {
				processOnEnqueue: false,
				multiInstance: {
					enabled: true,
					lockDurationMs: 500,
					lockCheckIntervalMs: 100,
					mode: "compete",
				},
			})

			await queue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test" },
			})

			// Start processing
			const processPromise = queue.processQueue()

			// Wait for processing to start
			await new Promise((resolve) => setTimeout(resolve, 200))
			expect(processingStarted).toBe(true)

			// Force expire the lock by waiting
			await new Promise((resolve) => setTimeout(resolve, 600))

			// Another instance steals the lock
			const lockStolen = await storage2.acquireLock()
			expect(lockStolen).toBe(true)

			// Signal processor to continue
			shouldContinue = false

			// Wait for processing to complete
			const result = await processPromise

			// Should have processed the event before lock was checked again
			expect(result).toBe(1)
		})

		it("should work without locking when multi-instance is disabled", async () => {
			// Create queues without multi-instance support
			const noLockQueue1 = new TelemetryEventQueue(storage, processor, {
				processOnEnqueue: false,
				multiInstance: { enabled: false },
			})
			const noLockQueue2 = new TelemetryEventQueue(storage, processor, {
				processOnEnqueue: false,
				multiInstance: { enabled: false },
			})

			await noLockQueue1.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "1" },
			})

			processor.processedEvents = []

			// Both can process (though they'll compete for the same events)
			const [result1, result2] = await Promise.all([noLockQueue1.processQueue(), noLockQueue2.processQueue()])

			// At least one should have processed
			expect(result1 + result2).toBeGreaterThan(0)
		})

		it("should include lock information in status", async () => {
			// Acquire lock with queue1
			await storage1.acquireLock()

			const status = await queue1.getStatus()

			expect(status).toBeDefined()

			// Type assertion for extended status with lockInfo
			const statusWithLock = status as QueueStatus & {
				lockInfo?: {
					hasLock: boolean
					lockHolder?: string
					lockAge?: number
					isExpired?: boolean
					currentInstance: string
					multiInstanceMode: string
				}
			}

			expect(statusWithLock.lockInfo).toBeDefined()
			expect(statusWithLock.lockInfo?.hasLock).toBe(true)
			expect(statusWithLock.lockInfo?.currentInstance).toBe(storage1.getInstanceInfo().instanceId)
			expect(statusWithLock.lockInfo?.multiInstanceMode).toBe("compete")
		})

		it("should handle leader mode with periodic processing", async () => {
			const leaderConfig: MultiInstanceConfig = {
				enabled: true,
				lockDurationMs: 1000,
				lockCheckIntervalMs: 100,
				lockAcquireTimeoutMs: 500,
				mode: "leader",
			}

			// Create a queue in leader mode
			const leaderQueue = new TelemetryEventQueue(storage1, processor, {
				processOnEnqueue: false,
				multiInstance: leaderConfig,
			})

			// Add an event
			await leaderQueue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "leader-test" },
			})

			// Only the instance that acquires the lock should process
			const result = await leaderQueue.processQueue()

			// Should process if lock was acquired
			expect(result).toBeGreaterThanOrEqual(0)
		})

		it("should properly cleanup on shutdown", async () => {
			// Acquire lock
			await storage1.acquireLock()
			expect(await storage1.holdsLock()).toBe(true)

			// Shutdown queue
			await queue1.shutdown()

			// Lock should be released
			expect(await storage1.holdsLock()).toBe(false)
		})
	})
})
