import { describe, it, expect, vi, beforeEach } from "vitest"
import { TelemetryQueue } from "../TelemetryQueue"
import { TelemetryEventName } from "@roo-code/types"

// Mock vscode
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
}))

describe("TelemetryQueue", () => {
	let mockContext: {
		globalState: {
			get: ReturnType<typeof vi.fn>
			update: ReturnType<typeof vi.fn>
		}
	}
	let queue: TelemetryQueue

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Create mock context with storage
		const storage = new Map<string, unknown>()
		mockContext = {
			globalState: {
				get: vi.fn((key: string) => storage.get(key)),
				update: vi.fn(async (key: string, value: unknown) => {
					storage.set(key, value)
				}),
			},
		}

		// Create queue instance
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		queue = new TelemetryQueue(mockContext as any)
	})

	describe("enqueue", () => {
		it("should add events to the queue", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await queue.enqueue(event)

			const size = await queue.getQueueSize()
			expect(size).toBe(1)

			const events = await queue.getAllEvents()
			expect(events).toHaveLength(1)
			expect(events[0].event).toEqual(event)
			expect(events[0].retryCount).toBe(0)
			expect(events[0].timestamp).toBeDefined()
			expect(events[0].id).toBeDefined()
		})

		it("should include error message when provided", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}
			const error = "Network error"

			await queue.enqueue(event, error)

			const events = await queue.getAllEvents()
			expect(events[0].error).toBe(error)
		})

		it("should respect max queue size", async () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const smallQueue = new TelemetryQueue(mockContext as any, {
				maxQueueSize: 3,
				maxRetries: 5,
				queueSizeWarningThreshold: 2,
			})

			// Add 4 events (one more than max)
			for (let i = 0; i < 4; i++) {
				await smallQueue.enqueue({
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: `test-${i}` },
				})
			}

			const size = await smallQueue.getQueueSize()
			expect(size).toBe(3) // Should be capped at max

			const events = await smallQueue.getAllEvents()
			// First event should have been removed
			expect(events[0].event.properties?.taskId).toBe("test-1")
			expect(events[2].event.properties?.taskId).toBe("test-3")
		})
	})

	describe("getEventsForRetry", () => {
		it("should return events ready for immediate retry", async () => {
			await queue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-1" },
			})

			await queue.enqueue({
				event: TelemetryEventName.TASK_COMPLETED,
				properties: { taskId: "test-2" },
			})

			const eventsForRetry = await queue.getEventsForRetry()
			expect(eventsForRetry).toHaveLength(2)
		})

		it("should respect exponential backoff", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await queue.enqueue(event)
			const events = await queue.getAllEvents()
			const eventId = events[0].id

			// First retry - should be immediate
			let eventsForRetry = await queue.getEventsForRetry()
			expect(eventsForRetry).toHaveLength(1)

			// Update after first retry
			await queue.updateEventAfterRetry(eventId, false, "Error 1")

			// Immediately after retry - should not be ready (2^1 = 2 seconds backoff)
			eventsForRetry = await queue.getEventsForRetry()
			expect(eventsForRetry).toHaveLength(0)

			// Simulate time passing by updating the lastRetryTimestamp
			const allEvents = await queue.getAllEvents()
			allEvents[0].lastRetryTimestamp = Date.now() - 3000 // 3 seconds ago

			// Manually update the queue storage
			await mockContext.globalState.update("telemetryQueue", allEvents)

			// Now it should be ready for retry
			eventsForRetry = await queue.getEventsForRetry()
			expect(eventsForRetry).toHaveLength(1)
		})

		it("should not return events that exceeded max retries", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await queue.enqueue(event)
			const events = await queue.getAllEvents()
			const eventId = events[0].id

			// Simulate max retries
			for (let i = 0; i < 5; i++) {
				await queue.updateEventAfterRetry(eventId, false, `Error ${i}`)
			}

			const eventsForRetry = await queue.getEventsForRetry()
			expect(eventsForRetry).toHaveLength(0)
		})
	})

	describe("updateEventAfterRetry", () => {
		it("should remove successful events", async () => {
			await queue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			})

			const events = await queue.getAllEvents()
			const eventId = events[0].id

			await queue.updateEventAfterRetry(eventId, true)

			const size = await queue.getQueueSize()
			expect(size).toBe(0)
		})

		it("should update retry count and timestamp on failure", async () => {
			await queue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			})

			const events = await queue.getAllEvents()
			const eventId = events[0].id

			await queue.updateEventAfterRetry(eventId, false, "Network error")

			const updatedEvents = await queue.getAllEvents()
			expect(updatedEvents[0].retryCount).toBe(1)
			expect(updatedEvents[0].lastRetryTimestamp).toBeDefined()
			expect(updatedEvents[0].error).toBe("Network error")
		})

		it("should handle non-existent event ID gracefully", async () => {
			await expect(queue.updateEventAfterRetry("non-existent", true)).resolves.not.toThrow()
		})
	})

	describe("getQueueMetadata", () => {
		it("should return correct metadata", async () => {
			const metadata = await queue.getQueueMetadata()
			expect(metadata).toEqual({
				size: 0,
				oldestEventTimestamp: undefined,
				newestEventTimestamp: undefined,
				isAboveWarningThreshold: false,
			})
		})

		it("should detect when above warning threshold", async () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const smallQueue = new TelemetryQueue(mockContext as any, {
				maxQueueSize: 10,
				maxRetries: 5,
				queueSizeWarningThreshold: 2,
			})

			await smallQueue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-1" },
			})

			let metadata = await smallQueue.getQueueMetadata()
			expect(metadata.isAboveWarningThreshold).toBe(false)

			await smallQueue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-2" },
			})

			metadata = await smallQueue.getQueueMetadata()
			expect(metadata.isAboveWarningThreshold).toBe(true)
			expect(metadata.size).toBe(2)
			expect(metadata.oldestEventTimestamp).toBeDefined()
			expect(metadata.newestEventTimestamp).toBeDefined()
		})
	})

	describe("pruneFailedEvents", () => {
		it("should remove events that exceeded max retries", async () => {
			// Add two events
			await queue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-1" },
			})

			await queue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-2" },
			})

			const events = await queue.getAllEvents()

			// Max out retries for first event
			for (let i = 0; i < 5; i++) {
				await queue.updateEventAfterRetry(events[0].id, false)
			}

			// Only one retry for second event
			await queue.updateEventAfterRetry(events[1].id, false)

			// Prune
			const prunedCount = await queue.pruneFailedEvents()
			expect(prunedCount).toBe(1)

			const remainingEvents = await queue.getAllEvents()
			expect(remainingEvents).toHaveLength(1)
			expect(remainingEvents[0].event.properties?.taskId).toBe("test-2")
		})

		it("should return 0 when no events to prune", async () => {
			await queue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-1" },
			})

			const prunedCount = await queue.pruneFailedEvents()
			expect(prunedCount).toBe(0)
		})
	})

	describe("clear", () => {
		it("should remove all events from queue", async () => {
			await queue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-1" },
			})

			await queue.enqueue({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-2" },
			})

			expect(await queue.getQueueSize()).toBe(2)

			await queue.clear()

			expect(await queue.getQueueSize()).toBe(0)
			expect(mockContext.globalState.update).toHaveBeenCalledWith("telemetryQueueMetadata", undefined)
		})
	})
})
