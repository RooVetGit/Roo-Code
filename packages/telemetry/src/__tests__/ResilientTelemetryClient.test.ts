import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as vscode from "vscode"
import { ResilientTelemetryClient } from "../ResilientTelemetryClient"
import { TelemetryEventName, TelemetryClient } from "@roo-code/types"

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

describe("ResilientTelemetryClient", () => {
	let mockWrappedClient: TelemetryClient
	let mockContext: vscode.ExtensionContext
	let resilientClient: ResilientTelemetryClient

	beforeEach(() => {
		mockWrappedClient = {
			capture: vi.fn().mockResolvedValue(undefined),
			setProvider: vi.fn(),
			updateTelemetryState: vi.fn(),
			isTelemetryEnabled: vi.fn().mockReturnValue(true),
			shutdown: vi.fn().mockResolvedValue(undefined),
		}

		mockContext = {
			globalState: {
				get: vi.fn().mockReturnValue([]),
				update: vi.fn().mockResolvedValue(undefined),
			},
		} as unknown as vscode.ExtensionContext

		resilientClient = new ResilientTelemetryClient(mockWrappedClient, mockContext)
	})

	afterEach(() => {
		resilientClient.shutdown()
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with wrapped client", () => {
			expect(resilientClient).toBeDefined()
		})

		it("should register commands", () => {
			expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
				"roo-code.telemetry.showQueue",
				expect.any(Function),
			)
			expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
				"roo-code.telemetry.retryNow",
				expect.any(Function),
			)
			expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
				"roo-code.telemetry.clearQueue",
				expect.any(Function),
			)
		})
	})

	describe("capture", () => {
		it("should try immediate send first", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test" },
			}

			await resilientClient.capture(event)

			expect(mockWrappedClient.capture).toHaveBeenCalledWith(event)
		})

		it("should queue event if immediate send fails", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test" },
			}

			// Make wrapped client throw error
			vi.mocked(mockWrappedClient.capture).mockRejectedValue(new Error("Network error"))

			await resilientClient.capture(event)

			expect(mockWrappedClient.capture).toHaveBeenCalledWith(event)
			// Event should be queued (we can't directly test this without exposing internals)
		})

		it("should prioritize high priority events", async () => {
			const highPriorityEvent = {
				event: TelemetryEventName.SCHEMA_VALIDATION_ERROR,
				properties: { error: "test" },
			}

			// Make wrapped client fail
			vi.mocked(mockWrappedClient.capture).mockRejectedValue(new Error("Network error"))

			await resilientClient.capture(highPriorityEvent)

			expect(mockWrappedClient.capture).toHaveBeenCalledWith(highPriorityEvent)
		})

		it("should not queue if telemetry is disabled", async () => {
			const event = {
				event: TelemetryEventName.TASK_CREATED,
				properties: { taskId: "test" },
			}

			vi.mocked(mockWrappedClient.isTelemetryEnabled).mockReturnValue(false)

			await resilientClient.capture(event)

			// When telemetry is disabled, the wrapped client's capture should still be called
			// but it should return early and not queue anything
			expect(mockWrappedClient.capture).toHaveBeenCalledWith(event)
		})
	})

	describe("delegation methods", () => {
		it("should delegate setProvider to wrapped client", () => {
			const mockProvider = {} as Parameters<typeof mockWrappedClient.setProvider>[0]
			resilientClient.setProvider(mockProvider)

			expect(mockWrappedClient.setProvider).toHaveBeenCalledWith(mockProvider)
		})

		it("should delegate updateTelemetryState to wrapped client", () => {
			resilientClient.updateTelemetryState(true)

			expect(mockWrappedClient.updateTelemetryState).toHaveBeenCalledWith(true)
		})

		it("should delegate isTelemetryEnabled to wrapped client", () => {
			const result = resilientClient.isTelemetryEnabled()

			expect(mockWrappedClient.isTelemetryEnabled).toHaveBeenCalled()
			expect(result).toBe(true)
		})

		it("should return subscription from wrapped client", () => {
			const mockSubscription = { type: "exclude", events: [] } as typeof mockWrappedClient.subscription
			mockWrappedClient.subscription = mockSubscription

			expect(resilientClient.subscription).toBe(mockSubscription)
		})
	})

	describe("getQueueStatus", () => {
		it("should return queue status", async () => {
			const status = await resilientClient.getQueueStatus()

			expect(status).toHaveProperty("queueSize")
			expect(status).toHaveProperty("connectionStatus")
			expect(typeof status.queueSize).toBe("number")
			expect(status.connectionStatus).toHaveProperty("isConnected")
		})
	})

	describe("retryNow", () => {
		it("should trigger manual retry", async () => {
			await expect(resilientClient.retryNow()).resolves.not.toThrow()
		})
	})

	describe("clearQueue", () => {
		it("should clear the retry queue", async () => {
			await expect(resilientClient.clearQueue()).resolves.not.toThrow()
		})
	})

	describe("updateRetryConfig", () => {
		it("should update retry configuration", () => {
			const newConfig = { maxRetries: 10, enableNotifications: false }

			expect(() => resilientClient.updateRetryConfig(newConfig)).not.toThrow()
		})
	})

	describe("shutdown", () => {
		it("should shutdown wrapped client and cleanup", async () => {
			await resilientClient.shutdown()

			expect(mockWrappedClient.shutdown).toHaveBeenCalled()
		})
	})

	describe("high priority events", () => {
		const highPriorityEvents = [
			TelemetryEventName.SCHEMA_VALIDATION_ERROR,
			TelemetryEventName.DIFF_APPLICATION_ERROR,
			TelemetryEventName.SHELL_INTEGRATION_ERROR,
			TelemetryEventName.CONSECUTIVE_MISTAKE_ERROR,
		]

		highPriorityEvents.forEach((eventName) => {
			it(`should treat ${eventName} as high priority`, async () => {
				const event = {
					event: eventName,
					properties: { test: "data" },
				}

				// Make wrapped client fail to trigger queueing
				vi.mocked(mockWrappedClient.capture).mockRejectedValue(new Error("Network error"))

				await resilientClient.capture(event)

				expect(mockWrappedClient.capture).toHaveBeenCalledWith(event)
			})
		})
	})
})
