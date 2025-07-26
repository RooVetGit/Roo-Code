import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest"
import { TelemetryRetryManager } from "../TelemetryRetryManager"
import { TelemetryEventName, TelemetryEvent } from "@roo-code/types"

// Mock TelemetryQueue
vi.mock("../TelemetryQueue")

describe("TelemetryRetryManager", () => {
	let mockQueue: {
		enqueue: Mock
		getEventsForRetry: Mock
		updateEventAfterRetry: Mock
		pruneFailedEvents: Mock
		getQueueMetadata: Mock
	}
	let retryManager: TelemetryRetryManager
	let sendEventMock: Mock
	let connectionStatusCallback: Mock
	let queueSizeCallback: Mock

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()

		// Create mock queue
		mockQueue = {
			enqueue: vi.fn(),
			getEventsForRetry: vi.fn().mockResolvedValue([]),
			updateEventAfterRetry: vi.fn(),
			pruneFailedEvents: vi.fn().mockResolvedValue(0),
			getQueueMetadata: vi.fn().mockResolvedValue({
				size: 0,
				isAboveWarningThreshold: false,
			}),
		}

		// Create mocks
		sendEventMock = vi.fn().mockResolvedValue(undefined)
		connectionStatusCallback = vi.fn()
		queueSizeCallback = vi.fn()

		// Create retry manager
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		retryManager = new TelemetryRetryManager(mockQueue as any, sendEventMock, {
			retryIntervalMs: 30000,
			batchSize: 10,
			onConnectionStatusChange: connectionStatusCallback,
			onQueueSizeChange: queueSizeCallback,
		})
	})

	afterEach(() => {
		retryManager.stop()
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	describe("start/stop", () => {
		it("should start retry timer", async () => {
			retryManager.start()

			// Should not process immediately
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(0)

			// Advance timer and run pending timers
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(1)

			// Advance timer again
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(2)
		})

		it("should not start multiple timers", async () => {
			retryManager.start()
			retryManager.start()

			// Advance timer
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(1)

			// Advance timer again
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(2)
		})

		it("should stop retry timer", async () => {
			retryManager.start()

			// Advance timer once
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(1)

			retryManager.stop()

			// Advance timer again
			await vi.advanceTimersByTimeAsync(30000)
			// Should still only be called once
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(1)
		})
	})

	describe("queueFailedEvent", () => {
		it("should add event to queue", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await retryManager.queueFailedEvent(event, "Network error")

			expect(mockQueue.enqueue).toHaveBeenCalledWith(event, "Network error")
		})

		it("should update connection status on error", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await retryManager.queueFailedEvent(event, "Connection failed")

			expect(connectionStatusCallback).toHaveBeenCalledWith(false)
		})

		it("should notify queue size change", async () => {
			mockQueue.getQueueMetadata.mockResolvedValue({
				size: 5,
				isAboveWarningThreshold: false,
			})

			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await retryManager.queueFailedEvent(event)

			expect(queueSizeCallback).toHaveBeenCalledWith(5, false)
		})
	})

	describe("processQueue", () => {
		it("should process events in batches", async () => {
			const events = Array.from({ length: 25 }, (_, i) => ({
				id: `event-${i}`,
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: `test-${i}` },
				},
				timestamp: Date.now(),
				retryCount: 0,
			}))

			mockQueue.getEventsForRetry.mockResolvedValue(events)

			retryManager.start()

			// Advance timer to trigger processing
			await vi.advanceTimersByTimeAsync(30000)

			// Should process in batches of 10
			// Filter out connection check events
			const actualEventCalls = sendEventMock.mock.calls.filter(
				(call) => (call[0].event as string) !== "telemetry_connection_check",
			)
			expect(actualEventCalls).toHaveLength(25)
			expect(mockQueue.updateEventAfterRetry).toHaveBeenCalledTimes(25)
		})

		it("should handle successful sends", async () => {
			const event = {
				id: "event-1",
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: "test-1" },
				},
				timestamp: Date.now(),
				retryCount: 0,
			}

			mockQueue.getEventsForRetry.mockResolvedValue([event])
			sendEventMock.mockResolvedValue(undefined)

			retryManager.start()

			// Advance timer to trigger processing
			await vi.advanceTimersByTimeAsync(30000)

			expect(mockQueue.updateEventAfterRetry).toHaveBeenCalledWith("event-1", true, undefined)
		})

		it("should handle failed sends", async () => {
			const event = {
				id: "event-1",
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: "test-1" },
				},
				timestamp: Date.now(),
				retryCount: 0,
			}

			mockQueue.getEventsForRetry.mockResolvedValue([event])
			sendEventMock.mockRejectedValue(new Error("Network error"))

			retryManager.start()

			// Advance timer to trigger processing
			await vi.advanceTimersByTimeAsync(30000)

			expect(mockQueue.updateEventAfterRetry).toHaveBeenCalledWith("event-1", false, "Network error")
		})

		it("should update connection status based on results", async () => {
			const events = [
				{
					id: "event-1",
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: { taskId: "test-1" },
					},
					timestamp: Date.now(),
					retryCount: 0,
				},
			]

			mockQueue.getEventsForRetry.mockResolvedValue(events)

			// First fail, then succeed
			sendEventMock.mockRejectedValueOnce(new Error("Network error"))

			retryManager.start()

			// Advance timer to trigger processing
			await vi.advanceTimersByTimeAsync(30000)

			expect(connectionStatusCallback).toHaveBeenCalledWith(false)

			// Now succeed
			sendEventMock.mockResolvedValueOnce(undefined)
			await vi.advanceTimersByTimeAsync(30000)

			expect(connectionStatusCallback).toHaveBeenCalledWith(true)
		})

		it("should prune failed events", async () => {
			mockQueue.pruneFailedEvents.mockResolvedValue(3)

			retryManager.start()

			// Advance timer to trigger processing
			await vi.advanceTimersByTimeAsync(30000)

			expect(mockQueue.pruneFailedEvents).toHaveBeenCalled()
		})
	})

	describe("triggerRetry", () => {
		it("should manually trigger queue processing", async () => {
			await retryManager.triggerRetry()

			expect(mockQueue.getEventsForRetry).toHaveBeenCalled()
			expect(mockQueue.pruneFailedEvents).toHaveBeenCalled()
		})
	})

	describe("getConnectionStatus", () => {
		it("should return current connection status", () => {
			expect(retryManager.getConnectionStatus()).toBe(true)
		})
	})

	describe("connection check", () => {
		it("should periodically check connection status", async () => {
			// Mock successful connection check
			sendEventMock.mockImplementation((event: TelemetryEvent) => {
				if ((event.event as string) === "telemetry_connection_check") {
					return Promise.resolve()
				}
				return Promise.reject(new Error("Other error"))
			})

			// Mock some events to trigger processing
			mockQueue.getEventsForRetry.mockResolvedValue([
				{
					id: "event-1",
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: { taskId: "test-1" },
					},
					timestamp: Date.now(),
					retryCount: 0,
				},
			])

			retryManager.start()

			// First advance to trigger initial processing (30s)
			await vi.advanceTimersByTimeAsync(30000)

			// Then advance past connection check interval (1 minute more)
			await vi.advanceTimersByTimeAsync(35000)

			// Should have sent a connection check event
			expect(sendEventMock).toHaveBeenCalledWith(
				expect.objectContaining({
					event: "telemetry_connection_check",
				}),
			)
		})

		it("should update connection status on check failure", async () => {
			// All sends fail
			sendEventMock.mockRejectedValue(new Error("Connection failed"))

			// Mock some events to trigger processing
			mockQueue.getEventsForRetry.mockResolvedValue([
				{
					id: "event-1",
					event: {
						event: TelemetryEventName.TASK_CREATED,
						properties: { taskId: "test-1" },
					},
					timestamp: Date.now(),
					retryCount: 0,
				},
			])

			retryManager.start()

			// First advance to trigger initial processing (30s)
			await vi.advanceTimersByTimeAsync(30000)

			// Then advance past connection check interval (1 minute more)
			await vi.advanceTimersByTimeAsync(35000)

			expect(connectionStatusCallback).toHaveBeenCalledWith(false)
		})
	})
})
