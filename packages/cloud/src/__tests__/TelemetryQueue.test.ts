import { describe, it, expect, beforeEach, vi } from "vitest"
import * as vscode from "vscode"
import { TelemetryQueue } from "../TelemetryQueue"
import { TelemetryEventName, type RooCodeTelemetryEvent } from "@roo-code/types"

// Mock vscode
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
}))

describe("TelemetryQueue", () => {
	let mockContext: vscode.ExtensionContext
	let mockGlobalState: Map<string, unknown>
	let queue: TelemetryQueue

	const createMockEvent = (type: TelemetryEventName = TelemetryEventName.TASK_CREATED): RooCodeTelemetryEvent => {
		const baseProperties = {
			appName: "test-app",
			appVersion: "1.0.0",
			vscodeVersion: "1.0.0",
			platform: "test-platform",
			editorName: "test-editor",
			language: "en",
			mode: "test",
		}

		// Handle special event types that require additional properties
		if (type === TelemetryEventName.TASK_MESSAGE) {
			return {
				type: TelemetryEventName.TASK_MESSAGE,
				properties: {
					...baseProperties,
					taskId: "test-task-id",
					message: {
						ts: Date.now(),
						type: "say",
						say: "text",
						text: "test message",
					},
				},
			}
		} else if (type === TelemetryEventName.LLM_COMPLETION) {
			return {
				type: TelemetryEventName.LLM_COMPLETION,
				properties: {
					...baseProperties,
					inputTokens: 100,
					outputTokens: 200,
				},
			}
		}

		// For all other event types
		return {
			type: type as TelemetryEventName, // Type assertion needed due to discriminated union
			properties: baseProperties,
		} as RooCodeTelemetryEvent
	}

	beforeEach(() => {
		// Reset mocks
		mockGlobalState = new Map()

		mockContext = {
			globalState: {
				get: vi.fn((key: string) => mockGlobalState.get(key)),
				update: vi.fn(async (key: string, value: unknown) => {
					mockGlobalState.set(key, value)
				}),
			},
		} as unknown as vscode.ExtensionContext

		queue = new TelemetryQueue(mockContext, false)
	})

	describe("enqueue", () => {
		it("should add an event to the queue", async () => {
			const event = createMockEvent()

			await queue.enqueue(event)

			const size = await queue.size()
			expect(size).toBe(1)

			const peeked = await queue.peek()
			expect(peeked).toBeDefined()
			expect(peeked?.event).toEqual(event)
			expect(peeked?.retryCount).toBe(0)
			expect(peeked?.timestamp).toBeGreaterThan(0)
			expect(peeked?.id).toBeDefined()
		})

		it("should maintain FIFO order", async () => {
			const event1 = createMockEvent(TelemetryEventName.TASK_CREATED)
			const event2 = createMockEvent(TelemetryEventName.TASK_COMPLETED)
			const event3 = createMockEvent(TelemetryEventName.MODE_SWITCH)

			await queue.enqueue(event1)
			await queue.enqueue(event2)
			await queue.enqueue(event3)

			const all = await queue.getAll()
			expect(all).toHaveLength(3)
			expect(all[0].event.type).toBe(TelemetryEventName.TASK_CREATED)
			expect(all[1].event.type).toBe(TelemetryEventName.TASK_COMPLETED)
			expect(all[2].event.type).toBe(TelemetryEventName.MODE_SWITCH)
		})

		it("should drop oldest event when queue is full", async () => {
			// Set up a smaller queue for testing
			const smallQueue = new TelemetryQueue(mockContext, false)
			// Override the max size for testing
			const originalMaxSize = (TelemetryQueue as unknown as { MAX_QUEUE_SIZE: number }).MAX_QUEUE_SIZE
			;(TelemetryQueue as unknown as { MAX_QUEUE_SIZE: number }).MAX_QUEUE_SIZE = 3

			try {
				// Fill the queue
				await smallQueue.enqueue(createMockEvent(TelemetryEventName.TASK_CREATED))
				await smallQueue.enqueue(createMockEvent(TelemetryEventName.TASK_COMPLETED))
				await smallQueue.enqueue(createMockEvent(TelemetryEventName.MODE_SWITCH))

				// Add one more - should drop the first
				await smallQueue.enqueue(createMockEvent(TelemetryEventName.TOOL_USED))

				const all = await smallQueue.getAll()
				expect(all).toHaveLength(3)
				expect(all[0].event.type).toBe(TelemetryEventName.TASK_COMPLETED)
				expect(all[1].event.type).toBe(TelemetryEventName.MODE_SWITCH)
				expect(all[2].event.type).toBe(TelemetryEventName.TOOL_USED)
			} finally {
				// Restore original max size
				;(TelemetryQueue as unknown as { MAX_QUEUE_SIZE: number }).MAX_QUEUE_SIZE = originalMaxSize
			}
		})
	})

	describe("dequeue", () => {
		it("should remove a specific event from the queue", async () => {
			const event1 = createMockEvent(TelemetryEventName.TASK_CREATED)
			const event2 = createMockEvent(TelemetryEventName.TASK_COMPLETED)

			await queue.enqueue(event1)
			await queue.enqueue(event2)

			const peeked = await queue.peek()
			expect(peeked).toBeDefined()

			await queue.dequeue(peeked!.id)

			const size = await queue.size()
			expect(size).toBe(1)

			const newPeeked = await queue.peek()
			expect(newPeeked?.event.type).toBe(TelemetryEventName.TASK_COMPLETED)
		})

		it("should handle dequeuing non-existent event gracefully", async () => {
			await queue.enqueue(createMockEvent())

			await queue.dequeue("non-existent-id")

			const size = await queue.size()
			expect(size).toBe(1)
		})
	})

	describe("markFailed", () => {
		it("should increment retry count and move event to end of queue", async () => {
			const event1 = createMockEvent(TelemetryEventName.TASK_CREATED)
			const event2 = createMockEvent(TelemetryEventName.TASK_COMPLETED)

			await queue.enqueue(event1)
			await queue.enqueue(event2)

			const firstEvent = await queue.peek()
			expect(firstEvent).toBeDefined()

			await queue.markFailed(firstEvent!.id)

			const all = await queue.getAll()
			expect(all).toHaveLength(2)
			expect(all[0].event.type).toBe(TelemetryEventName.TASK_COMPLETED)
			expect(all[1].event.type).toBe(TelemetryEventName.TASK_CREATED)
			expect(all[1].retryCount).toBe(1)
		})

		it("should remove event after max retries", async () => {
			const event = createMockEvent()
			await queue.enqueue(event)

			const peeked = await queue.peek()
			expect(peeked).toBeDefined()

			// Override max retry count for testing
			const originalMaxRetry = (TelemetryQueue as unknown as { MAX_RETRY_COUNT: number }).MAX_RETRY_COUNT
			;(TelemetryQueue as unknown as { MAX_RETRY_COUNT: number }).MAX_RETRY_COUNT = 2

			try {
				// Fail twice - should still be in queue
				await queue.markFailed(peeked!.id)
				expect(await queue.size()).toBe(1)

				const peeked2 = await queue.peek()
				await queue.markFailed(peeked2!.id)

				// Third failure should remove it
				expect(await queue.size()).toBe(0)
			} finally {
				// Restore original max retry
				;(TelemetryQueue as unknown as { MAX_RETRY_COUNT: number }).MAX_RETRY_COUNT = originalMaxRetry
			}
		})

		it("should handle marking non-existent event as failed gracefully", async () => {
			await queue.enqueue(createMockEvent())

			await queue.markFailed("non-existent-id")

			const size = await queue.size()
			expect(size).toBe(1)
		})
	})

	describe("peek", () => {
		it("should return null for empty queue", async () => {
			const peeked = await queue.peek()
			expect(peeked).toBeNull()
		})

		it("should return first event without removing it", async () => {
			const event = createMockEvent()
			await queue.enqueue(event)

			const peeked1 = await queue.peek()
			const peeked2 = await queue.peek()

			expect(peeked1).toEqual(peeked2)
			expect(await queue.size()).toBe(1)
		})
	})

	describe("clear", () => {
		it("should remove all events from the queue", async () => {
			await queue.enqueue(createMockEvent())
			await queue.enqueue(createMockEvent())
			await queue.enqueue(createMockEvent())

			expect(await queue.size()).toBe(3)

			await queue.clear()

			expect(await queue.size()).toBe(0)
			expect(await queue.peek()).toBeNull()
		})
	})

	describe("processing state", () => {
		it("should track processing state correctly", () => {
			expect(queue.isProcessingQueue()).toBe(false)

			queue.setProcessingState(true)
			expect(queue.isProcessingQueue()).toBe(true)

			queue.setProcessingState(false)
			expect(queue.isProcessingQueue()).toBe(false)
		})
	})

	describe("persistence", () => {
		it("should persist queue to global state", async () => {
			const event = createMockEvent()
			await queue.enqueue(event)

			// Create a new queue instance with same context
			const newQueue = new TelemetryQueue(mockContext, false)

			const size = await newQueue.size()
			expect(size).toBe(1)

			const peeked = await newQueue.peek()
			expect(peeked?.event).toEqual(event)
		})

		it("should handle corrupted state gracefully", async () => {
			// Corrupt the state with a non-array value
			mockGlobalState.set("rooCode.telemetryQueue", "invalid-json")

			// Track if update was called to reset the corrupted state
			let updateCalled = false

			// Update the mock to return the corrupted value initially, then the updated value
			mockContext.globalState.get = vi.fn((key: string) => {
				if (key === "rooCode.telemetryQueue") {
					// After update is called, return the actual value from mockGlobalState
					if (updateCalled) {
						return mockGlobalState.get(key)
					}
					return "invalid-json" // Return non-array value initially
				}
				return mockGlobalState.get(key)
			})

			// Track when update is called
			const originalUpdate = mockContext.globalState.update
			mockContext.globalState.update = vi.fn(async (key: string, value: unknown) => {
				updateCalled = true
				await originalUpdate(key, value)
			})

			// Create a new queue instance that will try to read the corrupted state
			const corruptedQueue = new TelemetryQueue(mockContext, false)

			const size = await corruptedQueue.size()
			expect(size).toBe(0)

			// Should still be able to add events
			await corruptedQueue.enqueue(createMockEvent())
			expect(await corruptedQueue.size()).toBe(1)
		})
	})

	describe("error handling", () => {
		it("should handle globalState.get errors gracefully", async () => {
			mockContext.globalState.get = vi.fn(() => {
				throw new Error("Storage error")
			})

			const size = await queue.size()
			expect(size).toBe(0)
		})

		it("should handle globalState.update errors gracefully", async () => {
			mockContext.globalState.update = vi.fn(() => {
				throw new Error("Storage error")
			})

			// Should not throw
			await expect(queue.enqueue(createMockEvent())).resolves.not.toThrow()
		})
	})
})
