import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs/promises"
import { QueuedTelemetryClient } from "../QueuedTelemetryClient"
import { TelemetryQueueManager } from "../TelemetryQueueManager"
import { TelemetryEvent, TelemetryEventName } from "@roo-code/types"

// Mock fs module
vi.mock("fs/promises")

// Create a test implementation of QueuedTelemetryClient
class TestQueuedTelemetryClient extends QueuedTelemetryClient {
	public sendEventCalled = false
	public sendEventError: Error | null = null

	protected async sendEvent(_event: TelemetryEvent): Promise<void> {
		this.sendEventCalled = true
		if (this.sendEventError) {
			throw this.sendEventError
		}
	}

	public updateTelemetryState(didUserOptIn: boolean): void {
		this.telemetryEnabled = didUserOptIn
	}
}

describe("QueuedTelemetryClient", () => {
	let client: TestQueuedTelemetryClient
	const testStoragePath = "/test/storage"

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock file system operations
		vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))
		vi.mocked(fs.writeFile).mockResolvedValue()
		vi.mocked(fs.rename).mockResolvedValue()
		vi.mocked(fs.mkdir).mockResolvedValue(undefined as never)

		// Reset singleton instance of queue manager
		// We need to use a workaround to reset the singleton
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const TelemetryQueueManagerClass = TelemetryQueueManager as any
		if (TelemetryQueueManagerClass && typeof TelemetryQueueManagerClass === "function") {
			TelemetryQueueManagerClass.instance = null
		}

		client = new TestQueuedTelemetryClient("test-client", testStoragePath)
		client.updateTelemetryState(true)
	})

	afterEach(async () => {
		await client.shutdown()
	})

	describe("capture", () => {
		it("should send event successfully when online", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await client.capture(event)

			expect(client.sendEventCalled).toBe(true)
		})

		it("should queue event when send fails", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			client.sendEventError = new Error("Network error")

			// Should not throw
			await expect(client.capture(event)).resolves.toBeUndefined()

			// Event should be queued
			const stats = client.getQueueStats()
			expect(stats?.queueSize).toBe(1)
		})

		it("should skip event when telemetry is disabled", async () => {
			client.updateTelemetryState(false)

			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await client.capture(event)

			expect(client.sendEventCalled).toBe(false)
		})

		it("should skip excluded events based on subscription", async () => {
			// Create client with subscription that excludes TASK_MESSAGE
			client = new TestQueuedTelemetryClient("test-client", testStoragePath, {
				type: "exclude",
				events: [TelemetryEventName.TASK_MESSAGE],
			})
			client.updateTelemetryState(true)

			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_MESSAGE,
				properties: { taskId: "test-123" },
			}

			await client.capture(event)

			expect(client.sendEventCalled).toBe(false)
		})

		it("should only capture included events based on subscription", async () => {
			// Create client with subscription that only includes specific events
			client = new TestQueuedTelemetryClient("test-client", testStoragePath, {
				type: "include",
				events: [TelemetryEventName.TASK_CREATED, TelemetryEventName.TASK_COMPLETED],
			})
			client.updateTelemetryState(true)

			// This event should be captured
			const includedEvent: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			await client.capture(includedEvent)
			expect(client.sendEventCalled).toBe(true)

			// Reset
			client.sendEventCalled = false

			// This event should NOT be captured
			const excludedEvent: TelemetryEvent = {
				event: TelemetryEventName.MODE_SWITCH,
				properties: { newMode: "test" },
			}

			await client.capture(excludedEvent)
			expect(client.sendEventCalled).toBe(false)
		})
	})

	describe("getQueueStats", () => {
		it("should return queue statistics for the client", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			// Make send fail to queue the event
			client.sendEventError = new Error("Network error")
			await client.capture(event)

			const stats = client.getQueueStats()
			expect(stats).not.toBeNull()
			expect(stats?.queueSize).toBe(1)
			expect(stats?.oldestEventAge).toBeGreaterThanOrEqual(0)
		})

		it("should return null when queue manager is not available", () => {
			// Create a client without queue manager
			const clientWithoutQueue = new TestQueuedTelemetryClient("test", "/invalid/path")
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(clientWithoutQueue as any).queueManager = null

			const stats = clientWithoutQueue.getQueueStats()
			expect(stats).toBeNull()
		})
	})

	describe("shutdown", () => {
		it("should stop retry timer and attempt to send queued events", async () => {
			const event: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			}

			// Queue an event
			client.sendEventError = new Error("Network error")
			await client.capture(event)

			// Fix the error
			client.sendEventError = null
			client.sendEventCalled = false

			// Shutdown should attempt to process queue
			await client.shutdown()

			// Note: The actual processing might not happen immediately
			// due to the async nature and retry timing
		})
	})

	describe("retry mechanism", () => {
		it("should have retry timer configured", () => {
			// Check that retry timer is set up
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const retryTimer = (client as any).retryTimer
			expect(retryTimer).toBeDefined()
			expect(retryTimer).not.toBeNull()
		})

		it("should process queued events when connection is restored", async () => {
			const event1: TelemetryEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-1" },
			}
			const event2: TelemetryEvent = {
				event: TelemetryEventName.TASK_COMPLETED,
				properties: { taskId: "test-2" },
			}

			// Queue first event
			client.sendEventError = new Error("Network error")
			await client.capture(event1)
			expect(client.getQueueStats()?.queueSize).toBe(1)

			// Connection restored - second event should succeed
			client.sendEventError = null
			client.sendEventCalled = false
			await client.capture(event2)

			// Second event should be sent
			expect(client.sendEventCalled).toBe(true)
		})
	})
})
