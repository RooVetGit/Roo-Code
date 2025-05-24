import * as vscode from "vscode"
import { UrlContentFetcher } from "../UrlContentFetcher"
import * as fs from "fs/promises" // Import the fs module

// Mock PCR and puppeteer-core
jest.mock("puppeteer-chromium-resolver", () => {
	return jest.fn().mockResolvedValue({
		puppeteer: {
			launch: jest.fn().mockResolvedValue({
				newPage: jest.fn().mockResolvedValue({
					goto: jest.fn().mockResolvedValue(undefined),
					content: jest.fn().mockResolvedValue("<html><body>Mocked HTML</body></html>"),
				}),
				close: jest.fn().mockResolvedValue(undefined),
			}),
		},
		executablePath: "/mocked/path/to/chromium",
	})
})

jest.mock("fs/promises", () => ({
	...jest.requireActual("fs/promises"), // Import and retain default behavior
	mkdir: jest.fn().mockResolvedValue(undefined), // Mock mkdir
}))

describe("UrlContentFetcher", () => {
	let context: vscode.ExtensionContext
	let urlContentFetcher: UrlContentFetcher

	beforeEach(() => {
		context = {
			globalStorageUri: { fsPath: "/mock/globalStoragePath" } as vscode.Uri,
		} as vscode.ExtensionContext
		urlContentFetcher = new UrlContentFetcher(context)
	})

	afterEach(async () => {
		await urlContentFetcher.closeBrowser()
		jest.restoreAllMocks()
	})

	it("should add --no-sandbox flag when running as root", async () => {
		const originalGetuid = process.getuid
		// @ts-ignore
		process.getuid = jest.fn(() => 0) // Mock getuid to return 0 (root user)

		await urlContentFetcher.launchBrowser()

		const pcr = require("puppeteer-chromium-resolver")
		const puppeteerLaunchMock = pcr.mock.results[0].value.puppeteer.launch
		expect(puppeteerLaunchMock).toHaveBeenCalledWith(
			expect.objectContaining({
				args: expect.arrayContaining(["--no-sandbox"]),
			}),
		)

		// Restore original getuid
		process.getuid = originalGetuid
	})

	it("should not add --no-sandbox flag when not running as root", async () => {
		const originalGetuid = process.getuid
		// @ts-ignore
		process.getuid = jest.fn(() => 1000) // Mock getuid to return a non-root UID

		await urlContentFetcher.launchBrowser()

		const pcr = require("puppeteer-chromium-resolver")
		const puppeteerLaunchMock = pcr.mock.results[0].value.puppeteer.launch
		expect(puppeteerLaunchMock).toHaveBeenCalledWith(
			expect.objectContaining({
				args: expect.not.arrayContaining(["--no-sandbox"]),
			}),
		)

		// Restore original getuid
		process.getuid = originalGetuid
	})

	it("should fetch and convert URL to markdown", async () => {
		await urlContentFetcher.launchBrowser()
		const markdown = await urlContentFetcher.urlToMarkdown("https://example.com")
		expect(markdown).toBe("Mocked HTML") // Turndown would convert <html><body>Mocked HTML</body></html> to "Mocked HTML"
	})
})
