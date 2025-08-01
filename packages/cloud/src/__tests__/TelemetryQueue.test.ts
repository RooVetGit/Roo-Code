// npx vitest run src/__tests__/TelemetryQueue.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TelemetryQueue } from "../TelemetryQueue"
import { TelemetryEvent, TelemetryEventName } from "@roo-code/types"
import * as vscode from "vscode"

// Mock vscode module
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	Memento: vi.fn(),
	commands: {
		executeCommand: vi.fn(),
	},
}))

describe("TelemetryQueue", () => {
	let mockContext: vscode.ExtensionContext
	let mockGlobalState: {
		get: ReturnType<typeof vi.fn>
		update: ReturnType<typeof vi.fn>
	}
	let queue: TelemetryQueue

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()

		// Mock globalState
		mockGlobalState = {
			get: vi.fn().mockReturnValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
		}

		// Mock context
		mockContext = {
			globalState: mockGlobalState,
		} as any

		// Clear any existing intervals/timeouts
		vi.clearAllTimers()

		queue = new TelemetryQueue(mockContext as any)
	})

	afterEach(() => {
		queue.dispose()
		vi.useRealTimers()
	})

	describe("enqueue", () => {
		it("should add a valid event to the queue", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { test: true },
			}

			await queue.enqueue(event)

			expect(mockGlobalState.update).toHaveBeenCalledWith(
				"telemetryQueueState",
				expect.objectContaining({
					events: expect.arrayContaining([
						expect.objectContaining({
							event,
							retryCount: 0,
							timestamp: expect.any(Number),
						}),
					]),
				}),
			)
		})

		it("should not exceed max queue size", async () => {
			// Mock initial state
			mockGlobalState.get.mockReturnValue({
				events: [],
				connectionStatus: "online",
				lastConnectionCheck: Date.now(),
			})

			// Fill queue to max size
			const events = Array.from({ length: 1000 }, (_, i) => ({
				event: TelemetryEventName.TASK_MESSAGE,
				properties: { index: i },
			}))

			for (const event of events) {
				await queue.enqueue(event)
			}

			// Try to add one more
			await queue.enqueue({ event: TelemetryEventName.TASK_MESSAGE, properties: {} })

			// Check that queue size is still at max
			const lastCall = mockGlobalState.update.mock.calls[mockGlobalState.update.mock.calls.length - 1]
			const savedState = lastCall[1]
			expect(savedState.events).toHaveLength(1000)

			// Verify oldest event was removed (FIFO)
			expect(savedState.events[0].event.event).toBe(TelemetryEventName.TASK_MESSAGE)
			expect(savedState.events[savedState.events.length - 1].event.event).toBe(TelemetryEventName.TASK_MESSAGE)
		})

		it("should accept any event structure", async () => {
			const invalidEvent = {
				// Missing 'event' field
				properties: { test: true },
			}

			await queue.enqueue(invalidEvent as unknown as TelemetryEvent)

			// Should still update state even for structurally invalid events
			expect(mockGlobalState.update).toHaveBeenCalledWith(
				"telemetryQueueState",
				expect.objectContaining({
					events: expect.arrayContaining([
						expect.objectContaining({
							event: invalidEvent,
							retryCount: 0,
							timestamp: expect.any(Number),
						}),
					]),
				}),
			)
		})
	})

	describe("processQueue", () => {
		it("should process queued events successfully", async () => {
			const events = [
				{
					event: { event: TelemetryEventName.TASK_CREATED, properties: {} },
					timestamp: Date.now(),
					retryCount: 0,
				},
				{
					event: { event: TelemetryEventName.TASK_COMPLETED, properties: {} },
					timestamp: Date.now(),
					retryCount: 0,
				},
			]

			mockGlobalState.get.mockReturnValue({
				events,
				connectionStatus: "online",
				lastConnectionCheck: Date.now(),
			})

			// Create new queue to load the mocked state
			queue = new TelemetryQueue(mockContext as any)

			const sendFunction = vi.fn().mockResolvedValue(true)

			await queue.processQueue(sendFunction)

			expect(sendFunction).toHaveBeenCalledTimes(2)
			expect(mockGlobalState.update).toHaveBeenCalledWith(
				"telemetryQueueState",
				expect.objectContaining({
					events: [], // All events processed successfully
				}),
			)
		})

		it("should handle failed events with retry", async () => {
			const event = {
				event: { event: TelemetryEventName.TASK_CREATED, properties: {} },
				timestamp: Date.now(),
				retryCount: 0,
			}

			mockGlobalState.get.mockReturnValue({
				events: [event],
				connectionStatus: "online",
				lastConnectionCheck: Date.now(),
			})

			// Create new queue to load the mocked state
			queue = new TelemetryQueue(mockContext as any)

			const sendFunction = vi.fn().mockResolvedValue(false)

			await queue.processQueue(sendFunction)

			expect(mockGlobalState.update).toHaveBeenCalledWith(
				"telemetryQueueState",
				expect.objectContaining({
					events: expect.arrayContaining([
						expect.objectContaining({
							retryCount: 1,
							lastRetryTimestamp: expect.any(Number),
						}),
					]),
				}),
			)
		})

		it("should drop events that exceed max retries", async () => {
			const event = {
				event: { event: TelemetryEventName.TASK_CREATED, properties: {} },
				timestamp: Date.now(),
				retryCount: 4, // One less than max
			}

			mockGlobalState.get.mockReturnValue({
				events: [event],
				connectionStatus: "online",
				lastConnectionCheck: Date.now(),
			})

			// Create new queue to load the mocked state
			queue = new TelemetryQueue(mockContext as any)

			const sendFunction = vi.fn().mockResolvedValue(false)

			await queue.processQueue(sendFunction)

			// Event should be dropped after this retry
			expect(mockGlobalState.update).toHaveBeenCalledWith(
				"telemetryQueueState",
				expect.objectContaining({
					events: [], // Event dropped due to max retries
				}),
			)
		})

		it("should drop expired events", async () => {
			// Add a fresh event first
			await queue.enqueue({ event: TelemetryEventName.TASK_CREATED, properties: {} })

			// Mock the queue state to have an old timestamp
			const currentState = mockGlobalState.update.mock.calls[0][1]
			currentState.events[0].timestamp = Date.now() - 8 * 24 * 60 * 60 * 1000 // 8 days old

			mockGlobalState.get.mockReturnValue(currentState)

			// Create new queue to test processQueue with expired event
			queue = new TelemetryQueue(mockContext as any)

			const sendFunction = vi.fn()

			await queue.processQueue(sendFunction)

			expect(sendFunction).not.toHaveBeenCalled()

			// The queue should be empty after processing (expired event dropped)
			expect(queue.getQueueSize()).toBe(0)
		})
	})

	describe("updateConnectionStatus", () => {
		it("should update connection status and emit event", async () => {
			await queue.updateConnectionStatus(false)

			expect(mockGlobalState.update).toHaveBeenCalledWith(
				"telemetryQueueState",
				expect.objectContaining({
					connectionStatus: "offline",
					lastConnectionCheck: expect.any(Number),
				}),
			)

			expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
				"roo-code.telemetryConnectionStatusChanged",
				"offline",
			)
		})

		it("should not emit event if status unchanged", async () => {
			mockGlobalState.get.mockReturnValue({
				events: [],
				connectionStatus: "online",
				lastConnectionCheck: Date.now(),
			})

			const newQueue = new TelemetryQueue(mockContext as any)
			await newQueue.updateConnectionStatus(true)

			expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
				"roo-code.telemetryConnectionStatusChanged",
				expect.anything(),
			)

			newQueue.dispose()
		})
	})

	describe("getConnectionStatus", () => {
		it("should return current connection status", () => {
			mockGlobalState.get.mockReturnValue({
				events: [],
				connectionStatus: "offline",
				lastConnectionCheck: Date.now(),
			})

			const newQueue = new TelemetryQueue(mockContext as any)
			expect(newQueue.getConnectionStatus()).toBe("offline")
			newQueue.dispose()
		})
	})

	describe("getQueueSize", () => {
		it("should return 0 for empty queue", () => {
			expect(queue.getQueueSize()).toBe(0)
		})

		it("should return correct queue size", () => {
			mockGlobalState.get.mockReturnValue({
				events: [
					{ event: { event: TelemetryEventName.TASK_CREATED }, retryCount: 0, timestamp: Date.now() },
					{ event: { event: TelemetryEventName.TASK_COMPLETED }, retryCount: 0, timestamp: Date.now() },
				],
				connectionStatus: "online",
				lastConnectionCheck: Date.now(),
			})

			const newQueue = new TelemetryQueue(mockContext as any)
			expect(newQueue.getQueueSize()).toBe(2)
			newQueue.dispose()
		})
	})

	describe("clearQueue", () => {
		it("should clear all queued events", async () => {
			await queue.clearQueue()

			expect(mockGlobalState.update).toHaveBeenCalledWith(
				"telemetryQueueState",
				expect.objectContaining({
					events: [],
				}),
			)
		})
	})

	describe("persistence", () => {
		it("should load existing queue from storage on initialization", () => {
			const existingState = {
				events: [
					{
						event: { event: TelemetryEventName.TASK_CREATED, properties: {} },
						retryCount: 2,
						timestamp: Date.now(),
					},
				],
				connectionStatus: "offline" as const,
				lastConnectionCheck: Date.now(),
			}
			mockGlobalState.get.mockReturnValue(existingState)

			const newQueue = new TelemetryQueue(mockContext as any)
			expect(newQueue.getQueueSize()).toBe(1)
			expect(newQueue.getConnectionStatus()).toBe("offline")
			newQueue.dispose()
		})

		it("should filter out expired events on load", () => {
			const now = Date.now()
			const existingState = {
				events: [
					{
						event: { event: TelemetryEventName.TASK_CREATED, properties: {} },
						retryCount: 0,
						timestamp: now - 8 * 24 * 60 * 60 * 1000, // 8 days old
					},
					{
						event: { event: TelemetryEventName.TASK_CREATED, properties: {} },
						retryCount: 0,
						timestamp: now - 1000, // Recent
					},
				],
				connectionStatus: "online" as const,
				lastConnectionCheck: now,
			}
			mockGlobalState.get.mockReturnValue(existingState)

			const newQueue = new TelemetryQueue(mockContext as any)
			expect(newQueue.getQueueSize()).toBe(1) // Only recent event remains
			newQueue.dispose()
		})
	})

	describe("connection monitoring", () => {
		it("should start connection monitoring on initialization", () => {
			// Fast-forward time to trigger the interval
			vi.advanceTimersByTime(30000)

			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("roo-code.checkTelemetryConnection")
		})
	})

	describe("retry scheduling", () => {
		it("should schedule retry for failed events", async () => {
			// Enqueue an event
			await queue.enqueue({ event: TelemetryEventName.TASK_CREATED, properties: {} })

			const sendFunction = vi.fn().mockResolvedValue(false)

			await queue.processQueue(sendFunction)

			// Verify that a retry was scheduled
			expect(sendFunction).toHaveBeenCalledTimes(1)

			// Check that the queue still has the failed event
			expect(queue.getQueueSize()).toBe(1)

			// Clear previous calls from initialization and processing
			vi.mocked(vscode.commands.executeCommand).mockClear()

			// Since this is the first retry (retryCount = 1 after failure),
			// the delay is 1000ms * 2^1 = 2000ms, with ±25% jitter
			// So it could be anywhere from 1500ms to 2500ms
			// Let's advance by the max possible delay to ensure the timer fires
			vi.advanceTimersByTime(2500)

			expect(vscode.commands.executeCommand).toHaveBeenCalledWith("roo-code.processTelemetryQueue")
		})
	})
})
