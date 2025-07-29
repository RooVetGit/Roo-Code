import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as vscode from "vscode"
import { DesktopNotificationService } from "../NotificationService"
import { NotificationTrigger } from "../types"

// Mock node-notifier
vi.mock("node-notifier", () => {
	const mockNotify = vi.fn((options, callback) => {
		if (callback) callback(null, "response")
	})
	return {
		default: {
			notify: mockNotify,
		},
		notify: mockNotify,
	}
})

vi.mock("vscode")

describe("DesktopNotificationService", () => {
	let service: DesktopNotificationService
	let mockContext: vscode.ExtensionContext
	let mockNotifier: any
	let mockLog: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		mockContext = {
			extensionPath: "/test/path",
			subscriptions: [],
		} as any

		// Get the mocked notifier
		mockNotifier = (await import("node-notifier")).default

		// Create mock log function
		mockLog = vi.fn()

		// Create service with default preferences
		const defaultPreferences = {
			enabled: true,
			showApprovalRequests: true,
			showErrors: true,
			showTaskCompletion: true,
			showUserInputRequired: true,
			showSessionTimeouts: true,
			timeout: 10,
			sound: true,
		}

		service = new DesktopNotificationService(mockContext, defaultPreferences, mockLog)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should send notification when enabled", async () => {
		const notification: NotificationTrigger = {
			type: "approval_request",
			priority: "high",
			title: "Test Title",
			message: "Test Message",
			context: { sessionId: "test-123" },
		}

		const result = await service.sendNotification(notification)
		expect(result).toBe(true)
		expect(mockNotifier.notify).toHaveBeenCalled()
	})

	it("should not send notification when disabled", async () => {
		await service.setUserPreferences({
			enabled: false,
			showApprovalRequests: true,
			showErrors: true,
			showTaskCompletion: true,
			showUserInputRequired: true,
			showSessionTimeouts: true,
			timeout: 10,
			sound: true,
		})

		const notification: NotificationTrigger = {
			type: "approval_request",
			priority: "high",
			title: "Test Title",
			message: "Test Message",
			context: { sessionId: "test-123" },
		}

		const result = await service.sendNotification(notification)
		expect(result).toBe(false)
	})

	it("should fallback to VSCode notifications on error", async () => {
		const mockShowWarning = vi.fn()
		vi.mocked(vscode.window.showWarningMessage).mockImplementation(mockShowWarning)

		// Force an error in node-notifier
		mockNotifier.notify.mockImplementation((options: any, callback: any) => {
			if (callback) callback(new Error("Test error"), null)
		})

		const notification: NotificationTrigger = {
			type: "approval_request",
			priority: "high",
			title: "Test Title",
			message: "Test Message",
			context: { sessionId: "test-123" },
		}

		const result = await service.sendNotification(notification)
		expect(result).toBe(true)
		expect(mockShowWarning).toHaveBeenCalled()
	})

	it("should respect notification type preferences", async () => {
		// Test completion notifications
		await service.setUserPreferences({
			enabled: true,
			showApprovalRequests: true,
			showErrors: true,
			showTaskCompletion: false, // Disabled
			showUserInputRequired: true,
			showSessionTimeouts: true,
			timeout: 10,
			sound: true,
		})

		const completionNotification: NotificationTrigger = {
			type: "completion",
			priority: "medium",
			title: "Task Complete",
			message: "Your task has been completed",
			context: { sessionId: "test-123" },
		}

		const result = await service.sendNotification(completionNotification)
		expect(result).toBe(false)
		expect(mockNotifier.notify).not.toHaveBeenCalled()
	})

	it("should handle different notification priorities", async () => {
		const mockShowError = vi.fn()
		const mockShowInfo = vi.fn()
		vi.mocked(vscode.window.showErrorMessage).mockImplementation(mockShowError)
		vi.mocked(vscode.window.showInformationMessage).mockImplementation(mockShowInfo)

		// Force fallback to VSCode notifications
		mockNotifier.notify.mockImplementation((options: any, callback: any) => {
			if (callback) callback(new Error("Test error"), null)
		})

		// Test critical priority
		const criticalNotification: NotificationTrigger = {
			type: "error",
			priority: "critical",
			title: "Critical Error",
			message: "A critical error occurred",
			context: { sessionId: "test-123" },
		}

		await service.sendNotification(criticalNotification)
		expect(mockShowError).toHaveBeenCalledWith("Critical Error: A critical error occurred")

		// Test low priority
		const lowNotification: NotificationTrigger = {
			type: "input_required",
			priority: "low",
			title: "Input Needed",
			message: "Please provide input",
			context: { sessionId: "test-123" },
		}

		await service.sendNotification(lowNotification)
		expect(mockShowInfo).toHaveBeenCalledWith("Input Needed: Please provide input")
	})

	it("should handle platform-specific options", async () => {
		const originalPlatform = process.platform

		// Test macOS
		Object.defineProperty(process, "platform", {
			value: "darwin",
			configurable: true,
		})

		const macNotification: NotificationTrigger = {
			type: "approval_request",
			priority: "high",
			title: "Test",
			message: "Test message",
			context: { sessionId: "test-123" },
		}

		await service.sendNotification(macNotification)
		expect(mockNotifier.notify).toHaveBeenCalledWith(
			expect.objectContaining({
				subtitle: "Roo Code",
			}),
			expect.any(Function),
		)

		// Test Windows
		Object.defineProperty(process, "platform", {
			value: "win32",
			configurable: true,
		})

		vi.clearAllMocks()
		await service.sendNotification(macNotification)
		expect(mockNotifier.notify).toHaveBeenCalledWith(
			expect.objectContaining({
				appID: "RooVeterinaryInc.roo-cline",
			}),
			expect.any(Function),
		)

		// Restore original platform
		Object.defineProperty(process, "platform", {
			value: originalPlatform,
			configurable: true,
		})
	})

	it("should log messages using provided log function", async () => {
		// Test unsupported system warning
		vi.spyOn(service, "isSupported").mockReturnValue(false)
		await service.initialize()
		expect(mockLog).toHaveBeenCalledWith(
			"[DesktopNotificationService] Desktop notifications are not supported on this system",
		)
	})
})
