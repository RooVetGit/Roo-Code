import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { TelemetryService } from "../TelemetryService"
import { TelemetryQueue } from "../TelemetryQueue"
import { BaseTelemetryClient } from "../BaseTelemetryClient"
import { TelemetryEventName, TelemetryEvent } from "@roo-code/types"

// Mock vscode
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	env: {
		machineId: "test-machine-id",
	},
	workspace: {
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue("all"),
		}),
	},
}))

// Mock posthog-node
vi.mock("posthog-node", () => ({
	PostHog: vi.fn().mockImplementation(() => ({
		capture: vi.fn(),
		optIn: vi.fn(),
		optOut: vi.fn(),
		shutdown: vi.fn().mockResolvedValue(undefined),
	})),
}))

// Mock TelemetryQueue
vi.mock("../TelemetryQueue", () => {
	const mockQueue = {
		setRetryCallback: vi.fn(),
		start: vi.fn(),
		shutdown: vi.fn(),
		getQueueSize: vi.fn().mockReturnValue(0),
		addEvent: vi.fn(),
	}

	return {
		TelemetryQueue: vi.fn(() => mockQueue),
		QueuedTelemetryEvent: vi.fn(),
	}
})

// Create a mock telemetry client
class MockTelemetryClient extends BaseTelemetryClient {
	public async capture(_event: TelemetryEvent): Promise<void> {
		// Mock implementation
	}

	protected async captureWithRetry(_event: TelemetryEvent): Promise<boolean> {
		return true
	}

	public updateTelemetryState(didUserOptIn: boolean): void {
		this.telemetryEnabled = didUserOptIn
	}

	public async shutdown(): Promise<void> {
		// Mock implementation
	}
}

describe("TelemetryService", () => {
	let mockContext: vscode.ExtensionContext
	let mockGlobalState: Map<string, unknown>

	beforeEach(() => {
		vi.clearAllMocks()

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

		// Reset the singleton
		// @ts-expect-error - accessing private property for testing
		TelemetryService._instance = null
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("createInstance", () => {
		it("should create a singleton instance", () => {
			const service1 = TelemetryService.createInstance()
			expect(service1).toBeDefined()

			// Should throw when trying to create another instance
			expect(() => TelemetryService.createInstance()).toThrow("TelemetryService instance already created")
		})

		it("should create instance with provided clients", () => {
			const mockClient1 = new MockTelemetryClient()
			const mockClient2 = new MockTelemetryClient()

			const service = TelemetryService.createInstance([mockClient1, mockClient2])
			expect(service).toBeDefined()
		})
	})

	describe("instance", () => {
		it("should throw if not initialized", () => {
			expect(() => TelemetryService.instance).toThrow("TelemetryService not initialized")
		})

		it("should return the instance if initialized", () => {
			const service = TelemetryService.createInstance()
			expect(TelemetryService.instance).toBe(service)
		})
	})

	describe("hasInstance", () => {
		it("should return false if not initialized", () => {
			expect(TelemetryService.hasInstance()).toBe(false)
		})

		it("should return true if initialized", () => {
			TelemetryService.createInstance()
			expect(TelemetryService.hasInstance()).toBe(true)
		})
	})

	describe("initializeQueue", () => {
		it("should create and configure the queue", () => {
			const mockClient1 = new MockTelemetryClient()
			const mockClient2 = new MockTelemetryClient()
			const service = TelemetryService.createInstance([mockClient1, mockClient2])

			service.initializeQueue(mockContext)

			// Verify TelemetryQueue was created
			expect(TelemetryQueue).toHaveBeenCalledWith(mockContext)

			// Get the mock queue instance
			const MockedTelemetryQueue = vi.mocked(TelemetryQueue)
			const mockQueue = MockedTelemetryQueue.mock.results[0]?.value

			// Verify setRetryCallback was called
			expect(mockQueue.setRetryCallback).toHaveBeenCalled()

			// Verify queue was distributed to clients
			vi.spyOn(mockClient1, "setQueue")
			vi.spyOn(mockClient2, "setQueue")

			// Re-initialize to trigger setQueue calls
			service.initializeQueue(mockContext)

			expect(mockClient1.setQueue).toHaveBeenCalledWith(mockQueue)
			expect(mockClient2.setQueue).toHaveBeenCalledWith(mockQueue)

			// Verify queue was started
			expect(mockQueue.start).toHaveBeenCalled()
		})

		it("should not initialize if service is not ready", () => {
			const service = TelemetryService.createInstance([])

			service.initializeQueue(mockContext)

			// TelemetryQueue should not be created
			expect(TelemetryQueue).not.toHaveBeenCalled()
		})

		it("should set up retry callback that finds correct client", async () => {
			// Import the real PostHogTelemetryClient
			const { PostHogTelemetryClient } = await import("../PostHogTelemetryClient")

			// Create instances
			const posthogClient = new PostHogTelemetryClient()
			const cloudClient = new MockTelemetryClient()

			// Override constructor names for testing
			Object.defineProperty(cloudClient.constructor, "name", { value: "TelemetryClient" })

			// Spy on captureWithRetry methods
			const posthogSpy = vi
				.spyOn(
					posthogClient as unknown as { captureWithRetry: (event: TelemetryEvent) => Promise<boolean> },
					"captureWithRetry",
				)
				.mockResolvedValue(true)
			const cloudSpy = vi
				.spyOn(
					cloudClient as unknown as { captureWithRetry: (event: TelemetryEvent) => Promise<boolean> },
					"captureWithRetry",
				)
				.mockResolvedValue(true)

			const service = TelemetryService.createInstance([posthogClient, cloudClient])

			service.initializeQueue(mockContext)

			// Get the retry callback
			const MockedTelemetryQueue = vi.mocked(TelemetryQueue)
			const mockQueue = MockedTelemetryQueue.mock.results[0]?.value
			const retryCallback = mockQueue.setRetryCallback.mock.calls[0]?.[0]

			// Test PostHog client selection
			const posthogEvent = {
				id: "test-1",
				timestamp: Date.now(),
				event: { event: TelemetryEventName.TASK_CREATED, properties: {} },
				clientType: "posthog" as const,
				retryCount: 0,
			}

			const result1 = await retryCallback(posthogEvent)
			expect(result1).toBe(true)
			expect(posthogSpy).toHaveBeenCalledWith(posthogEvent.event)

			// Test Cloud client selection
			const cloudEvent = {
				id: "test-2",
				timestamp: Date.now(),
				event: { event: TelemetryEventName.TASK_CREATED, properties: {} },
				clientType: "cloud" as const,
				retryCount: 0,
			}

			const result2 = await retryCallback(cloudEvent)
			expect(result2).toBe(true)
			expect(cloudSpy).toHaveBeenCalledWith(cloudEvent.event)
		})

		it("should return false from retry callback if no matching client found", async () => {
			const mockClient = new MockTelemetryClient()
			const service = TelemetryService.createInstance([mockClient])

			service.initializeQueue(mockContext)

			// Get the retry callback
			const MockedTelemetryQueue = vi.mocked(TelemetryQueue)
			const mockQueue = MockedTelemetryQueue.mock.results[0]?.value
			const retryCallback = mockQueue.setRetryCallback.mock.calls[0]?.[0]

			// Test with unknown client type
			const unknownEvent = {
				id: "test-1",
				timestamp: Date.now(),
				event: { event: TelemetryEventName.TASK_CREATED, properties: {} },
				clientType: "unknown" as "posthog" | "cloud",
				retryCount: 0,
			}

			const result = await retryCallback(unknownEvent)
			expect(result).toBe(false)
		})
	})

	describe("shutdownQueue", () => {
		it("should shutdown the queue if initialized", async () => {
			const mockClient = new MockTelemetryClient()
			const service = TelemetryService.createInstance([mockClient])

			service.initializeQueue(mockContext)

			const MockedTelemetryQueue = vi.mocked(TelemetryQueue)
			const mockQueue = MockedTelemetryQueue.mock.results[0]?.value

			await service.shutdownQueue(5000)

			expect(mockQueue.shutdown).toHaveBeenCalledWith(5000)
		})

		it("should handle shutdown when queue is not initialized", async () => {
			const service = TelemetryService.createInstance([])

			// Should not throw
			await expect(service.shutdownQueue()).resolves.toBeUndefined()
		})
	})

	describe("getQueueStatus", () => {
		it("should return queue status", () => {
			const mockClient1 = new MockTelemetryClient()
			const mockClient2 = new MockTelemetryClient()
			const service = TelemetryService.createInstance([mockClient1, mockClient2])

			service.initializeQueue(mockContext)

			const MockedTelemetryQueue = vi.mocked(TelemetryQueue)
			const mockQueue = MockedTelemetryQueue.mock.results[0]?.value
			mockQueue.getQueueSize.mockReturnValue(5)

			const status = service.getQueueStatus()

			expect(status).toEqual({
				size: 5,
				clients: 2,
			})
		})

		it("should return zero size when queue is not initialized", () => {
			const service = TelemetryService.createInstance([])

			const status = service.getQueueStatus()

			expect(status).toEqual({
				size: 0,
				clients: 0,
			})
		})
	})

	describe("shutdown", () => {
		it("should shutdown queue and all clients", async () => {
			const mockClient1 = new MockTelemetryClient()
			const mockClient2 = new MockTelemetryClient()

			vi.spyOn(mockClient1, "shutdown")
			vi.spyOn(mockClient2, "shutdown")

			const service = TelemetryService.createInstance([mockClient1, mockClient2])

			service.initializeQueue(mockContext)

			const MockedTelemetryQueue = vi.mocked(TelemetryQueue)
			const mockQueue = MockedTelemetryQueue.mock.results[0]?.value

			await service.shutdown()

			// Queue should be shutdown first
			expect(mockQueue.shutdown).toHaveBeenCalled()

			// Then clients
			expect(mockClient1.shutdown).toHaveBeenCalled()
			expect(mockClient2.shutdown).toHaveBeenCalled()
		})

		it("should handle shutdown when not ready", async () => {
			const service = TelemetryService.createInstance([])

			// Should not throw
			await expect(service.shutdown()).resolves.toBeUndefined()
		})
	})

	describe("captureEvent", () => {
		it("should forward events to all clients", () => {
			const mockClient1 = new MockTelemetryClient()
			const mockClient2 = new MockTelemetryClient()

			vi.spyOn(mockClient1, "capture")
			vi.spyOn(mockClient2, "capture")

			const service = TelemetryService.createInstance([mockClient1, mockClient2])

			service.captureEvent(TelemetryEventName.TASK_CREATED, { taskId: "test-123" })

			expect(mockClient1.capture).toHaveBeenCalledWith({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			})

			expect(mockClient2.capture).toHaveBeenCalledWith({
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test-123" },
			})
		})

		it("should not capture when service is not ready", () => {
			const service = TelemetryService.createInstance([])

			// Should not throw
			expect(() => service.captureEvent(TelemetryEventName.TASK_CREATED, { taskId: "test-123" })).not.toThrow()
		})
	})

	describe("updateTelemetryState", () => {
		it("should update telemetry state for all clients", () => {
			const mockClient1 = new MockTelemetryClient()
			const mockClient2 = new MockTelemetryClient()

			vi.spyOn(mockClient1, "updateTelemetryState")
			vi.spyOn(mockClient2, "updateTelemetryState")

			const service = TelemetryService.createInstance([mockClient1, mockClient2])

			service.updateTelemetryState(true)

			expect(mockClient1.updateTelemetryState).toHaveBeenCalledWith(true)
			expect(mockClient2.updateTelemetryState).toHaveBeenCalledWith(true)
		})
	})

	describe("isTelemetryEnabled", () => {
		it("should return true if any client has telemetry enabled", () => {
			const mockClient1 = new MockTelemetryClient()
			const mockClient2 = new MockTelemetryClient()

			mockClient1.updateTelemetryState(false)
			mockClient2.updateTelemetryState(true)

			const service = TelemetryService.createInstance([mockClient1, mockClient2])

			expect(service.isTelemetryEnabled()).toBe(true)
		})

		it("should return false if no clients have telemetry enabled", () => {
			const mockClient1 = new MockTelemetryClient()
			const mockClient2 = new MockTelemetryClient()

			mockClient1.updateTelemetryState(false)
			mockClient2.updateTelemetryState(false)

			const service = TelemetryService.createInstance([mockClient1, mockClient2])

			expect(service.isTelemetryEnabled()).toBe(false)
		})

		it("should return false when service is not ready", () => {
			const service = TelemetryService.createInstance([])

			expect(service.isTelemetryEnabled()).toBe(false)
		})
	})

	describe("setProvider", () => {
		it("should set provider on all clients", () => {
			const mockClient1 = new MockTelemetryClient()
			const mockClient2 = new MockTelemetryClient()

			vi.spyOn(mockClient1, "setProvider")
			vi.spyOn(mockClient2, "setProvider")

			const service = TelemetryService.createInstance([mockClient1, mockClient2])

			const mockProvider = {
				getTelemetryProperties: vi.fn(),
			}

			service.setProvider(mockProvider)

			expect(mockClient1.setProvider).toHaveBeenCalledWith(mockProvider)
			expect(mockClient2.setProvider).toHaveBeenCalledWith(mockProvider)
		})
	})
})
