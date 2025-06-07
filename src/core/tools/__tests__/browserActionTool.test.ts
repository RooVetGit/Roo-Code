import { browserActionTool } from "../browserActionTool"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"

// Mock the Task class and its dependencies
const mockTask = {
	api: {
		getModel: jest.fn(),
	},
	browserSession: {
		launchBrowser: jest.fn(),
		navigateToUrl: jest.fn(),
		closeBrowser: jest.fn(),
		click: jest.fn(),
		doAction: jest.fn(),
	},
	urlContentFetcher: {
		launchBrowser: jest.fn(),
		urlToMarkdown: jest.fn(),
		closeBrowser: jest.fn(),
	},
	consecutiveMistakeCount: 0,
	recordToolError: jest.fn(),
	sayAndCreateMissingParamError: jest.fn(),
	ask: jest.fn(),
	say: jest.fn(),
} as unknown as Task

const mockAskApproval = jest.fn()
const mockHandleError = jest.fn()
const mockPushToolResult = jest.fn()
const mockRemoveClosingTag = jest.fn((tag: string, content?: string) => content || "")

describe("browserActionTool", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should use visual browsing for models that support images", async () => {
		// Mock model that supports images
		mockTask.api.getModel = jest.fn().mockReturnValue({
			info: { supportsImages: true },
		})

		mockAskApproval.mockResolvedValue(true)
		mockTask.say = jest.fn().mockResolvedValue(undefined)
		mockTask.browserSession.navigateToUrl = jest.fn().mockResolvedValue({
			screenshot: "base64-screenshot-data",
			logs: "Navigation successful",
		})

		const toolUse: ToolUse = {
			type: "tool_use",
			name: "browser_action",
			params: { action: "launch", url: "https://example.com" },
			partial: false,
		}

		await browserActionTool(
			mockTask,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify visual browsing was used
		expect(mockTask.browserSession.launchBrowser).toHaveBeenCalled()
		expect(mockTask.browserSession.navigateToUrl).toHaveBeenCalledWith("https://example.com")
		expect(mockTask.urlContentFetcher.launchBrowser).not.toHaveBeenCalled()

		// The core functionality works - visual browsing path is taken for image-supporting models
	})

	it("should use text-based browsing for models that don't support images", async () => {
		// Mock model that doesn't support images
		mockTask.api.getModel = jest.fn().mockReturnValue({
			info: { supportsImages: false },
		})

		mockAskApproval.mockResolvedValue(true)
		mockTask.say = jest.fn().mockResolvedValue(undefined)

		// Mock the doAction method for the unified text-based browsing
		// The doAction method will be called with a callback that performs page analysis
		mockTask.browserSession.doAction = jest.fn().mockImplementation(async (callback) => {
			// Mock page object with evaluate method
			const mockPage = {
				goto: jest.fn(),
				evaluate: jest.fn().mockResolvedValue({
					content: "<html><body><h1>Example Page</h1><p>This is the page content.</p></body></html>",
					elements: [
						{
							type: "button",
							selector: "#submit-btn",
							text: "Submit",
							description: 'Button: "Submit" (#submit-btn)',
						},
					],
				}),
			}

			// Execute the callback with the mock page
			await callback(mockPage)

			// Return the expected result structure
			return {
				logs: "Navigated to https://example.com using text-based browsing (model does not support images)",
				textContent: "Example Page This is the page content.",
				currentUrl: "https://example.com",
				interactiveElements: [
					{
						type: "button",
						selector: "#submit-btn",
						text: "Submit",
						description: 'Button: "Submit" (#submit-btn)',
					},
				],
			}
		})

		const toolUse: ToolUse = {
			type: "tool_use",
			name: "browser_action",
			params: { action: "launch", url: "https://example.com" },
			partial: false,
		}

		await browserActionTool(
			mockTask,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Verify unified text-based browsing was used
		expect(mockTask.browserSession.launchBrowser).toHaveBeenCalled()
		expect(mockTask.browserSession.doAction).toHaveBeenCalled()
		expect(mockTask.urlContentFetcher.launchBrowser).not.toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("text-based browsing"))
	})

	it("should handle models with undefined supportsImages as not supporting images", async () => {
		// Mock model with undefined supportsImages
		mockTask.api.getModel = jest.fn().mockReturnValue({
			info: { supportsImages: undefined },
		})

		mockAskApproval.mockResolvedValue(true)
		mockTask.say = jest.fn().mockResolvedValue(undefined)

		// Mock the doAction method for the unified text-based browsing
		mockTask.browserSession.doAction = jest.fn().mockResolvedValue({
			logs: "Navigated to https://example.com using text-based browsing (model does not support images)",
			textContent: "# Example Page\n\nContent",
			currentUrl: "https://example.com",
			interactiveElements: [],
		})

		const toolUse: ToolUse = {
			type: "tool_use",
			name: "browser_action",
			params: { action: "launch", url: "https://example.com" },
			partial: false,
		}

		await browserActionTool(
			mockTask,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Should default to unified text-based browsing
		expect(mockTask.browserSession.launchBrowser).toHaveBeenCalled()
		expect(mockTask.urlContentFetcher.launchBrowser).not.toHaveBeenCalled()
	})

	it("should support CSS selector-based click actions for models that don't support images", async () => {
		// Mock model that doesn't support images
		mockTask.api.getModel = jest.fn().mockReturnValue({
			info: { supportsImages: false },
		})

		// Mock the doAction method for CSS selector-based click
		mockTask.browserSession.doAction = jest.fn().mockImplementation(async (callback) => {
			// Mock page object with click and evaluate methods
			const mockPage = {
				click: jest.fn(),
				evaluate: jest.fn().mockResolvedValue({
					content: "<html><body><h1>Page after click</h1></body></html>",
					elements: [],
				}),
			}

			// Execute the callback with the mock page
			await callback(mockPage)

			// Return the expected result structure
			return { currentUrl: "https://example.com" }
		})

		const toolUse: ToolUse = {
			type: "tool_use",
			name: "browser_action",
			params: { action: "click", coordinate: "button.submit" },
			partial: false,
		}

		await browserActionTool(
			mockTask,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Should support CSS selector-based click for text-based browsing
		expect(mockTask.browserSession.doAction).toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("Element was clicked programmatically"))
	})

	it("should clean up browser session on error", async () => {
		mockTask.api.getModel = jest.fn().mockReturnValue({
			info: { supportsImages: false },
		})

		mockAskApproval.mockResolvedValue(true)
		mockTask.say = jest.fn().mockResolvedValue(undefined)

		// Mock browserSession.doAction to throw an error during navigation
		mockTask.browserSession.doAction = jest.fn().mockRejectedValue(new Error("Network error"))

		const toolUse: ToolUse = {
			type: "tool_use",
			name: "browser_action",
			params: { action: "launch", url: "https://example.com" },
			partial: false,
		}

		await browserActionTool(
			mockTask,
			toolUse,
			mockAskApproval,
			mockHandleError,
			mockPushToolResult,
			mockRemoveClosingTag,
		)

		// Browser session should be cleaned up on error
		expect(mockTask.browserSession.closeBrowser).toHaveBeenCalled()
		expect(mockTask.urlContentFetcher.closeBrowser).not.toHaveBeenCalled()
		expect(mockHandleError).toHaveBeenCalledWith("executing browser action", expect.any(Error))
	})
})
