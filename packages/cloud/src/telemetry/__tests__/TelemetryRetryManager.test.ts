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

			// Should process immediately on start (after setTimeout)
			await vi.advanceTimersByTimeAsync(0)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(1)

			// Advance timer and run pending timers
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(2)

			// Advance timer again
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(3)
		})

		it("should not start multiple timers", async () => {
			retryManager.start()
			retryManager.start()

			// Should only process once on start (after setTimeout)
			await vi.advanceTimersByTimeAsync(0)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(1)

			// Advance timer
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(2)

			// Advance timer again
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(3)
		})

		it("should stop retry timer", async () => {
			retryManager.start()

			// Should process immediately on start (after setTimeout)
			await vi.advanceTimersByTimeAsync(0)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(1)

			// Advance timer once
			await vi.advanceTimersByTimeAsync(30000)
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(2)

			retryManager.stop()

			// Advance timer again
			await vi.advanceTimersByTimeAsync(30000)
			// Should still only be called twice
			expect(mockQueue.getEventsForRetry).toHaveBeenCalledTimes(2)
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

			// Wait for immediate processing to complete (after setTimeout)
			await vi.advanceTimersByTimeAsync(0)
			await vi.waitFor(() => {
				expect(mockQueue.getEventsForRetry).toHaveBeenCalled()
			})

			// Should process in batches of 10
			// Filter out connection check events
			const actualEventCalls = sendEventMock.mock.calls.filter(
				(call) => call[0].event !== TelemetryEventName.TELEMETRY_CONNECTION_CHECK,
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

			// Wait for immediate processing to complete (after setTimeout)
			await vi.advanceTimersByTimeAsync(0)
			await vi.waitFor(() => {
				expect(mockQueue.updateEventAfterRetry).toHaveBeenCalled()
			})

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

			// Wait for immediate processing to complete (after setTimeout)
			await vi.advanceTimersByTimeAsync(0)
			await vi.waitFor(() => {
				expect(mockQueue.updateEventAfterRetry).toHaveBeenCalled()
			})

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

			// Wait for immediate processing to complete (after setTimeout)
			await vi.advanceTimersByTimeAsync(0)
			await vi.waitFor(() => {
				expect(connectionStatusCallback).toHaveBeenCalled()
			})

			expect(connectionStatusCallback).toHaveBeenCalledWith(false)

			// Reset mocks for next iteration
			connectionStatusCallback.mockClear()
			mockQueue.getEventsForRetry.mockClear()
			mockQueue.updateEventAfterRetry.mockClear()
			sendEventMock.mockClear()

			// Now succeed - mock the send to succeed this time
			sendEventMock.mockResolvedValue(undefined)

			// Set up the queue to return the same event again
			mockQueue.getEventsForRetry.mockResolvedValue(events)

			await vi.advanceTimersByTimeAsync(30000)

			// Wait for the processing to complete
			await vi.waitFor(() => {
				expect(mockQueue.updateEventAfterRetry).toHaveBeenCalled()
			})

			// Now check that connection status was updated
			expect(connectionStatusCallback).toHaveBeenCalledWith(true)
		})

		it("should prune failed events", async () => {
			mockQueue.pruneFailedEvents.mockResolvedValue(3)

			retryManager.start()

			// Wait for immediate processing to complete (after setTimeout)
			await vi.advanceTimersByTimeAsync(0)
			await vi.waitFor(() => {
				expect(mockQueue.pruneFailedEvents).toHaveBeenCalled()
			})

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
				if (event.event === TelemetryEventName.TELEMETRY_CONNECTION_CHECK) {
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

			// Wait for immediate processing to complete (after setTimeout)
			await vi.advanceTimersByTimeAsync(0)
			await vi.waitFor(() => {
				expect(mockQueue.getEventsForRetry).toHaveBeenCalled()
			})

			// Clear previous calls from immediate processing
			sendEventMock.mockClear()
			mockQueue.getEventsForRetry.mockClear()

			// Advance past connection check interval (1 minute + 30s)
			await vi.advanceTimersByTimeAsync(90000)

			// Should have sent a connection check event
			expect(sendEventMock).toHaveBeenCalledWith(
				expect.objectContaining({
					event: TelemetryEventName.TELEMETRY_CONNECTION_CHECK,
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

			// Wait for immediate processing to complete (after setTimeout)
			await vi.advanceTimersByTimeAsync(0)
			await vi.waitFor(() => {
				expect(connectionStatusCallback).toHaveBeenCalled()
			})

			// Connection should already be marked as disconnected from immediate processing
			expect(connectionStatusCallback).toHaveBeenCalledWith(false)
		})
	})
})
