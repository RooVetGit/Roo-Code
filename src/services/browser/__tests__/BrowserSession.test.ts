import { BrowserSession } from "../BrowserSession"
import * as vscode from "vscode"
import { Browser, Page, TimeoutError, Viewport } from "puppeteer-core"
// @ts-ignore
import PCR from "puppeteer-chromium-resolver"
import fs from "fs/promises"

// Mock dependencies
jest.mock("puppeteer-core")
jest.mock("puppeteer-chromium-resolver")
jest.mock("p-wait-for", () => jest.fn().mockImplementation(() => Promise.resolve()))
jest.mock("fs/promises")

describe("BrowserSession", () => {
	let browserSession: BrowserSession
	let mockContext: vscode.ExtensionContext
	let mockBrowser: jest.Mocked<Browser>
	let mockPage: jest.Mocked<Page>

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks()

		// Mock fs.mkdir
		;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)

		// Setup mock context
		mockContext = {
			globalState: {
				get: jest.fn().mockImplementation((key) => {
					if (key === "keepBrowserOpen") return Promise.resolve(false)
					if (key === "screenshotQuality") return Promise.resolve(75)
					return Promise.resolve(undefined)
				}),
				update: jest.fn(),
			},
			globalStorageUri: { fsPath: "/mock/storage/path" },
		} as unknown as vscode.ExtensionContext

		// Setup mock page
		mockPage = {
			goto: jest.fn().mockResolvedValue(undefined),
			setViewport: jest.fn().mockResolvedValue(undefined),
			setExtraHTTPHeaders: jest.fn().mockResolvedValue(undefined),
			setDefaultNavigationTimeout: jest.fn().mockResolvedValue(undefined),
			screenshot: jest.fn().mockResolvedValue(Buffer.from("mock-screenshot-base64")),
			mouse: {
				click: jest.fn(),
			},
			keyboard: {
				type: jest.fn(),
			},
			evaluate: jest.fn(),
			content: jest.fn().mockResolvedValue("<html></html>"),
			on: jest.fn().mockReturnThis(),
			off: jest.fn().mockReturnThis(),
			url: jest.fn().mockReturnValue("http://test.com"),
			waitForNavigation: jest.fn(),
		} as unknown as jest.Mocked<Page>

		// Setup mock browser
		mockBrowser = {
			newPage: jest.fn().mockResolvedValue(mockPage),
			close: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<Browser>

		// Mock PCR
		;(PCR as jest.Mock).mockResolvedValue({
			puppeteer: {
				launch: jest.fn().mockResolvedValue(mockBrowser),
			},
			executablePath: "/mock/chromium/path",
			launchOptions: {},
		})

		// Create browser session instance
		browserSession = new BrowserSession(mockContext)
	})

	describe("launchBrowser", () => {
		it("should launch browser with correct configuration", async () => {
			// Setup synchronous mocks
			const mockPuppeteer = {
				launch: jest.fn().mockReturnValue(Promise.resolve(mockBrowser)),
			}
			mockBrowser.newPage.mockReturnValue(Promise.resolve(mockPage))
			mockPage.setViewport.mockReturnValue(Promise.resolve())
			;(PCR as jest.Mock).mockReturnValue(
				Promise.resolve({
					puppeteer: mockPuppeteer,
					executablePath: "/mock/chromium/path",
					launchOptions: {},
				}),
			)

			// Launch browser and wait for all promises to resolve
			await browserSession.launchBrowser()
			await Promise.all([
				mockPuppeteer.launch(),
				mockBrowser.newPage(),
				mockPage.setViewport({ width: 1280, height: 800 } as Viewport),
			])

			// Verify browser was launched and page was created
			expect(mockBrowser.newPage).toHaveBeenCalled()
			expect(mockPage.setViewport).toHaveBeenCalled()
		})

		it("should close existing browser before launching new one", async () => {
			// Launch browser first time
			await browserSession.launchBrowser()

			// Launch second time
			await browserSession.launchBrowser()

			expect(mockBrowser.close).toHaveBeenCalled()
		})
	})

	describe("closeBrowser", () => {
		it("should close browser when keepBrowserOpen is false", async () => {
			await browserSession.launchBrowser()
			await browserSession.closeBrowser()

			expect(mockBrowser.close).toHaveBeenCalled()
		})

		it("should keep browser open when keepBrowserOpen is true", async () => {
			mockContext.globalState.get = jest.fn().mockResolvedValue(true)
			await browserSession.launchBrowser()
			await browserSession.closeBrowser()

			expect(mockBrowser.close).not.toHaveBeenCalled()
		})
	})

	describe("navigateToUrl", () => {
		beforeEach(async () => {
			await browserSession.launchBrowser()
		})

		it("should navigate to URL with correct options", async () => {
			await browserSession.navigateToUrl("http://test.com")

			expect(mockPage.goto).toHaveBeenCalledWith(
				"http://test.com",
				expect.objectContaining({
					timeout: 15_000,
					waitUntil: "domcontentloaded",
				}),
			)
		})

		it("should wait for HTML to stabilize", async () => {
			let htmlSize = 100
			let callCount = 0
			const maxCalls = 5

			mockPage.content.mockImplementation(async () => {
				if (callCount++ >= maxCalls) {
					return "x".repeat(htmlSize) // Return same size after max calls
				}
				htmlSize += 100
				return "x".repeat(htmlSize)
			})

			await browserSession.navigateToUrl("http://test.com")

			expect(mockPage.content).toHaveBeenCalled()
			expect(callCount).toBeGreaterThan(0)
		})
	})

	describe("click", () => {
		beforeEach(async () => {
			await browserSession.launchBrowser()
		})

		it("should click at specified coordinates", async () => {
			await browserSession.click("100,200")

			expect(mockPage.mouse.click).toHaveBeenCalledWith(100, 200)
		})

		it("should handle navigation after click", async () => {
			// Simulate network activity
			mockPage.on.mockImplementation((event, handler) => {
				if (event === "request") {
					handler({})
				}
				return mockPage
			})

			await browserSession.click("100,200")

			expect(mockPage.waitForNavigation).toHaveBeenCalled()
		})
	})

	describe("type", () => {
		beforeEach(async () => {
			await browserSession.launchBrowser()
		})

		it("should type text correctly", async () => {
			await browserSession.type("test text")

			expect(mockPage.keyboard.type).toHaveBeenCalledWith("test text")
		})
	})

	describe("scroll", () => {
		beforeEach(async () => {
			await browserSession.launchBrowser()
		})

		it("should scroll down by viewport height", async () => {
			await browserSession.scrollDown()

			expect(mockPage.evaluate).toHaveBeenCalled()
		})

		it("should scroll up by viewport height", async () => {
			await browserSession.scrollUp()

			expect(mockPage.evaluate).toHaveBeenCalled()
		})
	})

	describe("viewport management", () => {
		beforeEach(async () => {
			await browserSession.launchBrowser()
		})

		it("should set viewport size", async () => {
			const callback = jest.fn()
			browserSession.setOnViewportChange(callback)

			await browserSession.setViewport("1024x768")

			expect(mockPage.setViewport).toHaveBeenCalledWith({
				width: 1024,
				height: 768,
			})
			expect(callback).toHaveBeenCalledWith("1024x768")
		})

		it("should get current viewport size", () => {
			expect(browserSession.getViewportSize()).toBe("900x600") // Default size
		})
	})

	describe("doAction", () => {
		beforeEach(async () => {
			await browserSession.launchBrowser()
		})

		it("should capture console logs", async () => {
			mockPage.on.mockImplementation((event, handler) => {
				if (event === "console") {
					handler({
						type: () => "log",
						text: () => "test log",
					})
				}
				return mockPage
			})

			const result = await browserSession.doAction(async () => {
				// Simulate some action
			})

			expect(result.logs).toContain("test log")
		})

		it("should capture page errors", async () => {
			mockPage.on.mockImplementation((event, handler) => {
				if (event === "pageerror") {
					handler(new Error("test error"))
				}
				return mockPage
			})

			const result = await browserSession.doAction(async () => {
				// Simulate some action
			})

			expect(result.logs).toContain("[Page Error] Error: test error")
		})

		it("should handle action errors", async () => {
			const result = await browserSession.doAction(async () => {
				throw new Error("action error")
			})

			expect(result.logs).toContain("[Error] Error: action error")
		})

		it("should not log timeout errors", async () => {
			const result = await browserSession.doAction(async () => {
				throw new TimeoutError("timeout")
			})

			expect(result.logs).not.toContain("[Error] TimeoutError: timeout")
		})

		it("should take screenshot after action", async () => {
			const result = await browserSession.doAction(async () => {
				// Simulate some action
			})

			expect(mockPage.screenshot).toHaveBeenCalledWith(
				expect.objectContaining({
					encoding: "base64",
					type: "webp",
					quality: 75,
				}),
			)
			expect(result.screenshot).toContain("data:image/webp;base64,mock-screenshot-base64")
		})

		it("should fallback to PNG screenshot if WebP fails", async () => {
			// First call returns empty buffer to simulate WebP failure
			mockPage.screenshot
				.mockResolvedValueOnce(Buffer.alloc(0))
				.mockResolvedValueOnce(Buffer.from("mock-png-screenshot"))

			const result = await browserSession.doAction(async () => {
				// Simulate some action
			})

			// Verify screenshot was called with correct options
			expect(mockPage.screenshot).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					encoding: "base64",
					type: "webp",
					quality: 75,
				}),
			)
			expect(mockPage.screenshot).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					encoding: "base64",
					type: "png",
				}),
			)
			expect(mockPage.screenshot).toHaveBeenCalledTimes(2)
			expect(result.screenshot).toContain("data:image/png;base64,mock-png-screenshot")
		})
	})

	afterEach(async () => {
		await browserSession.closeBrowser()
	})
})
