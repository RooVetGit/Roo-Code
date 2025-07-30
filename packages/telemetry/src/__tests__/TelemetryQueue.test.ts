import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { TelemetryQueue, QueuedTelemetryEvent } from "../TelemetryQueue"
import { TelemetryEvent, TelemetryEventName } from "@roo-code/types"

// Mock vscode
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
}))

// Mock crypto
vi.mock("crypto", () => ({
	randomUUID: vi.fn(() => "test-uuid-" + Math.random()),
}))

describe("TelemetryQueue", () => {
	let mockContext: vscode.ExtensionContext
	let queue: TelemetryQueue
	let mockGlobalState: Map<string, unknown>

	beforeEach(() => {
		vi.useFakeTimers()

		// Create a mock global state
		mockGlobalState = new Map()

		// Mock extension context
		mockContext = {
			globalState: {
				get: vi.fn((key: string) => mockGlobalState.get(key)),
				update: vi.fn(async (key: string, value: unknown) => {
					mockGlobalState.set(key, value)
				}),
			},
		} as unknown as vscode.ExtensionContext

		queue = new TelemetryQueue(mockContext)
	})

	afterEach(() => {
		vi.clearAllTimers()
		vi.restoreAllMocks()
	})

	describe("addEvent", () => {
		it("should add an event to the queue", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await queue.addEvent(event, "posthog")

			expect(queue.getQueueSize()).toBe(1)
			expect(mockContext.globalState.update).toHaveBeenCalledWith(
				"telemetryQueue",
				expect.arrayContaining([
					expect.objectContaining({
						id: expect.stringContaining("test-uuid-"),
						event,
						clientType: "posthog",
						retryCount: 0,
						timestamp: expect.any(Number),
					}),
				]),
			)
		})

		it("should enforce queue size limit with FIFO eviction", async () => {
			// Add more than MAX_QUEUE_SIZE (1000) events
			for (let i = 0; i < 1005; i++) {
				await queue.addEvent(
					{
						event: TelemetryEventName.TASK_CREATED,
						properties: { index: i },
					},
					"cloud",
				)
			}

			expect(queue.getQueueSize()).toBe(1000)
		})

		it("should start the timer when adding first event", async () => {
			const startSpy = vi.spyOn(queue, "start")

			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				"posthog",
			)

			expect(startSpy).toHaveBeenCalled()
		})
	})

	describe("processQueue", () => {
		it("should process events successfully", async () => {
			const mockCallback = vi.fn().mockResolvedValue(true)
			queue.setRetryCallback(mockCallback)

			// Add some events
			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: { id: 1 },
				},
				"posthog",
			)
			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_COMPLETED,
					properties: { id: 2 },
				},
				"cloud",
			)

			const result = await queue.processQueue()

			expect(result).toBe(true)
			expect(mockCallback).toHaveBeenCalledTimes(2)
			expect(queue.getQueueSize()).toBe(0)
		})

		it("should handle failed events with retry", async () => {
			const mockCallback = vi.fn().mockResolvedValue(false)
			queue.setRetryCallback(mockCallback)

			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				"posthog",
			)

			const result = await queue.processQueue()

			expect(result).toBe(false)
			expect(queue.getQueueSize()).toBe(1)

			// Check that retry metadata was updated
			const queuedEvents = mockGlobalState.get("telemetryQueue") as QueuedTelemetryEvent[]
			expect(queuedEvents[0].retryCount).toBe(1)
			expect(queuedEvents[0].lastAttempt).toBeDefined()
			expect(queuedEvents[0].nextAttempt).toBeDefined()
		})

		it("should skip events not ready for retry", async () => {
			const mockCallback = vi.fn().mockResolvedValue(true)
			queue.setRetryCallback(mockCallback)

			// Add an event with future nextAttempt
			const futureEvent: QueuedTelemetryEvent = {
				id: "test-1",
				timestamp: Date.now(),
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				clientType: "posthog",
				retryCount: 1,
				nextAttempt: Date.now() + 10000, // 10 seconds in future
			}

			mockGlobalState.set("telemetryQueue", [futureEvent])
			queue = new TelemetryQueue(mockContext) // Reload to pick up the event
			queue.setRetryCallback(mockCallback)

			await queue.processQueue()

			expect(mockCallback).not.toHaveBeenCalled()
			expect(queue.getQueueSize()).toBe(1)
		})

		it("should drop events after max retries", async () => {
			const mockCallback = vi.fn().mockResolvedValue(false)
			queue.setRetryCallback(mockCallback)

			// Add an event that has already been retried max times
			const maxRetriedEvent: QueuedTelemetryEvent = {
				id: "test-1",
				timestamp: Date.now(),
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				clientType: "posthog",
				retryCount: 10, // MAX_RETRY_COUNT
			}

			mockGlobalState.set("telemetryQueue", [maxRetriedEvent])
			queue = new TelemetryQueue(mockContext)
			queue.setRetryCallback(mockCallback)

			await queue.processQueue()

			expect(mockCallback).not.toHaveBeenCalled()
			expect(queue.getQueueSize()).toBe(0)
			// Event should be silently dropped
		})

		it("should handle callback errors as failures", async () => {
			const mockCallback = vi.fn().mockRejectedValue(new Error("Network error"))
			queue.setRetryCallback(mockCallback)

			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				"posthog",
			)

			const result = await queue.processQueue()

			expect(result).toBe(false)
			expect(queue.getQueueSize()).toBe(1)
			// Error should be silently handled
		})

		it("should return false if no callback is set", async () => {
			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				"posthog",
			)

			const result = await queue.processQueue()

			expect(result).toBe(false)
		})
	})

	describe("shutdown", () => {
		it("should stop timer and save queue", async () => {
			const stopSpy = vi.spyOn(queue, "stop")

			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				"posthog",
			)

			await queue.shutdown()

			expect(stopSpy).toHaveBeenCalled()
			expect(mockContext.globalState.update).toHaveBeenCalled()
		})

		it("should attempt to process queue with timeout", async () => {
			const mockCallback = vi
				.fn()
				.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(true), 10000)))
			queue.setRetryCallback(mockCallback)

			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				"posthog",
			)

			const shutdownPromise = queue.shutdown(100) // 100ms timeout

			// Fast forward time
			await vi.advanceTimersByTimeAsync(100)

			await shutdownPromise

			// Callback should have been called but may not have completed
			expect(mockCallback).toHaveBeenCalled()
		})
	})

	describe("clearQueue", () => {
		it("should clear all events from the queue", async () => {
			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				"posthog",
			)
			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_COMPLETED,
					properties: {},
				},
				"cloud",
			)

			expect(queue.getQueueSize()).toBe(2)

			await queue.clearQueue()

			expect(queue.getQueueSize()).toBe(0)
			expect(mockContext.globalState.update).toHaveBeenCalledWith("telemetryQueue", [])
		})
	})

	describe("persistence", () => {
		it("should load queue from storage on initialization", () => {
			const persistedEvents: QueuedTelemetryEvent[] = [
				{
					id: "persisted-1",
					timestamp: Date.now(),
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: {},
					},
					clientType: "posthog",
					retryCount: 2,
				},
			]

			mockGlobalState.set("telemetryQueue", persistedEvents)

			const newQueue = new TelemetryQueue(mockContext)

			expect(newQueue.getQueueSize()).toBe(1)
		})

		it("should handle corrupted storage gracefully", () => {
			// Set invalid data that will cause an error when loading
			mockContext.globalState.get = vi.fn().mockImplementation((key: string) => {
				if (key === "telemetryQueue") {
					// Return non-array data to trigger error handling
					return "not-an-array"
				}
				return undefined
			})

			// The loadQueue method doesn't throw, it just logs and continues
			// So we need to check that it handles the invalid data gracefully
			const newQueue = new TelemetryQueue(mockContext)

			expect(newQueue.getQueueSize()).toBe(0)
		})
	})

	describe("timer behavior", () => {
		it("should use exponential backoff for failures", async () => {
			const mockCallback = vi.fn().mockResolvedValue(false)
			queue.setRetryCallback(mockCallback)

			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				"posthog",
			)

			// Start the queue
			queue.start()

			// Wait for initial execution
			await vi.runOnlyPendingTimersAsync()
			expect(mockCallback).toHaveBeenCalledTimes(1)

			// Fast forward 1 second (initial backoff)
			await vi.advanceTimersByTimeAsync(1000)
			await vi.runOnlyPendingTimersAsync()
			expect(mockCallback).toHaveBeenCalledTimes(2)

			// Fast forward 2 seconds (exponential backoff)
			await vi.advanceTimersByTimeAsync(2000)
			await vi.runOnlyPendingTimersAsync()
			expect(mockCallback).toHaveBeenCalledTimes(3)

			// Fast forward 4 seconds (exponential backoff)
			await vi.advanceTimersByTimeAsync(4000)
			await vi.runOnlyPendingTimersAsync()
			expect(mockCallback).toHaveBeenCalledTimes(4)
		})

		it("should use success interval after successful processing", async () => {
			const mockCallback = vi.fn().mockResolvedValue(true)
			queue.setRetryCallback(mockCallback)

			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				"posthog",
			)

			// Process successfully
			await queue.processQueue()
			expect(mockCallback).toHaveBeenCalledTimes(1)
			expect(queue.getQueueSize()).toBe(0)

			// Add another event
			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_COMPLETED,
					properties: {},
				},
				"cloud",
			)

			// Fast forward 30 seconds (success interval)
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockCallback).toHaveBeenCalledTimes(2)
		})

		it("should cap backoff at maximum", async () => {
			const mockCallback = vi.fn().mockResolvedValue(false)
			queue.setRetryCallback(mockCallback)

			// Manually create an event that has been retried many times
			const highRetryEvent: QueuedTelemetryEvent = {
				id: "test-1",
				timestamp: Date.now(),
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				clientType: "posthog",
				retryCount: 8, // High retry count to test max backoff
			}

			// Set the event in storage
			mockGlobalState.set("telemetryQueue", [highRetryEvent])

			// Create a new queue to load the event
			const newQueue = new TelemetryQueue(mockContext)
			newQueue.setRetryCallback(mockCallback)

			// Process the queue
			await newQueue.processQueue()

			// Check the updated event
			const queuedEvents = mockGlobalState.get("telemetryQueue") as QueuedTelemetryEvent[]
			expect(queuedEvents).toBeDefined()
			expect(queuedEvents.length).toBe(1)

			const updatedEvent = queuedEvents[0]
			expect(updatedEvent.retryCount).toBe(9)
			expect(updatedEvent.lastAttempt).toBeDefined()
			expect(updatedEvent.nextAttempt).toBeDefined()

			// Check that backoff is capped at max
			const backoffTime = updatedEvent.nextAttempt! - updatedEvent.lastAttempt!
			expect(backoffTime).toBeLessThanOrEqual(300000) // 5 minutes max
		})
	})

	describe("start/stop", () => {
		it("should start processing immediately", () => {
			const executeCallbackSpy = vi.spyOn(
				queue as unknown as { executeCallback: () => Promise<void> },
				"executeCallback",
			)

			queue.start()

			expect(executeCallbackSpy).toHaveBeenCalled()
		})

		it("should not start if already running", () => {
			queue.start()

			const executeCallbackSpy = vi.spyOn(
				queue as unknown as { executeCallback: () => Promise<void> },
				"executeCallback",
			)

			queue.start()

			expect(executeCallbackSpy).not.toHaveBeenCalled()
		})

		it("should stop timer and prevent further processing", async () => {
			const mockCallback = vi.fn().mockResolvedValue(true)
			queue.setRetryCallback(mockCallback)

			await queue.addEvent(
				{
					event: TelemetryEventName.TASK_CREATED,
					properties: {},
				},
				"posthog",
			)

			queue.start()
			queue.stop()

			// Fast forward time
			await vi.advanceTimersByTimeAsync(60000)

			// Should only be called once (the initial call)
			expect(mockCallback).toHaveBeenCalledTimes(1)
		})
	})
})
