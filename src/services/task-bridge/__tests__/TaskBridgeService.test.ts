// npx vitest services/task-bridge/__tests__/TaskBridgeService.test.ts

import { EventEmitter } from "events"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import type { ClineMessage } from "@roo-code/types"
import RedisMock from "ioredis-mock"

import { TaskBridgeService } from "../TaskBridgeService"
import type { Task } from "../../../core/task/Task"

// Mock ioredis with ioredis-mock
vi.mock("ioredis", () => ({
	default: RedisMock,
}))

class MockTask extends EventEmitter {
	taskId: string

	constructor(taskId: string) {
		super()
		this.taskId = taskId
	}
}

describe("TaskBridgeService", () => {
	let taskBridge: TaskBridgeService
	let mockTask: Task

	beforeEach(() => {
		// Clear the singleton instance
		;(TaskBridgeService as any).instance = null

		taskBridge = TaskBridgeService.getInstance({
			url: "redis://localhost:6379",
			namespace: "test:task-bridge",
		})

		mockTask = new MockTask("test-task-123") as unknown as Task
	})

	afterEach(async () => {
		if (taskBridge.connected) {
			await taskBridge.disconnect()
		}

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
			await taskBridge.subscribeToTask(mockTask)
			expect(taskBridge.subscribedTaskCount).toBe(1)
		})

		it("should throw error if not connected", async () => {
			await taskBridge.disconnect()

			await expect(taskBridge.subscribeToTask(mockTask)).rejects.toThrow("TaskBridgeService is not connected")
		})

		it("should unsubscribe from task channels", async () => {
			await taskBridge.subscribeToTask(mockTask)
			await taskBridge.unsubscribeFromTask(mockTask.taskId)

			expect(taskBridge.subscribedTaskCount).toBe(0)
		})
	})

	describe("Task Event Forwarding", () => {
		beforeEach(async () => {
			await taskBridge.initialize()
			await taskBridge.subscribeToTask(mockTask)
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

			// Emit the event from the mock task
			mockTask.emit("message", { action: "created", message })

			// Wait for async publish
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Check that publish was called with correct parameters
			expect(publishSpy).toHaveBeenCalledWith(
				"test:task-bridge:test-task-123:client",
				expect.stringContaining('"type":"task_event"'),
			)

			const publishedData = JSON.parse(publishSpy.mock.calls[0][1] as string)
			expect(publishedData.type).toBe("task_event")
			expect(publishedData.payload.eventType).toBe("message")
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
			await taskBridge.subscribeToTask(mockTask)
		})

		it("should log queued messages", async () => {
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			const message = {
				taskId: "test-task-123",
				type: "message_queued",
				payload: {
					eventType: "test",
					data: {
						text: "Test queued message",
						timestamp: Date.now(),
					},
				},
				timestamp: Date.now(),
			}

			// Simulate receiving a message on the server channel
			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:test-task-123:server", JSON.stringify(message))

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"Received message_queued event for task: test-task-123",
				expect.objectContaining({
					eventType: "test",
					data: expect.objectContaining({
						text: "Test queued message",
					}),
				}),
			)

			consoleLogSpy.mockRestore()
		})

		it("should ignore messages for unsubscribed tasks", async () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Manually subscribe the subscriber to the channel (simulating a lingering subscription)
			const subscriber = (taskBridge as any).subscriber
			await subscriber.subscribe("test:task-bridge:unsubscribed-task-123:server")

			const message = {
				taskId: "unsubscribed-task-123",
				type: "message_queued",
				payload: {
					eventType: "test",
					data: {},
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

	describe("Publishing Messages", () => {
		beforeEach(async () => {
			await taskBridge.initialize()
		})

		it("should publish messages to external app", async () => {
			const publisher = (taskBridge as any).publisher
			const publishSpy = vi.spyOn(publisher, "publish")

			await taskBridge.publish("test-task-123", "task_status", {
				eventType: "status",
				data: { status: "processing" },
			})

			expect(publishSpy).toHaveBeenCalledWith("test:task-bridge:test-task-123:client", expect.any(String))

			const sentMessage = JSON.parse(publishSpy.mock.calls[0][1] as string)
			expect(sentMessage.type).toBe("task_status")
			expect(sentMessage.payload.data.status).toBe("processing")
		})

		it("should throw error if not connected", async () => {
			await taskBridge.disconnect()

			await expect(
				taskBridge.publish("test-task-123", "task_status", {
					eventType: "status",
					data: {},
				}),
			).rejects.toThrow("TaskBridgeService is not connected")
		})
	})

	describe("Error Handling", () => {
		it("should handle malformed messages gracefully", async () => {
			await taskBridge.initialize()
			await taskBridge.subscribeToTask(mockTask)

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Simulate receiving invalid JSON
			const subscriber = (taskBridge as any).subscriber
			subscriber.emit("message", "test:task-bridge:test-task-123:server", "invalid json")

			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(consoleErrorSpy).toHaveBeenCalledWith("Error handling incoming message:", expect.any(Error))

			consoleErrorSpy.mockRestore()
		})
	})
})
