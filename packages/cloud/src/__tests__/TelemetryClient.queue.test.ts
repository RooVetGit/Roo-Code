// npx vitest run src/__tests__/TelemetryClient.queue.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TelemetryClient } from "../TelemetryClient"
import { TelemetryQueue } from "../TelemetryQueue"
import { TelemetryEventName } from "@roo-code/types"
import * as vscode from "vscode"

// Mock vscode module
vi.mock("vscode", () => ({
	ExtensionContext: vi.fn(),
	Memento: vi.fn(),
	commands: {
		executeCommand: vi.fn(),
	},
}))

// Mock TelemetryQueue
vi.mock("../TelemetryQueue")

const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe("TelemetryClient with Queue Integration", () => {
	let mockAuthService: any
	let mockSettingsService: any
	let mockContext: any
	let mockQueue: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock context
		mockContext = {
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
			},
		}

		// Create a mock AuthService
		mockAuthService = {
			getSessionToken: vi.fn().mockReturnValue("mock-token"),
			getState: vi.fn().mockReturnValue("active-session"),
			isAuthenticated: vi.fn().mockReturnValue(true),
			hasActiveSession: vi.fn().mockReturnValue(true),
		}

		// Create a mock SettingsService
		mockSettingsService = {
			getSettings: vi.fn().mockReturnValue({
				cloudSettings: {
					recordTaskMessages: true,
				},
			}),
		}

		// Mock successful fetch by default
		mockFetch.mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({}),
		})

		// Create mock queue instance
		mockQueue = {
			enqueue: vi.fn(),
			processQueue: vi.fn(),
			updateConnectionStatus: vi.fn(),
			getConnectionStatus: vi.fn().mockReturnValue("online"),
			getQueueSize: vi.fn().mockReturnValue(0),
			clearQueue: vi.fn(),
			dispose: vi.fn(),
		}

		// Mock TelemetryQueue constructor to return our mock
		vi.mocked(TelemetryQueue).mockImplementation(() => mockQueue)

		vi.spyOn(console, "info").mockImplementation(() => {})
		vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Queue Integration", () => {
		it("should queue events when network request fails", async () => {
			// Mock fetch to fail
			mockFetch.mockRejectedValue(new Error("Network error"))

			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: {
					appName: "roo-code",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
					taskId: "test-task-id",
				},
			}

			await client.capture(event)

			// Verify event was queued
			expect(mockQueue.enqueue).toHaveBeenCalledWith(event)
			expect(mockQueue.updateConnectionStatus).toHaveBeenCalledWith(false)
		})

		it("should queue events when response is not ok", async () => {
			// Mock fetch to return error response
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			})

			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: {
					appName: "roo-code",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
					taskId: "test-task-id",
				},
			}

			await client.capture(event)

			// Verify event was queued
			expect(mockQueue.enqueue).toHaveBeenCalledWith(event)
			expect(mockQueue.updateConnectionStatus).toHaveBeenCalledWith(false)
		})

		it("should update connection status to online on successful request", async () => {
			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: {
					appName: "roo-code",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
					taskId: "test-task-id",
				},
			}

			await client.capture(event)

			// Verify connection status was updated to online
			expect(mockQueue.updateConnectionStatus).toHaveBeenCalledWith(true)
			expect(mockQueue.enqueue).not.toHaveBeenCalled()
		})

		it("should not queue events that fail validation", async () => {
			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			const invalidEvent = {
				event: TelemetryEventName.TASK_CREATED,
				properties: {
					// Missing required properties
					taskId: "test-task-id",
				},
			}

			await client.capture(invalidEvent)

			// Verify event was not queued
			expect(mockQueue.enqueue).not.toHaveBeenCalled()
		})

		it("should not queue excluded events", async () => {
			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			const excludedEvent = {
				event: TelemetryEventName.TASK_CONVERSATION_MESSAGE,
				properties: {
					appName: "roo-code",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
				},
			}

			await client.capture(excludedEvent)

			// Verify event was not queued
			expect(mockQueue.enqueue).not.toHaveBeenCalled()
			expect(mockFetch).not.toHaveBeenCalled()
		})
	})

	describe("processQueuedEvents", () => {
		it("should process queued events", async () => {
			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			// Access the private method through the instance
			const processQueuedEvents = (client as any).processQueuedEvents.bind(client)

			await processQueuedEvents()

			expect(mockQueue.processQueue).toHaveBeenCalledWith(expect.any(Function))
		})

		it("should return true for successful event send", async () => {
			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			// Get the send function passed to processQueue
			await (client as any).processQueuedEvents()
			const sendFunction = mockQueue.processQueue.mock.calls[0][0]

			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: {
					appName: "roo-code",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
					taskId: "test-task-id",
				},
			}

			const result = await sendFunction(event)

			expect(result).toBe(true)
			expect(mockFetch).toHaveBeenCalled()
		})

		it("should return false for failed event send", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"))

			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			// Get the send function passed to processQueue
			await (client as any).processQueuedEvents()
			const sendFunction = mockQueue.processQueue.mock.calls[0][0]

			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: {
					appName: "roo-code",
					appVersion: "1.0.0",
					vscodeVersion: "1.60.0",
					platform: "darwin",
					editorName: "vscode",
					language: "en",
					mode: "code",
					taskId: "test-task-id",
				},
			}

			const result = await sendFunction(event)

			expect(result).toBe(false)
		})
	})

	describe("checkConnection", () => {
		it("should check connection by making a lightweight request", async () => {
			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			// Access the private method through the instance
			const checkConnection = (client as any).checkConnection.bind(client)

			await checkConnection()

			expect(mockFetch).toHaveBeenCalledWith(
				"https://app.roocode.com/api/health",
				expect.objectContaining({
					method: "GET",
				}),
			)

			expect(mockQueue.updateConnectionStatus).toHaveBeenCalledWith(true)
		})

		it("should update connection status to offline on failure", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"))

			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			// Access the private method through the instance
			const checkConnection = (client as any).checkConnection.bind(client)

			await checkConnection()

			expect(mockQueue.updateConnectionStatus).toHaveBeenCalledWith(false)
		})

		it("should handle timeout", async () => {
			// Mock fetch to reject after a delay
			mockFetch.mockRejectedValue(new Error("Timeout"))

			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			await client.checkConnection()

			expect(mockQueue.updateConnectionStatus).toHaveBeenCalledWith(false)
		})
	})

	describe("getConnectionStatus", () => {
		it("should return connection status from queue", () => {
			mockQueue.getConnectionStatus.mockReturnValue("offline")

			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			expect(client.getConnectionStatus()).toBe("offline")

			mockQueue.getConnectionStatus.mockReturnValue("online")
			expect(client.getConnectionStatus()).toBe("online")
		})
	})

	describe("getQueueSize", () => {
		it("should return queue size from queue", () => {
			mockQueue.getQueueSize.mockReturnValue(5)

			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			expect(client.getQueueSize()).toBe(5)
		})
	})

	describe("setContext", () => {
		it("should initialize queue when context is set", () => {
			// Create client without context
			const client = new TelemetryClient(mockAuthService, mockSettingsService)

			// Verify queue is not initialized
			expect(TelemetryQueue).not.toHaveBeenCalled()

			// Set context
			client.setContext(mockContext)

			// Verify queue was created
			expect(TelemetryQueue).toHaveBeenCalledWith(mockContext)
		})

		it("should handle queue initialization errors gracefully", () => {
			// Mock TelemetryQueue to throw error
			vi.mocked(TelemetryQueue).mockImplementationOnce(() => {
				throw new Error("Queue initialization error")
			})

			const client = new TelemetryClient(mockAuthService, mockSettingsService)

			// Spy on console.error to suppress the error output
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Set context should not throw
			expect(() => client.setContext(mockContext)).not.toThrow()

			// Verify error was logged
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Failed to initialize telemetry queue"),
			)
		})
	})

	describe("shutdown", () => {
		it("should dispose of the queue on shutdown", async () => {
			const client = new TelemetryClient(mockAuthService, mockSettingsService, false)
			client.setContext(mockContext)

			await client.shutdown()

			expect(mockQueue.dispose).toHaveBeenCalled()
		})

		it("should handle shutdown without queue", async () => {
			const client = new TelemetryClient(mockAuthService, mockSettingsService)

			// Should not throw
			await expect(client.shutdown()).resolves.not.toThrow()
		})
	})
})
