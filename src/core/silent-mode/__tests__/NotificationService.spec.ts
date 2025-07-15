import { describe, test, expect, beforeEach, vi } from "vitest"
import { NotificationService } from "../NotificationService"
import type { ChangeSummary } from "../types"

// Mock VSCode API - use vi.mock factory without external references
vi.mock("vscode", () => ({
	window: {
		showInformationMessage: vi.fn(),
		showWarningMessage: vi.fn(),
		showErrorMessage: vi.fn(),
		setStatusBarMessage: vi.fn(),
		createStatusBarItem: vi.fn(() => ({
			text: "",
			tooltip: "",
			show: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
		})),
	},
	StatusBarAlignment: {
		Left: 1,
		Right: 2,
	},
}))

// Get mocked functions after the import
import * as vscode from "vscode"
const mockShowInformationMessage = vscode.window.showInformationMessage as any
const mockShowWarningMessage = vscode.window.showWarningMessage as any
const mockShowErrorMessage = vscode.window.showErrorMessage as any
const mockSetStatusBarMessage = vscode.window.setStatusBarMessage as any
const mockCreateStatusBarItem = vscode.window.createStatusBarItem as any

describe("NotificationService", () => {
	let notificationService: NotificationService
	const mockWebviewCallback = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		notificationService = new NotificationService(mockWebviewCallback)
	})

	describe("initialization", () => {
		test("should initialize correctly", () => {
			expect(notificationService).toBeDefined()
		})

		test("should initialize with webview callback", () => {
			const serviceWithCallback = new NotificationService(mockWebviewCallback)
			expect(serviceWithCallback).toBeDefined()
		})

		test("should initialize without webview callback", () => {
			const serviceWithoutCallback = new NotificationService()
			expect(serviceWithoutCallback).toBeDefined()
		})
	})

	describe("completion alerts", () => {
		test("should show completion alert with summary", async () => {
			const summary: ChangeSummary = {
				filesChanged: 3,
				linesAdded: 50,
				linesRemoved: 20,
				changes: [],
			}

			await notificationService.showTaskCompletion(summary)

			expect(mockShowInformationMessage).toHaveBeenCalled()
			const callArgs = mockShowInformationMessage.mock.calls[0]
			expect(callArgs[0]).toContain("3 files")
			expect(callArgs[0]).toContain("70 changes") // 50 + 20 = 70
		})

		test("should show completion alert with no changes", async () => {
			const summary: ChangeSummary = {
				filesChanged: 0,
				linesAdded: 0,
				linesRemoved: 0,
				changes: [],
			}

			await notificationService.showTaskCompletion(summary)

			expect(mockShowInformationMessage).toHaveBeenCalled()
		})

		test("should handle completion alert with webview callback", async () => {
			const summary: ChangeSummary = {
				filesChanged: 2,
				linesAdded: 10,
				linesRemoved: 5,
				changes: [],
			}

			await notificationService.showTaskCompletion(summary)

			expect(mockWebviewCallback).toHaveBeenCalled()
		})
	})

	describe("progress notifications", () => {
		test("should show progress notification", async () => {
			const message = "Processing files..."

			await notificationService.showProgress(message)

			expect(mockSetStatusBarMessage).toHaveBeenCalledWith(`$(loading~spin) ${message}`, 2000)
		})

		test("should show progress with steps", async () => {
			const message = "Step 2 of 5: Analyzing changes"

			await notificationService.showProgress(message)

			expect(mockSetStatusBarMessage).toHaveBeenCalledWith(`$(loading~spin) ${message}`, 2000)
		})
	})

	describe("error notifications", () => {
		test("should show error notification", async () => {
			const error = "Failed to buffer file operation"

			await notificationService.showError(error)

			expect(mockShowErrorMessage).toHaveBeenCalledWith(`Silent Mode Error: ${error}`)
		})

		test("should show error with details", async () => {
			const error = "Buffer limit exceeded: maximum 100 files"

			await notificationService.showError(error)

			expect(mockShowErrorMessage).toHaveBeenCalledWith(`Silent Mode Error: ${error}`)
		})
	})

	describe("silent mode state notifications", () => {
		test("should show silent mode activated notification", async () => {
			await notificationService.showSilentModeActivated()

			expect(mockSetStatusBarMessage).toHaveBeenCalledWith("$(loading~spin) Roo is working silently...", 5000)
		})

		test("should show silent mode deactivated notification", async () => {
			await notificationService.showSilentModeDeactivated()

			expect(mockSetStatusBarMessage).toHaveBeenCalledWith("$(check) Silent Mode deactivated", 3000)
		})

		test("should show changes ready notification", async () => {
			const fileCount = 5

			await notificationService.showChangesReady(fileCount)

			expect(mockShowInformationMessage).toHaveBeenCalled()
			const callArgs = mockShowInformationMessage.mock.calls[0]
			expect(callArgs[0]).toContain("5")
		})
	})

	describe("webview integration", () => {
		test("should send message via webview callback when available", async () => {
			const summary: ChangeSummary = {
				filesChanged: 1,
				linesAdded: 5,
				linesRemoved: 2,
				changes: [],
			}

			await notificationService.showTaskCompletion(summary)

			expect(mockWebviewCallback).toHaveBeenCalled()
			expect(mockWebviewCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					type: expect.any(String),
				}),
			)
		})

		test("should handle missing webview callback gracefully", async () => {
			const serviceWithoutCallback = new NotificationService()
			const summary: ChangeSummary = {
				filesChanged: 1,
				linesAdded: 5,
				linesRemoved: 2,
				changes: [],
			}

			// Should not throw error
			await expect(serviceWithoutCallback.showTaskCompletion(summary)).resolves.not.toThrow()
		})
	})

	describe("warning notifications", () => {
		test("should show warning notification", async () => {
			const warning = "Memory usage is high"

			await notificationService.showWarning(warning)

			expect(mockShowWarningMessage).toHaveBeenCalledWith(`Silent Mode Warning: ${warning}`)
		})

		test("should show warning with details", async () => {
			const warning = "Buffer approaching size limit"

			await notificationService.showWarning(warning)

			expect(mockShowWarningMessage).toHaveBeenCalledWith(`Silent Mode Warning: ${warning}`)
		})
	})

	describe("edge cases", () => {
		test("should handle empty messages", async () => {
			await notificationService.showProgress("")
			await notificationService.showError("")

			expect(mockSetStatusBarMessage).toHaveBeenCalledWith("$(loading~spin) ", 2000)
			expect(mockShowErrorMessage).toHaveBeenCalledWith("Silent Mode Error: ")
		})

		test("should handle very long messages", async () => {
			const longMessage = "x".repeat(1000)

			await notificationService.showProgress(longMessage)
			await notificationService.showError(longMessage)

			expect(mockSetStatusBarMessage).toHaveBeenCalledWith(`$(loading~spin) ${longMessage}`, 2000)
			expect(mockShowErrorMessage).toHaveBeenCalledWith(`Silent Mode Error: ${longMessage}`)
		})

		test("should handle special characters in messages", async () => {
			const specialMessage = "File with émojis 🎉 and spëcial chars"

			await notificationService.showProgress(specialMessage)

			expect(mockSetStatusBarMessage).toHaveBeenCalledWith(`$(loading~spin) ${specialMessage}`, 2000)
		})
	})
})
