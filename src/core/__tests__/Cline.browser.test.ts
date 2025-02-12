import { Cline } from "../Cline"
import { ClineProvider } from "../webview/ClineProvider"
import * as vscode from "vscode"
import { BrowserSession } from "../../services/browser/BrowserSession"
import { BrowserActionResult } from "../../shared/ExtensionMessage"
import { ApiConfiguration, ApiProvider } from "../../shared/api"
import fs from "fs/promises"

// Mock dependencies
jest.mock("../../services/browser/BrowserSession")
jest.mock("../webview/ClineProvider")
jest.mock("fs/promises")

describe("Cline Browser Integration", () => {
	let mockContext: vscode.ExtensionContext
	let mockProvider: jest.Mocked<ClineProvider>
	let mockBrowserSession: jest.Mocked<BrowserSession>

	beforeEach(async () => {
		// Mock fs.mkdir
		;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)

		// Setup mock context
		mockContext = {
			globalState: {
				get: jest.fn(),
				update: jest.fn(),
			},
			globalStorageUri: { fsPath: "/mock/storage/path" },
		} as unknown as vscode.ExtensionContext

		// Setup mock provider
		mockProvider = {
			context: mockContext,
			getState: jest.fn().mockResolvedValue({
				apiConfiguration: {
					apiProvider: "anthropic" as ApiProvider,
					apiKey: "test-key",
				},
				lastShownAnnouncementId: "",
				customInstructions: "",
				alwaysAllowReadOnly: false,
				alwaysApproveResubmit: false,
				customModePrompts: {},
				customModes: [],
				diffEnabled: false,
				enableMcpServerCreation: false,
				experiments: {},
				fuzzyMatchThreshold: 1.0,
				keepBrowserOpen: false,
				mcpEnabled: false,
				mode: "code",
				preferredLanguage: "English",
				rateLimitSeconds: 0,
				requestDelaySeconds: 0,
				screenshotQuality: 75,
				terminalOutputLineLimit: 1000,
				browserViewportSize: "1280x800", // Default viewport size
			}),
			postMessageToWebview: jest.fn(),
			postStateToWebview: jest.fn(),
			updateTaskHistory: jest.fn(),
			ensureSettingsDirectoryExists: jest.fn(),
			ensureMcpServersDirectoryExists: jest.fn(),
			log: jest.fn(),
			getMcpHub: jest.fn(),
		} as unknown as jest.Mocked<ClineProvider>

		// Setup mock browser session
		mockBrowserSession = {
			setOnViewportChange: jest.fn(),
			closeBrowser: jest.fn().mockImplementation(async () => ({})),
			launchBrowser: jest.fn(),
			navigateToUrl: jest.fn(),
			click: jest.fn(),
			type: jest.fn(),
			scrollDown: jest.fn(),
			scrollUp: jest.fn(),
			setViewport: jest.fn(),
			getViewportSize: jest.fn(),
		} as unknown as jest.Mocked<BrowserSession>

		// Mock BrowserSession constructor
		;(BrowserSession as jest.Mock).mockImplementation(() => mockBrowserSession)

		// Reset browser session mock before each test
		mockBrowserSession.closeBrowser.mockReset()
		mockBrowserSession.closeBrowser.mockImplementation(async () => ({}))
	})

	// Helper function to create a clean Cline instance for each test
	const createTestCline = async () => {
		const apiConfig: ApiConfiguration = {
			apiProvider: "anthropic" as ApiProvider,
			apiKey: "test-key",
		}
		const instance = new Cline(mockProvider, apiConfig, undefined, false, true, 1.0, "test task")
		await new Promise((resolve) => setTimeout(resolve, 100)) // Wait for async initialization
		return instance
	}

	describe("Browser Session Management", () => {
		it("should initialize browser session with default viewport size", async () => {
			const testCline = await createTestCline()
			expect(mockBrowserSession.setOnViewportChange).toHaveBeenCalled()
			expect((testCline as any).browserViewportSize).toBe("1280x800") // Default size
			await testCline.abortTask()
		})

		it("should update viewport size when browser session changes it", async () => {
			const testCline = await createTestCline()
			const viewportChangeHandler = mockBrowserSession.setOnViewportChange.mock.calls[0][0]
			viewportChangeHandler("1024x768")
			expect((testCline as any).browserViewportSize).toBe("1024x768")
			await testCline.abortTask()
		})

		it("should restore viewport size from provider state", async () => {
			mockProvider.getState.mockResolvedValueOnce({
				...(await mockProvider.getState()),
				browserViewportSize: "375x667",
			})

			const testCline = await createTestCline()
			expect(mockBrowserSession.setViewport).toHaveBeenCalledWith("375x667")
			await testCline.abortTask()
		})
	})

	describe("Browser Action Handling", () => {
		let mockBrowserActionResult: BrowserActionResult

		beforeEach(() => {
			mockBrowserActionResult = {
				screenshot: "data:image/png;base64,test",
				logs: "test logs",
				currentUrl: "http://test.com",
				currentMousePosition: "100,100",
			}

			mockBrowserSession.navigateToUrl.mockResolvedValue(mockBrowserActionResult)
			mockBrowserSession.click.mockResolvedValue(mockBrowserActionResult)
			mockBrowserSession.type.mockResolvedValue(mockBrowserActionResult)
			mockBrowserSession.scrollDown.mockResolvedValue(mockBrowserActionResult)
			mockBrowserSession.scrollUp.mockResolvedValue(mockBrowserActionResult)
			mockBrowserSession.setViewport.mockResolvedValue(mockBrowserActionResult)
		})

		it("should handle browser launch action", async () => {
			const testCline = await createTestCline()
			const block = {
				type: "tool_use" as const,
				name: "browser_action" as const,
				params: {
					action: "launch",
					url: "http://test.com",
				},
			}
			;(testCline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(testCline as any).say = jest.fn()

			// Launch browser first
			await (testCline as any).browserSession.launchBrowser()
			const result = await (testCline as any).browserSession.navigateToUrl(block.params.url!)

			expect(mockBrowserSession.launchBrowser).toHaveBeenCalled()
			expect(mockBrowserSession.navigateToUrl).toHaveBeenCalledWith("http://test.com")
			expect(result).toEqual(mockBrowserActionResult)

			// Wait for any pending async operations and cleanup
			await new Promise((resolve) => setTimeout(resolve, 500))
			await testCline.abortTask()
			await new Promise((resolve) => setTimeout(resolve, 100)) // Additional wait for cleanup
			await testCline.abortTask()
		})

		it("should handle browser click action", async () => {
			const testCline = await createTestCline()
			const block = {
				type: "tool_use" as const,
				name: "browser_action" as const,
				params: {
					action: "click",
					coordinate: "100,200",
				},
			}
			;(testCline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(testCline as any).say = jest.fn()

			const result = await (testCline as any).browserSession.click(block.params.coordinate!)

			expect(mockBrowserSession.click).toHaveBeenCalledWith("100,200")
			expect(result).toEqual(mockBrowserActionResult)

			// Wait for any pending async operations and cleanup
			await new Promise((resolve) => setTimeout(resolve, 500))
			await testCline.abortTask()
			await new Promise((resolve) => setTimeout(resolve, 100)) // Additional wait for cleanup
			await testCline.abortTask()
		})

		it("should handle browser type action", async () => {
			const testCline = await createTestCline()
			const block = {
				type: "tool_use" as const,
				name: "browser_action" as const,
				params: {
					action: "type",
					text: "test text",
				},
			}

			;(testCline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(testCline as any).say = jest.fn()

			const result = await (testCline as any).browserSession.type(block.params.text!)

			expect(mockBrowserSession.type).toHaveBeenCalledWith("test text")
			expect(result).toEqual(mockBrowserActionResult)

			// Wait for any pending async operations and cleanup
			await new Promise((resolve) => setTimeout(resolve, 500))
			await testCline.abortTask()
			await new Promise((resolve) => setTimeout(resolve, 100)) // Additional wait for cleanup
		})

		it("should handle viewport changes", async () => {
			const testCline = await createTestCline()
			const block = {
				type: "tool_use" as const,
				name: "browser_action" as const,
				params: {
					action: "set_viewport",
					viewport: "1024x768",
				},
			}

			;(testCline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(testCline as any).say = jest.fn()

			const result = await (testCline as any).browserSession.setViewport(block.params.viewport!)

			expect(mockBrowserSession.setViewport).toHaveBeenCalledWith("1024x768")
			expect(result).toEqual(mockBrowserActionResult)

			// Wait for any pending async operations and cleanup
			await new Promise((resolve) => setTimeout(resolve, 500))
			await testCline.abortTask()
			await new Promise((resolve) => setTimeout(resolve, 100)) // Additional wait for cleanup
		})

		it("should handle browser close action", async () => {
			const testCline = await createTestCline()
			const block = {
				type: "tool_use" as const,
				name: "browser_action" as const,
				params: {
					action: "close",
				},
			}

			;(testCline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(testCline as any).say = jest.fn()

			// Launch browser first
			await (testCline as any).browserSession.launchBrowser()
			await (testCline as any).browserSession.closeBrowser()

			expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()

			// Wait for any pending async operations and cleanup
			await new Promise((resolve) => setTimeout(resolve, 500))
			await testCline.abortTask()
			await new Promise((resolve) => setTimeout(resolve, 100)) // Additional wait for cleanup
		})
	})

	describe("Browser Error Handling", () => {
		it("should handle browser launch errors", async () => {
			const error = new Error("Failed to launch browser")
			mockBrowserSession.launchBrowser.mockRejectedValue(error)

			const testCline = await createTestCline()
			;(testCline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(testCline as any).say = jest.fn()

			const launchPromise = (testCline as any).browserSession.launchBrowser()

			await expect(launchPromise).rejects.toThrow("Failed to launch browser")
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()

			await testCline.abortTask()
		})

		it("should handle navigation errors", async () => {
			const error = new Error("Failed to navigate")
			mockBrowserSession.navigateToUrl.mockRejectedValue(error)

			const testCline = await createTestCline()
			;(testCline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(testCline as any).say = jest.fn()

			const navigatePromise = (testCline as any).browserSession.navigateToUrl("http://test.com")

			await expect(navigatePromise).rejects.toThrow("Failed to navigate")
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()

			await testCline.abortTask()
		})

		it("should handle click errors", async () => {
			const error = new Error("Failed to click")
			mockBrowserSession.click.mockRejectedValue(error)

			const testCline = await createTestCline()
			;(testCline as any).ask = jest.fn().mockResolvedValue({ response: "yesButtonClicked" })
			;(testCline as any).say = jest.fn()

			const clickPromise = (testCline as any).browserSession.click("100,200")

			await expect(clickPromise).rejects.toThrow("Failed to click")
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()

			await testCline.abortTask()
		})
	})

	describe("Task Lifecycle", () => {
		it("should close browser when task is aborted", async () => {
			const testCline = await createTestCline()
			await testCline.abortTask()
			expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()
		})
	})
})
