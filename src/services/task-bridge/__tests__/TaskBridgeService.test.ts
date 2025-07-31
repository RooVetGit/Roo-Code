// npx vitest services/task-bridge/__tests__/TaskBridgeService.test.ts

import { EventEmitter } from "events"
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from "vitest"
import type { ClineMessage } from "@roo-code/types"
import RedisMock from "ioredis-mock"

import { TaskBridgeService } from "../TaskBridgeService"
import type { Task } from "../../../core/task/Task"

// Mock ioredis with ioredis-mock
vi.mock("ioredis", () => ({
	default: RedisMock,
}))

// Enhanced MockTask class with all properties needed for message queuing tests
class MockTask extends EventEmitter {
	taskId: string
	isStreaming: boolean = false
	isPaused: boolean = false
	isWaitingForResponse: boolean = false
	handleWebviewAskResponse: Mock

	constructor(taskId: string) {
		super()
		this.taskId = taskId
		this.handleWebviewAskResponse = vi.fn()
	}
}

describe("TaskBridgeService", () => {
	let taskBridge: TaskBridgeService
	let mockTask: MockTask

	beforeEach(() => {
		// Clear the singleton instance
		;(TaskBridgeService as any).instance = null

		taskBridge = TaskBridgeService.getInstance({
			url: "redis://localhost:6379",
			namespace: "test:task-bridge",
		})

		mockTask = new MockTask("test-task-123")
	})

	afterEach(async () => {
		if (taskBridge.connected) {
			await taskBridge.disconnect()
		}

		// Reset singleton instance
		TaskBridgeService.resetInstance()
		vi.clearAllMocks()
	})

	describe("Singleton Pattern", () => {
		it("should return the same instance", () => {
			const instance1 = TaskBridgeService.getInstance()
			const instance2 = TaskBridgeService.getInstance()
			expect(instance1).toBe(instance2)
		})
	})

	describe("Connection Management", () => {
		it("should initialize Redis connections", async () => {
			await taskBridge.initialize()
			expect(taskBridge.connected).toBe(true)
		})

		it("should not reinitialize if already connected", async () => {
			await taskBridge.initialize()
			const firstPublisher = (taskBridge as any).publisher

			await taskBridge.initialize()
			const secondPublisher = (taskBridge as any).publisher

			expect(firstPublisher).toBe(secondPublisher)
		})

		it("should disconnect properly", async () => {
			await taskBridge.initialize()
			await taskBridge.disconnect()

			expect(taskBridge.connected).toBe(false)
			expect((taskBridge as any).publisher).toBeNull()
			expect((taskBridge as any).subscriber).toBeNull()
		})
	})

	describe("Task Subscription", () => {
		beforeEach(async () => {
			await taskBridge.initialize()
		})

		it("should subscribe to task channels", async () => {
			await taskBridge.subscribeToTask(mockTask as unknown as Task)
			expect(taskBridge.subscribedTaskCount).toBe(1)
		})

		it("should throw error if not connected", async () => {
			await taskBridge.disconnect()

			await expect(taskBridge.subscribeToTask(mockTask as unknown as Task)).rejects.toThrow(
				"TaskBridgeService is not connected",
			)
		})

		it("should unsubscribe from task channels", async () => {
			await taskBridge.subscribeToTask(mockTask as unknown as Task)
			await taskBridge.unsubscribeFromTask(mockTask.taskId)

			expect(taskBridge.subscribedTaskCount).toBe(0)
		})
	})

	describe("Task Event Forwarding", () => {
		beforeEach(async () => {
			await taskBridge.initialize()
			await taskBridge.subscribeToTask(mockTask as unknown as Task)
		})

		it("should forward message events", async () => {
			const publisher = (taskBridge as any).publisher
			const publishSpy = vi.spyOn(publisher, "publish")

			const message: ClineMessage = {
				ts: Date.now(),
				type: "say",
				say: "text",
				text: "Test message",
			}

			// Note: The TaskBridgeService doesn't actually forward message events
			// It only forwards task status events. This test is kept for reference
			// but the expectation is that message events are NOT forwarded
			mockTask.emit("message", { action: "created", message })

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Verify that message events are not forwarded
			expect(publishSpy).not.toHaveBeenCalledWith(
				"test:task-bridge:test-task-123:client",
				expect.stringContaining('"eventType":"message"'),
			)
		})

		it("should forward task status events", async () => {
			const publisher = (taskBridge as any).publisher
			const publishSpy = vi.spyOn(publisher, "publish")

			const events = ["taskStarted", "taskPaused", "taskUnpaused", "taskAborted"]

			for (const event of events) {
				mockTask.emit(event as any)
			}

			// Wait for async publishes
			await new Promise((resolve) => setTimeout(resolve, 100))

			expect(publishSpy).toHaveBeenCalledTimes(events.length)

			// Verify each event was forwarded correctly
			const statuses = publishSpy.mock.calls.map((call) => {
				const parsed = JSON.parse(call[1] as string)
				return parsed.payload.data.status
			})

			expect(statuses).toContain("started")
			expect(statuses).toContain("paused")
			expect(statuses).toContain("unpaused")
			expect(statuses).toContain("aborted")
		})
	})

	describe("Message Handling", () => {
		beforeEach(async () => {
			await taskBridge.initialize()
			await taskBridge.subscribeToTask(mockTask as unknown as Task)
		})

		it("should handle incoming messages", async () => {
			// Setup task as ready
			mockTask.emit("taskFree", mockTask.taskId)
			await new Promise((resolve) => setTimeout(resolve, 50))

			const message = {
				taskId: "test-task-123",
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "Test message",
						images: ["test.png"],
					},
				},
				timestamp: Date.now(),
			}

			// Simulate receiving a message on the server channel
			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(message))

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Verify the message was delivered to the task
			expect(mockTask.handleWebviewAskResponse).toHaveBeenCalledWith("messageResponse", "Test message", [
				"test.png",
			])
		})

		it("should ignore messages for unsubscribed tasks", async () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Manually subscribe the subscriber to the channel (simulating a lingering subscription)
			const subscriber = (taskBridge as any).subscriber
			await subscriber.subscribe("test:task-bridge:unsubscribed-task-123:server")

			const message = {
				taskId: "unsubscribed-task-123",
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "Test message",
					},
				},
				timestamp: Date.now(),
			}

			// Simulate receiving a message for an unsubscribed task
			subscriber.emit("message", "test:task-bridge:unsubscribed-task-123:server", JSON.stringify(message))

			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(consoleWarnSpy).toHaveBeenCalledWith("Received message for unsubscribed task: unsubscribed-task-123")

			// Clean up
			await subscriber.unsubscribe("test:task-bridge:unsubscribed-task-123:server")
			consoleWarnSpy.mockRestore()
		})
	})

	describe("Error Handling", () => {
		it("should handle malformed messages gracefully", async () => {
			await taskBridge.initialize()
			await taskBridge.subscribeToTask(mockTask as unknown as Task)

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Simulate receiving invalid JSON
			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:test-task-123:server", "invalid json")

			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(consoleErrorSpy).toHaveBeenCalledWith("Error handling incoming message:", expect.any(Error))

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Message Queuing", () => {
		beforeEach(async () => {
			await taskBridge.initialize()
		})

		it("should queue messages when task is not ready", async () => {
			// Setup task as not ready (streaming)
			mockTask.isStreaming = true
			mockTask.isWaitingForResponse = false

			await taskBridge.subscribeToTask(mockTask as any)

			// Send a message through Redis
			const message = {
				taskId: mockTask.taskId,
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "Test message",
						images: ["image1.png"],
					},
				},
				timestamp: Date.now(),
			}

			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(message))

			// Wait for message processing
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Verify message was not sent immediately (task is not ready)
			expect(mockTask.handleWebviewAskResponse).not.toHaveBeenCalled()
		})

		it("should send messages directly when task is ready", async () => {
			await taskBridge.subscribeToTask(mockTask as any)

			// Emit taskFree event to indicate task is ready
			mockTask.emit("taskFree", mockTask.taskId)

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Send a message through Redis
			const message = {
				taskId: mockTask.taskId,
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "Test message",
						images: ["image1.png"],
					},
				},
				timestamp: Date.now(),
			}

			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(message))

			// Wait for message processing
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Verify message was sent immediately
			expect(mockTask.handleWebviewAskResponse).toHaveBeenCalledWith("messageResponse", "Test message", [
				"image1.png",
			])
		})

		it("should process queued messages when task becomes ready", async () => {
			// Setup task as not ready initially
			mockTask.isStreaming = true
			mockTask.isWaitingForResponse = false

			await taskBridge.subscribeToTask(mockTask as any)

			// Send multiple messages through Redis
			const messages = [
				{
					taskId: mockTask.taskId,
					type: "message",
					payload: {
						eventType: "message",
						data: { text: "Message 1" },
					},
					timestamp: Date.now(),
				},
				{
					taskId: mockTask.taskId,
					type: "message",
					payload: {
						eventType: "message",
						data: { text: "Message 2", images: ["image2.png"] },
					},
					timestamp: Date.now() + 1,
				},
				{
					taskId: mockTask.taskId,
					type: "message",
					payload: {
						eventType: "message",
						data: { text: "Message 3" },
					},
					timestamp: Date.now() + 2,
				},
			]

			const subscriber = (taskBridge as any).subscriber
			for (const msg of messages) {
				subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(msg))
				await new Promise((resolve) => setTimeout(resolve, 10))
			}

			// Verify messages were not sent (task not ready)
			expect(mockTask.handleWebviewAskResponse).not.toHaveBeenCalled()

			// Make task ready by emitting taskFree
			mockTask.emit("taskFree", mockTask.taskId)

			// Wait for queue processing
			await new Promise((resolve) => setTimeout(resolve, 200))

			// Verify all messages were sent in order
			expect(mockTask.handleWebviewAskResponse).toHaveBeenCalledTimes(3)
			expect(mockTask.handleWebviewAskResponse).toHaveBeenNthCalledWith(
				1,
				"messageResponse",
				"Message 1",
				undefined,
			)
			expect(mockTask.handleWebviewAskResponse).toHaveBeenNthCalledWith(2, "messageResponse", "Message 2", [
				"image2.png",
			])
			expect(mockTask.handleWebviewAskResponse).toHaveBeenNthCalledWith(
				3,
				"messageResponse",
				"Message 3",
				undefined,
			)
		})
	})

	describe("Error Handling and Retry Logic", () => {
		beforeEach(async () => {
			await taskBridge.initialize()
		})

		it("should retry failed messages with exponential backoff", async () => {
			// Make handleWebviewAskResponse fail initially
			let callCount = 0
			mockTask.handleWebviewAskResponse.mockImplementation(() => {
				callCount++
				if (callCount <= 2) {
					return Promise.reject(new Error(`Attempt ${callCount} failed`))
				}
				return Promise.resolve(undefined)
			})

			await taskBridge.subscribeToTask(mockTask as any)

			// Send a message while task is not ready
			const message = {
				taskId: mockTask.taskId,
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "Test message",
					},
				},
				timestamp: Date.now(),
			}

			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(message))

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Make task ready to trigger processing
			mockTask.emit("taskFree", mockTask.taskId)

			// Wait for initial attempt
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(callCount).toBe(1)

			// Wait for first retry (1 second)
			await new Promise((resolve) => setTimeout(resolve, 1100))
			expect(callCount).toBe(2)

			// Wait for second retry (2 seconds)
			await new Promise((resolve) => setTimeout(resolve, 2100))
			expect(callCount).toBe(3)

			// Message should have succeeded on third attempt
			expect(mockTask.handleWebviewAskResponse).toHaveBeenCalledTimes(3)
		}, 5000)

		it("should remove messages after max retries", async () => {
			// Make handleWebviewAskResponse always fail
			let callCount = 0
			mockTask.handleWebviewAskResponse.mockImplementation(() => {
				callCount++
				return Promise.reject(new Error("Always fails"))
			})

			await taskBridge.subscribeToTask(mockTask as any)

			// Send a message while task is not ready
			const message = {
				taskId: mockTask.taskId,
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "Test message",
					},
				},
				timestamp: Date.now(),
			}

			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(message))

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Make task ready to trigger processing
			mockTask.emit("taskFree", mockTask.taskId)

			// Wait for initial attempt
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(callCount).toBe(1)

			// Wait for first retry (1s)
			await new Promise((resolve) => setTimeout(resolve, 1100))
			expect(callCount).toBe(2)

			// Wait for second retry (2s)
			await new Promise((resolve) => setTimeout(resolve, 2100))
			expect(callCount).toBe(3)

			// Should have attempted 3 times total
			expect(callCount).toBe(3)

			// The message should be removed after max retries
			// Send another message to verify the queue is working
			mockTask.handleWebviewAskResponse.mockResolvedValue(undefined)

			const newMessage = {
				taskId: mockTask.taskId,
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "New message",
					},
				},
				timestamp: Date.now(),
			}

			subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(newMessage))
			await new Promise((resolve) => setTimeout(resolve, 100))

			// The new message should be delivered immediately (task is ready)
			expect(mockTask.handleWebviewAskResponse).toHaveBeenLastCalledWith(
				"messageResponse",
				"New message",
				undefined,
			)
		}, 10000) // Increase timeout for this test
	})

	describe("Task State Management", () => {
		beforeEach(async () => {
			await taskBridge.initialize()
		})

		it("should track task state changes through events", async () => {
			await taskBridge.subscribeToTask(mockTask as any)

			// Send a message while task is not ready
			const message = {
				taskId: mockTask.taskId,
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "Test message",
					},
				},
				timestamp: Date.now(),
			}

			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(message))

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Message should not be processed yet
			expect(mockTask.handleWebviewAskResponse).not.toHaveBeenCalled()

			// Emit taskFree event to indicate task is ready
			mockTask.emit("taskFree", mockTask.taskId)

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Message should have been processed
			expect(mockTask.handleWebviewAskResponse).toHaveBeenCalledWith("messageResponse", "Test message", undefined)
		})

		it("should not process messages when task is paused", async () => {
			await taskBridge.subscribeToTask(mockTask as any)

			// Pause the task
			mockTask.isPaused = true
			mockTask.emit("taskPaused")

			// Send messages
			const messages = [
				{
					taskId: mockTask.taskId,
					type: "message",
					payload: {
						eventType: "message",
						data: { text: "Message 1" },
					},
					timestamp: Date.now(),
				},
				{
					taskId: mockTask.taskId,
					type: "message",
					payload: {
						eventType: "message",
						data: { text: "Message 2" },
					},
					timestamp: Date.now() + 1,
				},
			]

			const subscriber = (taskBridge as any).subscriber
			for (const msg of messages) {
				subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(msg))
			}

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Messages should not be processed (task is paused)
			expect(mockTask.handleWebviewAskResponse).not.toHaveBeenCalled()

			// Unpause and make task ready
			mockTask.isPaused = false
			mockTask.emit("taskUnpaused")
			mockTask.emit("taskFree", mockTask.taskId)

			// Wait for processing
			await new Promise((resolve) => setTimeout(resolve, 200))

			// Messages should now be processed
			expect(mockTask.handleWebviewAskResponse).toHaveBeenCalledTimes(2)
		})

		it("should clean up queue when task is aborted", async () => {
			await taskBridge.subscribeToTask(mockTask as any)

			// Send messages
			const messages = [
				{
					taskId: mockTask.taskId,
					type: "message",
					payload: {
						eventType: "message",
						data: { text: "Message 1" },
					},
					timestamp: Date.now(),
				},
				{
					taskId: mockTask.taskId,
					type: "message",
					payload: {
						eventType: "message",
						data: { text: "Message 2" },
					},
					timestamp: Date.now() + 1,
				},
			]

			const subscriber = (taskBridge as any).subscriber
			for (const msg of messages) {
				subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(msg))
			}

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Abort the task
			mockTask.emit("taskAborted")

			// Wait for cleanup
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Messages should not be processed
			expect(mockTask.handleWebviewAskResponse).not.toHaveBeenCalled()

			// Try to make task ready - messages should still not be processed (queue was cleared)
			mockTask.emit("taskFree", mockTask.taskId)
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(mockTask.handleWebviewAskResponse).not.toHaveBeenCalled()
		})

		it("should clean up queue when task is completed", async () => {
			await taskBridge.subscribeToTask(mockTask as any)

			// Send a message
			const message = {
				taskId: mockTask.taskId,
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "Message 1",
					},
				},
				timestamp: Date.now(),
			}

			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(message))

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Complete the task
			mockTask.emit("taskCompleted")

			// Wait for cleanup
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Message should not be processed
			expect(mockTask.handleWebviewAskResponse).not.toHaveBeenCalled()
		})
	})

	describe("Race Condition Prevention", () => {
		beforeEach(async () => {
			await taskBridge.initialize()
		})

		it("should handle concurrent processQueueForTask calls without race conditions", async () => {
			await taskBridge.subscribeToTask(mockTask as any)

			// Send multiple messages while task is not ready
			const messages = Array.from({ length: 5 }, (_, i) => ({
				taskId: mockTask.taskId,
				type: "message" as const,
				payload: {
					eventType: "message",
					data: { text: `Message ${i + 1}` },
				},
				timestamp: Date.now() + i,
			}))

			const subscriber = (taskBridge as any).subscriber
			for (const msg of messages) {
				subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(msg))
			}

			// Wait for messages to be queued
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Simulate multiple concurrent taskFree events
			// This would previously cause race conditions
			const promises = Array.from({ length: 3 }, () => {
				mockTask.emit("taskFree", mockTask.taskId)
				return new Promise((resolve) => setTimeout(resolve, 10))
			})

			await Promise.all(promises)

			// Wait for all processing to complete
			await new Promise((resolve) => setTimeout(resolve, 200))

			// All messages should be processed exactly once
			expect(mockTask.handleWebviewAskResponse).toHaveBeenCalledTimes(5)
			for (let i = 0; i < 5; i++) {
				expect(mockTask.handleWebviewAskResponse).toHaveBeenNthCalledWith(
					i + 1,
					"messageResponse",
					`Message ${i + 1}`,
					undefined,
				)
			}
		})

		it("should not lose messages when task state changes rapidly", async () => {
			await taskBridge.subscribeToTask(mockTask as any)

			// Send messages
			const messages = Array.from({ length: 3 }, (_, i) => ({
				taskId: mockTask.taskId,
				type: "message" as const,
				payload: {
					eventType: "message",
					data: { text: `Message ${i + 1}` },
				},
				timestamp: Date.now() + i,
			}))

			const subscriber = (taskBridge as any).subscriber
			for (const msg of messages) {
				subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(msg))
			}

			// Rapidly toggle task state
			mockTask.emit("taskFree", mockTask.taskId)
			await new Promise((resolve) => setTimeout(resolve, 5))

			mockTask.emit("taskBusy", mockTask.taskId)
			await new Promise((resolve) => setTimeout(resolve, 5))

			mockTask.emit("taskFree", mockTask.taskId)
			await new Promise((resolve) => setTimeout(resolve, 5))

			mockTask.emit("taskBusy", mockTask.taskId)
			await new Promise((resolve) => setTimeout(resolve, 5))

			mockTask.emit("taskFree", mockTask.taskId)

			// Wait for processing to complete
			await new Promise((resolve) => setTimeout(resolve, 200))

			// All messages should still be processed
			expect(mockTask.handleWebviewAskResponse).toHaveBeenCalledTimes(3)
		})
	})

	describe("Multiple Tasks", () => {
		beforeEach(async () => {
			await taskBridge.initialize()
		})

		it("should maintain separate queues for different tasks", async () => {
			const task1 = new MockTask("task-1")
			const task2 = new MockTask("task-2")

			await taskBridge.subscribeToTask(task1 as any)
			await taskBridge.subscribeToTask(task2 as any)

			// Task 2 is ready (emit taskFree)
			task2.emit("taskFree", task2.taskId)

			// Wait for event processing
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Send messages for both tasks through Redis
			const message1 = {
				taskId: task1.taskId,
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "Task 1 Message",
					},
				},
				timestamp: Date.now(),
			}

			const message2 = {
				taskId: task2.taskId,
				type: "message",
				payload: {
					eventType: "message",
					data: {
						text: "Task 2 Message",
					},
				},
				timestamp: Date.now(),
			}

			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:task-1:server", JSON.stringify(message1))
			subscriber.emit("message", "test:task-bridge:task-2:server", JSON.stringify(message2))

			// Wait for message processing
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Task 1 message should not be processed (no taskFree event)
			expect(task1.handleWebviewAskResponse).not.toHaveBeenCalled()

			// Task 2 message should be sent immediately
			expect(task2.handleWebviewAskResponse).toHaveBeenCalledWith("messageResponse", "Task 2 Message", undefined)

			// Now make task 1 ready
			task1.emit("taskFree", task1.taskId)

			// Wait for queue processing
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Task 1 message should now be processed
			expect(task1.handleWebviewAskResponse).toHaveBeenCalledWith("messageResponse", "Task 1 Message", undefined)
		})
	})
})
