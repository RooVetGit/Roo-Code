import { BrowserManager } from "../BrowserManager"
import { BrowserSession } from "../../../services/browser/BrowserSession"
import { UrlContentFetcher } from "../../../services/browser/UrlContentFetcher"
import * as vscode from "vscode"

// Mock the BrowserSession and UrlContentFetcher classes
jest.mock("../../../services/browser/BrowserSession")
jest.mock("../../../services/browser/UrlContentFetcher")

describe("BrowserManager", () => {
	let browserManager: BrowserManager
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockBrowserSession: jest.Mocked<BrowserSession>
	let mockUrlContentFetcher: jest.Mocked<UrlContentFetcher>

	beforeEach(() => {
		// Create mock context and output channel
		mockContext = {
			extensionPath: "/mock/extension/path",
			globalStorageUri: { fsPath: "/mock/storage/path" } as vscode.Uri,
		} as vscode.ExtensionContext

		mockOutputChannel = {
			appendLine: jest.fn(),
		} as unknown as vscode.OutputChannel

		// Reset mocks
		jest.clearAllMocks()

		// Create BrowserManager instance
		browserManager = new BrowserManager(mockContext, mockOutputChannel)

		// Get the mocked instances
		mockBrowserSession = (BrowserSession as jest.MockedClass<typeof BrowserSession>).mock
			.instances[0] as jest.Mocked<BrowserSession>
		mockUrlContentFetcher = (UrlContentFetcher as jest.MockedClass<typeof UrlContentFetcher>).mock
			.instances[0] as jest.Mocked<UrlContentFetcher>
	})

	test("launchBrowser calls BrowserSession.launchBrowser", async () => {
		await browserManager.launchBrowser()
		expect(mockBrowserSession.launchBrowser).toHaveBeenCalled()
	})

	test("closeBrowser calls BrowserSession.closeBrowser", async () => {
		mockBrowserSession.closeBrowser.mockResolvedValue({})
		await browserManager.closeBrowser()
		expect(mockBrowserSession.closeBrowser).toHaveBeenCalled()
	})

	test("navigateToUrl calls BrowserSession.navigateToUrl", async () => {
		const mockResult = { screenshot: "data:image/png;base64,abc123", logs: "test logs" }
		mockBrowserSession.navigateToUrl.mockResolvedValue(mockResult)

		const result = await browserManager.navigateToUrl("https://example.com")

		expect(mockBrowserSession.navigateToUrl).toHaveBeenCalledWith("https://example.com")
		expect(result).toEqual(mockResult)
	})

	test("click calls BrowserSession.click", async () => {
		const mockResult = { screenshot: "data:image/png;base64,abc123", logs: "test logs" }
		mockBrowserSession.click.mockResolvedValue(mockResult)

		const result = await browserManager.click("100,200")

		expect(mockBrowserSession.click).toHaveBeenCalledWith("100,200")
		expect(result).toEqual(mockResult)
	})

	test("type calls BrowserSession.type", async () => {
		const mockResult = { screenshot: "data:image/png;base64,abc123", logs: "test logs" }
		mockBrowserSession.type.mockResolvedValue(mockResult)

		const result = await browserManager.type("test text")

		expect(mockBrowserSession.type).toHaveBeenCalledWith("test text")
		expect(result).toEqual(mockResult)
	})

	test("scrollDown calls BrowserSession.scrollDown", async () => {
		const mockResult = { screenshot: "data:image/png;base64,abc123", logs: "test logs" }
		mockBrowserSession.scrollDown.mockResolvedValue(mockResult)

		const result = await browserManager.scrollDown()

		expect(mockBrowserSession.scrollDown).toHaveBeenCalled()
		expect(result).toEqual(mockResult)
	})

	test("scrollUp calls BrowserSession.scrollUp", async () => {
		const mockResult = { screenshot: "data:image/png;base64,abc123", logs: "test logs" }
		mockBrowserSession.scrollUp.mockResolvedValue(mockResult)

		const result = await browserManager.scrollUp()

		expect(mockBrowserSession.scrollUp).toHaveBeenCalled()
		expect(result).toEqual(mockResult)
	})

	test("fetchUrlContent calls UrlContentFetcher methods", async () => {
		mockUrlContentFetcher.urlToMarkdown.mockResolvedValue("# Markdown Content")

		const result = await browserManager.fetchUrlContent("https://example.com")

		expect(mockUrlContentFetcher.launchBrowser).toHaveBeenCalled()
		expect(mockUrlContentFetcher.urlToMarkdown).toHaveBeenCalledWith("https://example.com")
		expect(mockUrlContentFetcher.closeBrowser).toHaveBeenCalled()
		expect(result).toBe("# Markdown Content")
	})

	test("fetchUrlContent handles errors and closes browser", async () => {
		const error = new Error("Test error")
		mockUrlContentFetcher.urlToMarkdown.mockRejectedValue(error)

		await expect(browserManager.fetchUrlContent("https://example.com")).rejects.toThrow(error)

		expect(mockUrlContentFetcher.launchBrowser).toHaveBeenCalled()
		expect(mockUrlContentFetcher.closeBrowser).toHaveBeenCalled()
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(`Error fetching URL content: ${error}`)
	})

	test("launchBrowser handles errors", async () => {
		const error = new Error("Test error")
		mockBrowserSession.launchBrowser.mockRejectedValue(error)

		await expect(browserManager.launchBrowser()).rejects.toThrow(error)

		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(`Error launching browser: ${error}`)
	})

	test("closeBrowser handles errors and returns empty object", async () => {
		const error = new Error("Test error")
		mockBrowserSession.closeBrowser.mockRejectedValue(error)

		const result = await browserManager.closeBrowser()

		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(`Error closing browser: ${error}`)
		expect(result).toEqual({})
	})
})
