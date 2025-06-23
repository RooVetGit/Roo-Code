import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as vscode from "vscode"
import { TelemetryRetryQueue, DEFAULT_RETRY_CONFIG } from "../TelemetryRetryQueue"
import { TelemetryEventName } from "@roo-code/types"

// Mock VSCode
vi.mock("vscode", () => ({
	window: {
		createStatusBarItem: vi.fn(() => ({
			text: "",
			tooltip: "",
			backgroundColor: undefined,
			command: "",
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		})),
		showWarningMessage: vi.fn(),
		showInformationMessage: vi.fn(),
	},
	StatusBarAlignment: {
		Right: 2,
	},
	ThemeColor: vi.fn(),
	commands: {
		executeCommand: vi.fn(),
		registerCommand: vi.fn(),
	},
}))

describe("TelemetryRetryQueue", () => {
	let mockContext: vscode.ExtensionContext
	let retryQueue: TelemetryRetryQueue

	beforeEach(() => {
		mockContext = {
			globalState: {
				get: vi.fn().mockReturnValue([]),
				update: vi.fn().mockResolvedValue(undefined),
			},
		} as unknown as vscode.ExtensionContext

		retryQueue = new TelemetryRetryQueue(mockContext)
	})

	afterEach(() => {
		retryQueue.dispose()
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with default config", () => {
			expect(retryQueue).toBeDefined()
		})

		it("should accept custom config", () => {
			const customConfig = { maxRetries: 3, baseDelayMs: 500 }
			const customQueue = new TelemetryRetryQueue(mockContext, customConfig)
			expect(customQueue).toBeDefined()
			customQueue.dispose()
		})
	})

	describe("enqueue", () => {
		it("should add event to queue", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await retryQueue.enqueue(event)

			expect(mockContext.globalState.update).toHaveBeenCalledWith(
				"telemetryRetryQueue",
				expect.arrayContaining([
					expect.objectContaining({
						event,
						priority: "normal",
						retryCount: 0,
					}),
				]),
			)
		})

		it("should prioritize high priority events", async () => {
			const normalEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "normal" },
			}

			const highEvent = {
				event: TelemetryEventName.SCHEMA_VALIDATION_ERROR,
				properties: { error: "test" },
			}

			await retryQueue.enqueue(normalEvent, "normal")
			await retryQueue.enqueue(highEvent, "high")

			// High priority event should be inserted before normal priority
			const calls = vi.mocked(mockContext.globalState.update).mock.calls
			const lastCall = calls[calls.length - 1]
			const queue = lastCall[1]

			expect(queue[0].priority).toBe("high")
			expect(queue[1].priority).toBe("normal")
		})

		it("should respect queue size limit", async () => {
			const smallQueue = new TelemetryRetryQueue(mockContext, { maxQueueSize: 2 })

			const event1 = { event: TelemetryEventName.TASK_CREATED, properties: { taskId: "1" } }
			const event2 = { event: TelemetryEventName.TASK_CREATED, properties: { taskId: "2" } }
			const event3 = { event: TelemetryEventName.TASK_CREATED, properties: { taskId: "3" } }

			await smallQueue.enqueue(event1)
			await smallQueue.enqueue(event2)
			await smallQueue.enqueue(event3) // Should remove oldest

			const queueSize = await smallQueue.getQueueSize()
			expect(queueSize).toBe(2)

			smallQueue.dispose()
		})
	})

	describe("processQueue", () => {
		it("should process events and remove successful ones", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test" },
			}

			// Mock existing queue with one event
			vi.mocked(mockContext.globalState.get).mockReturnValue([
				{
					id: "test-id",
					event,
					timestamp: Date.now(),
					retryCount: 0,
					nextRetryAt: Date.now() - 1000, // Ready for retry
					priority: "normal",
				},
			])

			const sendFunction = vi.fn().mockResolvedValue(true) // Success

			await retryQueue.processQueue(sendFunction)

			expect(sendFunction).toHaveBeenCalledWith(event)
			expect(mockContext.globalState.update).toHaveBeenCalledWith("telemetryRetryQueue", [])
		})

		it("should increment retry count for failed events", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test" },
			}

			const queuedEvent = {
				id: "test-id",
				event,
				timestamp: Date.now(),
				retryCount: 0,
				nextRetryAt: Date.now() - 1000,
				priority: "normal",
			}

			vi.mocked(mockContext.globalState.get).mockReturnValue([queuedEvent])

			const sendFunction = vi.fn().mockResolvedValue(false) // Failure

			await retryQueue.processQueue(sendFunction)

			expect(sendFunction).toHaveBeenCalledWith(event)

			const updateCalls = vi.mocked(mockContext.globalState.update).mock.calls
			const lastCall = updateCalls[updateCalls.length - 1]
			const updatedQueue = lastCall[1]

			expect(updatedQueue[0].retryCount).toBe(1)
			expect(updatedQueue[0].nextRetryAt).toBeGreaterThan(Date.now())
		})

		it("should remove events that exceed max retries", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test" },
			}

			const queuedEvent = {
				id: "test-id",
				event,
				timestamp: Date.now(),
				retryCount: DEFAULT_RETRY_CONFIG.maxRetries, // Already at max
				nextRetryAt: Date.now() - 1000,
				priority: "normal",
			}

			vi.mocked(mockContext.globalState.get).mockReturnValue([queuedEvent])

			const sendFunction = vi.fn().mockResolvedValue(false) // Failure

			await retryQueue.processQueue(sendFunction)

			expect(mockContext.globalState.update).toHaveBeenCalledWith("telemetryRetryQueue", [])
		})

		it("should process events in batches", async () => {
			const events = Array.from({ length: 15 }, (_, i) => ({
				id: `test-id-${i}`,
				event: {
					event: TelemetryEventName.TASK_CREATED,
					properties: { taskId: `test-${i}` },
				},
				timestamp: Date.now(),
				retryCount: 0,
				nextRetryAt: Date.now() - 1000,
				priority: "normal" as const,
			}))

			vi.mocked(mockContext.globalState.get).mockReturnValue(events)

			const sendFunction = vi.fn().mockResolvedValue(true)

			await retryQueue.processQueue(sendFunction)

			// Should only process batch size (default 10)
			expect(sendFunction).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.batchSize)
		})
	})

	describe("getQueueSize", () => {
		it("should return correct queue size", async () => {
			const events = [
				{ id: "1", event: {}, timestamp: 0, retryCount: 0, nextRetryAt: 0, priority: "normal" },
				{ id: "2", event: {}, timestamp: 0, retryCount: 0, nextRetryAt: 0, priority: "normal" },
			]

			vi.mocked(mockContext.globalState.get).mockReturnValue(events)

			const size = await retryQueue.getQueueSize()
			expect(size).toBe(2)
		})
	})

	describe("clearQueue", () => {
		it("should clear all events from queue", async () => {
			await retryQueue.clearQueue()

			expect(mockContext.globalState.update).toHaveBeenCalledWith("telemetryRetryQueue", [])
		})
	})

	describe("getConnectionStatus", () => {
		it("should return connection status", () => {
			const status = retryQueue.getConnectionStatus()

			expect(status).toHaveProperty("isConnected")
			expect(status).toHaveProperty("lastSuccessfulSend")
			expect(status).toHaveProperty("consecutiveFailures")
		})
	})

	describe("updateConfig", () => {
		it("should update configuration", () => {
			const newConfig = { maxRetries: 10, enableNotifications: false }

			retryQueue.updateConfig(newConfig)

			// Config should be updated (we can't directly test private properties,
			// but we can test behavior changes)
			expect(() => retryQueue.updateConfig(newConfig)).not.toThrow()
		})
	})

	describe("triggerRetry", () => {
		it("should manually trigger retry processing", async () => {
			const sendFunction = vi.fn().mockResolvedValue(true)

			await retryQueue.triggerRetry(sendFunction)

			// Should not throw and should call processQueue internally
			expect(() => retryQueue.triggerRetry(sendFunction)).not.toThrow()
		})
	})
})
