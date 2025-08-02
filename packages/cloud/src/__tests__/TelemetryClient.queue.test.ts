import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import * as vscode from "vscode"
import { TelemetryEventName } from "@roo-code/types"

import { TelemetryClient } from "../TelemetryClient"
import type { AuthService } from "../auth"
import type { SettingsService } from "../SettingsService"
import type { QueuedTelemetryEvent } from "../TelemetryQueue"

// Mock vscode
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("TelemetryClient with Queue", () => {
	let mockContext: vscode.ExtensionContext
	let mockGlobalState: Map<string, unknown>
	let mockAuthService: AuthService
	let mockSettingsService: SettingsService
	let client: TelemetryClient

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()
		mockGlobalState = new Map()

		mockContext = {
			globalState: {
				get: vi.fn((key: string) => mockGlobalState.get(key)),
				update: vi.fn(async (key: string, value: unknown) => {
					mockGlobalState.set(key, value)
				}),
			},
		} as unknown as vscode.ExtensionContext

		mockAuthService = {
			isAuthenticated: vi.fn().mockReturnValue(true),
			getSessionToken: vi.fn().mockReturnValue("test-token"),
			getUserInfo: vi.fn().mockReturnValue(null),
			hasActiveSession: vi.fn().mockReturnValue(true),
			hasOrIsAcquiringActiveSession: vi.fn().mockReturnValue(true),
			getStoredOrganizationId: vi.fn().mockReturnValue(null),
			getState: vi.fn().mockReturnValue("authenticated"),
			initialize: vi.fn(),
			login: vi.fn(),
			logout: vi.fn(),
			handleCallback: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
		} as unknown as AuthService

		mockSettingsService = {
			getSettings: vi.fn().mockReturnValue({
				cloudSettings: {
					recordTaskMessages: false,
				},
			}),
			getAllowList: vi.fn().mockReturnValue({}),
			dispose: vi.fn(),
		} as unknown as SettingsService

		// Reset fetch mock
		mockFetch.mockReset()
		mockFetch.mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
		})

		client = new TelemetryClient(mockContext, mockAuthService, mockSettingsService, false)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Queue Integration", () => {
		it("should add events to queue instead of sending directly", async () => {
			// Mock provider to provide required properties
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
				}),
			}
			client.setProvider(mockProvider)

			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { customProp: "value" },
			}

			await client.capture(event)

			// Should not have called fetch immediately
			expect(mockFetch).not.toHaveBeenCalled()

			// Event should be in the queue
			const queue = mockGlobalState.get("rooCode.telemetryQueue") as QueuedTelemetryEvent[]
			expect(queue).toBeDefined()
			expect(queue).toHaveLength(1)
			expect(queue[0].event.type).toBe(TelemetryEventName.TASK_CREATED)
		})

		it("should process queue when adding events", async () => {
			// Mock provider to provide required properties
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
				}),
			}
			client.setProvider(mockProvider)

			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { customProp: "value" },
			}

			await client.capture(event)

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should have attempted to send the event
			expect(mockFetch).toHaveBeenCalledTimes(1)
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/events"),
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
					}),
				}),
			)

			// Queue should be empty after successful send
			const queue = mockGlobalState.get("rooCode.telemetryQueue") as QueuedTelemetryEvent[]
			expect(queue).toHaveLength(0)
		})

		it("should keep events in queue on send failure", async () => {
			// Mock provider to provide required properties
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
				}),
			}
			client.setProvider(mockProvider)

			// Mock fetch to fail
			mockFetch.mockRejectedValueOnce(new Error("Network error"))

			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { customProp: "value" },
			}

			await client.capture(event)

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should have attempted to send
			expect(mockFetch).toHaveBeenCalledTimes(1)

			// Event should still be in queue with incremented retry count
			const queue = mockGlobalState.get("rooCode.telemetryQueue") as QueuedTelemetryEvent[]
			expect(queue).toHaveLength(1)
			expect(queue[0].retryCount).toBe(1)
		})

		it("should not process queue when not authenticated", async () => {
			// Mock provider to provide required properties
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
				}),
			}
			client.setProvider(mockProvider)

			mockAuthService.isAuthenticated = vi.fn().mockReturnValue(false)

			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { customProp: "value" },
			}

			await client.capture(event)

			// Wait for any async processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should not have attempted to send
			expect(mockFetch).not.toHaveBeenCalled()

			// Event should still be in queue
			const queue = mockGlobalState.get("rooCode.telemetryQueue") as QueuedTelemetryEvent[]
			expect(queue).toHaveLength(1)
		})

		it("should process multiple events in FIFO order", async () => {
			// Mock provider to provide required properties
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
				}),
			}
			client.setProvider(mockProvider)

			const event1 = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { order: 1 },
			}
			const event2 = {
				event: TelemetryEventName.TASK_COMPLETED,
				properties: { order: 2 },
			}
			const event3 = {
				event: TelemetryEventName.MODE_SWITCH,
				properties: { order: 3 },
			}

			// Add events without waiting for processing
			await client.capture(event1)
			await client.capture(event2)
			await client.capture(event3)

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Should have sent all events
			expect(mockFetch).toHaveBeenCalledTimes(3)

			// Verify order by checking the body of each call
			const calls = mockFetch.mock.calls
			const bodies = calls.map((call) => JSON.parse(call[1].body))

			expect(bodies[0].type).toBe(TelemetryEventName.TASK_CREATED)
			expect(bodies[1].type).toBe(TelemetryEventName.TASK_COMPLETED)
			expect(bodies[2].type).toBe(TelemetryEventName.MODE_SWITCH)

			// Queue should be empty
			const queue = mockGlobalState.get("rooCode.telemetryQueue") as QueuedTelemetryEvent[]
			expect(queue).toHaveLength(0)
		})

		it("should stop processing on first failure", async () => {
			// Mock provider to provide required properties
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
				}),
			}
			client.setProvider(mockProvider)

			// Mock fetch to fail on second call
			mockFetch
				.mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK" })
				.mockRejectedValueOnce(new Error("Network error"))

			const event1 = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { order: 1 },
			}
			const event2 = {
				event: TelemetryEventName.TASK_COMPLETED,
				properties: { order: 2 },
			}
			const event3 = {
				event: TelemetryEventName.MODE_SWITCH,
				properties: { order: 3 },
			}

			await client.capture(event1)
			await client.capture(event2)
			await client.capture(event3)

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Should have attempted to send first two events
			expect(mockFetch).toHaveBeenCalledTimes(2)

			// Queue should have 2 events (failed one moved to end, third one untouched)
			const queue = mockGlobalState.get("rooCode.telemetryQueue") as QueuedTelemetryEvent[]
			expect(queue).toHaveLength(2)
			expect(queue[0].event.type).toBe(TelemetryEventName.MODE_SWITCH)
			expect(queue[1].event.type).toBe(TelemetryEventName.TASK_COMPLETED)
			expect(queue[1].retryCount).toBe(1)
		})

		it("should handle HTTP error responses", async () => {
			// Mock provider to provide required properties
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
				}),
			}
			client.setProvider(mockProvider)

			// Mock fetch to return error response
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			})

			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { customProp: "value" },
			}

			await client.capture(event)

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should have attempted to send
			expect(mockFetch).toHaveBeenCalledTimes(1)

			// Event should still be in queue with incremented retry count
			const queue = mockGlobalState.get("rooCode.telemetryQueue") as QueuedTelemetryEvent[]
			expect(queue).toHaveLength(1)
			expect(queue[0].retryCount).toBe(1)
		})

		it("should not process queue if already processing", async () => {
			// Mock provider to provide required properties
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
				}),
			}
			client.setProvider(mockProvider)

			// Create a slow response to keep processing active
			let resolveFirstRequest: () => void
			const firstRequestPromise = new Promise<void>((resolve) => {
				resolveFirstRequest = resolve
			})

			mockFetch.mockImplementationOnce(async () => {
				await firstRequestPromise
				return { ok: true, status: 200, statusText: "OK" }
			})

			// Add first event
			await client.capture({
				event: TelemetryEventName.TASK_CREATED,
				properties: { order: 1 },
			})

			// Add second event while first is still processing
			await client.capture({
				event: TelemetryEventName.TASK_COMPLETED,
				properties: { order: 2 },
			})

			// Should only have one fetch call (for the first event)
			expect(mockFetch).toHaveBeenCalledTimes(1)

			// Complete the first request
			resolveFirstRequest!()

			// Wait for processing to complete
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Now both events should have been processed
			expect(mockFetch).toHaveBeenCalledTimes(2)

			// Queue should be empty
			const queue = mockGlobalState.get("rooCode.telemetryQueue") as QueuedTelemetryEvent[]
			expect(queue).toHaveLength(0)
		})
	})

	describe("Event Filtering", () => {
		it("should not queue events that are not capturable", async () => {
			const event = {
				event: TelemetryEventName.TASK_CONVERSATION_MESSAGE, // In exclude list
				properties: { test: "value" },
			}

			await client.capture(event)

			// Should not have called fetch
			expect(mockFetch).not.toHaveBeenCalled()

			// Should not be in queue
			const queue = mockGlobalState.get("rooCode.telemetryQueue")
			expect(queue).toBeUndefined()
		})

		it("should not queue TASK_MESSAGE events when recordTaskMessages is false", async () => {
			const event = {
				event: TelemetryEventName.TASK_MESSAGE,
				properties: { taskId: "test-task" },
			}

			await client.capture(event)

			// Should not have called fetch
			expect(mockFetch).not.toHaveBeenCalled()

			// Should not be in queue
			const queue = mockGlobalState.get("rooCode.telemetryQueue")
			expect(queue).toBeUndefined()
		})

		it("should queue TASK_MESSAGE events when recordTaskMessages is true", async () => {
			// Mock provider to provide required properties
			const mockProvider = {
				getTelemetryProperties: vi.fn().mockResolvedValue({
					appName: "test-app",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
				}),
			}
			client.setProvider(mockProvider)

			mockSettingsService.getSettings = vi.fn().mockReturnValue({
				cloudSettings: {
					recordTaskMessages: true,
				},
			})

			const event = {
				event: TelemetryEventName.TASK_MESSAGE,
				properties: {
					taskId: "test-task",
					message: {
						ts: Date.now(),
						type: "say",
						say: "text",
						text: "test message",
					},
				},
			}

			await client.capture(event)

			// Wait for async processing
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Should have attempted to send
			expect(mockFetch).toHaveBeenCalledTimes(1)
		})
	})
})
