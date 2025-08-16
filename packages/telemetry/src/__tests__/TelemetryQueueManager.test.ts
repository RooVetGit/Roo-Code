import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import { TelemetryQueueManager } from "../TelemetryQueueManager"
import { TelemetryEvent, TelemetryEventName } from "@roo-code/types"

// Mock fs module
vi.mock("fs/promises")

// Helper to reset singleton instance
function resetQueueManagerInstance() {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const QueueManagerConstructor = TelemetryQueueManager as any
	if (QueueManagerConstructor && typeof QueueManagerConstructor === "function") {
		QueueManagerConstructor.instance = null
	}
}

describe("TelemetryQueueManager", () => {
	let queueManager: TelemetryQueueManager
	const testStoragePath = "/test/storage"
	const testQueuePath = path.join(testStoragePath, "telemetry-queue.json")

	beforeEach(() => {
		vi.clearAllMocks()
		// Reset singleton instance
		resetQueueManagerInstance()

		// Mock file system operations
		vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))
		vi.mocked(fs.writeFile).mockResolvedValue()
		vi.mocked(fs.rename).mockResolvedValue()
		vi.mocked(fs.mkdir).mockResolvedValue(undefined as never)

		queueManager = TelemetryQueueManager.getInstance(testStoragePath)
	})

	afterEach(async () => {
		await queueManager.shutdown()
	})

	describe("getInstance", () => {
		it("should return the same instance on multiple calls", () => {
			const instance1 = TelemetryQueueManager.getInstance(testStoragePath)
			const instance2 = TelemetryQueueManager.getInstance(testStoragePath)
			expect(instance1).toBe(instance2)
		})
	})

	describe("enqueue", () => {
		it("should add an event to the queue", () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			queueManager.enqueue(event, "test-client")

			const stats = queueManager.getStats()
			expect(stats.queueSize).toBe(1)
			expect(stats.eventsByClient["test-client"]).toBe(1)
		})

		it("should respect max queue size", () => {
			// Set max queue size to a small number for testing
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(queueManager as any).maxQueueSize = 3

			for (let i = 0; i < 5; i++) {
				const event: TelemetryEvent = {
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: `test-${i}` },
				}
				queueManager.enqueue(event, "test-client")
			}

			const stats = queueManager.getStats()
			expect(stats.queueSize).toBe(3)
		})

		it("should persist queue after enqueuing", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			queueManager.enqueue(event, "test-client")

			// Wait a bit for async persist
			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(testQueuePath), { recursive: true })
			expect(fs.writeFile).toHaveBeenCalled()
			expect(fs.rename).toHaveBeenCalled()
		})
	})

	describe("processQueue", () => {
		it("should process events for a specific client", async () => {
			const event1: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-1" },
			}
			const event2: TelemetryEvent = {
				event: TelemetryEventName.TASK_COMPLETED,
				properties: { taskId: "test-2" },
			}

			queueManager.enqueue(event1, "client-1")
			queueManager.enqueue(event2, "client-2")

			const sendFunction = vi.fn().mockResolvedValue(undefined)
			await queueManager.processQueue("client-1", sendFunction)

			expect(sendFunction).toHaveBeenCalledTimes(1)
			expect(sendFunction).toHaveBeenCalledWith(event1)

			const stats = queueManager.getStats()
			expect(stats.queueSize).toBe(1) // Only client-2 event remains
		})

		it("should handle send failures and increment retry count", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			queueManager.enqueue(event, "test-client")

			const sendFunction = vi.fn().mockRejectedValue(new Error("Network error"))
			await queueManager.processQueue("test-client", sendFunction)

			// Access the internal queue directly to check retry count
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const internalQueue = (queueManager as any).queue
			expect(internalQueue[0].retryCount).toBe(1)
		})

		it("should not remove events based on retry count (events expire after 24 hours)", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			queueManager.enqueue(event, "test-client")

			// Set retry count to high value
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const queuedEvents = (queueManager as any).queue
			queuedEvents[0].retryCount = 10

			const sendFunction = vi.fn().mockRejectedValue(new Error("Network error"))
			await queueManager.processQueue("test-client", sendFunction)

			const stats = queueManager.getStats()
			expect(stats.queueSize).toBe(1) // Event NOT removed, will expire after 24 hours
		})
	})

	describe("getRetryDelay", () => {
		it("should calculate exponential backoff correctly", () => {
			expect(queueManager.getRetryDelay(0)).toBe(1000)
			expect(queueManager.getRetryDelay(1)).toBe(2000)
			expect(queueManager.getRetryDelay(2)).toBe(4000)
			expect(queueManager.getRetryDelay(3)).toBe(8000)
			expect(queueManager.getRetryDelay(10)).toBe(60000) // Max delay
		})

		describe("loadQueue with corrupted file", () => {
			it("should handle corrupted JSON gracefully", async () => {
				vi.mocked(fs.readFile).mockResolvedValueOnce("{ invalid json }")

				// Create new instance to trigger load
				resetQueueManagerInstance()
				queueManager = TelemetryQueueManager.getInstance(testStoragePath)

				// Wait for async load
				await new Promise((resolve) => setTimeout(resolve, 10))

				const stats = queueManager.getStats()
				expect(stats.queueSize).toBe(0) // Should start with empty queue
			})
		})
	})

	describe("shouldRetry", () => {
		it("should return true when enough time has passed", () => {
			const queuedEvent = {
				event: { event: TelemetryEventName.TASK_CREATED },
				timestamp: Date.now() - 5000,
				retryCount: 1,
				clientId: "test-client",
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(queueManager.shouldRetry(queuedEvent as any)).toBe(true)
		})

		it("should return false when not enough time has passed", () => {
			const queuedEvent = {
				event: { event: TelemetryEventName.TASK_CREATED },
				timestamp: Date.now() - 500,
				retryCount: 1,
				clientId: "test-client",
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(queueManager.shouldRetry(queuedEvent as any)).toBe(false)
		})
	})

	describe("getEventsForRetry", () => {
		it("should return only events ready for retry for specific client", () => {
			const oldEvent = {
				event: { event: TelemetryEventName.TASK_CREATED },
				timestamp: Date.now() - 5000,
				retryCount: 1,
				clientId: "client-1",
			}
			const recentEvent = {
				event: { event: TelemetryEventName.TASK_COMPLETED },
				timestamp: Date.now() - 100,
				retryCount: 1,
				clientId: "client-1",
			}
			const otherClientEvent = {
				event: { event: TelemetryEventName.MODE_SWITCH },
				timestamp: Date.now() - 5000,
				retryCount: 1,
				clientId: "client-2",
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(queueManager as any).queue = [oldEvent, recentEvent, otherClientEvent]

			const eventsForRetry = queueManager.getEventsForRetry("client-1")
			expect(eventsForRetry).toHaveLength(1)
			expect(eventsForRetry[0]).toBe(oldEvent)
		})
	})

	describe("loadQueue", () => {
		it("should load queue from disk if file exists", async () => {
			const savedQueue = {
				version: 1,
				events: [
					{
						event: { event: TelemetryEventName.TASK_CREATED },
						timestamp: Date.now() - 1000,
						retryCount: 2,
						clientId: "test-client",
					},
				],
			}

			vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(savedQueue))

			// Create new instance to trigger load

			// Reset singleton instance
			resetQueueManagerInstance()
			queueManager = TelemetryQueueManager.getInstance(testStoragePath)

			// Wait for async load
			await new Promise((resolve) => setTimeout(resolve, 10))

			const stats = queueManager.getStats()
			expect(stats.queueSize).toBe(1)
		})

		it("should filter out events older than 24 hours", async () => {
			const savedQueue = {
				version: 1,
				events: [
					{
						event: { event: TelemetryEventName.TASK_CREATED },
						timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours old
						retryCount: 0,
						clientId: "test-client",
					},
					{
						event: { event: TelemetryEventName.TASK_COMPLETED },
						timestamp: Date.now() - 23 * 60 * 60 * 1000, // 23 hours old
						retryCount: 0,
						clientId: "test-client",
					},
				],
			}

			vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(savedQueue))

			// Create new instance to trigger load
			resetQueueManagerInstance()
			queueManager = TelemetryQueueManager.getInstance(testStoragePath)

			// Wait for async load
			await new Promise((resolve) => setTimeout(resolve, 10))

			const stats = queueManager.getStats()
			expect(stats.queueSize).toBe(1) // Only the 23-hour-old event
		})
	})

	describe("clearQueue", () => {
		it("should clear all queued events", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			queueManager.enqueue(event, "test-client")
			expect(queueManager.getStats().queueSize).toBe(1)

			await queueManager.clearQueue()
			expect(queueManager.getStats().queueSize).toBe(0)
		})
	})

	describe("getStats", () => {
		it("should return correct statistics", () => {
			const event1: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-1" },
			}
			const event2: TelemetryEvent = {
				event: TelemetryEventName.TASK_COMPLETED,
				properties: { taskId: "test-2" },
			}

			queueManager.enqueue(event1, "client-1")
			queueManager.enqueue(event2, "client-1")
			queueManager.enqueue(event1, "client-2")

			const stats = queueManager.getStats()
			expect(stats.queueSize).toBe(3)
			expect(stats.eventsByClient["client-1"]).toBe(2)
			expect(stats.eventsByClient["client-2"]).toBe(1)
			expect(stats.oldestEventAge).toBeGreaterThanOrEqual(0)
			expect(stats.oldestEventAge).toBeLessThan(1000)
		})

		it("should handle empty queue", () => {
			const stats = queueManager.getStats()
			expect(stats.queueSize).toBe(0)
			expect(stats.oldestEventAge).toBeNull()
			expect(stats.eventsByClient).toEqual({})
		})
	})

	describe("shutdown", () => {
		it("should persist queue and stop timers", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			queueManager.enqueue(event, "test-client")

			await queueManager.shutdown()

			expect(fs.writeFile).toHaveBeenCalled()
			expect(fs.rename).toHaveBeenCalled()
		})
	})
})
