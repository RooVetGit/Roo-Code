import * as vscode from "vscode"
import { BrowserSession } from "../../services/browser/BrowserSession"
import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"
import { BrowserActionResult } from "../../shared/ExtensionMessage"

/**
 * Manages browser-related functionality including browser sessions and URL content fetching
 */
export class BrowserManager {
	private browserSession: BrowserSession
	public urlContentFetcher: UrlContentFetcher
	private context: vscode.ExtensionContext
	private outputChannel: vscode.OutputChannel

	/**
	 * Creates a new BrowserManager instance
	 * @param context The extension context
	 * @param outputChannel The output channel for logging
	 */
	constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
		this.context = context
		this.outputChannel = outputChannel
		this.browserSession = new BrowserSession(context)
		this.urlContentFetcher = new UrlContentFetcher(context)
	}

	/**
	 * Launches a browser session
	 */
	async launchBrowser(): Promise<void> {
		try {
			await this.browserSession.launchBrowser()
		} catch (error) {
			this.outputChannel.appendLine(`Error launching browser: ${error}`)
			throw error
		}
	}

	/**
	 * Closes the browser session
	 */
	async closeBrowser(): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.closeBrowser()
		} catch (error) {
			this.outputChannel.appendLine(`Error closing browser: ${error}`)
			return {}
		}
	}

	/**
	 * Navigates to a URL in the browser
	 * @param url The URL to navigate to
	 */
	async navigateToUrl(url: string): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.navigateToUrl(url)
		} catch (error) {
			this.outputChannel.appendLine(`Error navigating to URL: ${error}`)
			throw error
		}
	}

	/**
	 * Clicks at a specific coordinate in the browser
	 * @param coordinate The coordinate to click at (format: "x,y")
	 */
	async click(coordinate: string): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.click(coordinate)
		} catch (error) {
			this.outputChannel.appendLine(`Error clicking at coordinate: ${error}`)
			throw error
		}
	}

	/**
	 * Types text in the browser
	 * @param text The text to type
	 */
	async type(text: string): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.type(text)
		} catch (error) {
			this.outputChannel.appendLine(`Error typing text: ${error}`)
			throw error
		}
	}

	/**
	 * Scrolls down in the browser
	 */
	async scrollDown(): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.scrollDown()
		} catch (error) {
			this.outputChannel.appendLine(`Error scrolling down: ${error}`)
			throw error
		}
	}

	/**
	 * Scrolls up in the browser
	 */
	async scrollUp(): Promise<BrowserActionResult> {
		try {
			return await this.browserSession.scrollUp()
		} catch (error) {
			this.outputChannel.appendLine(`Error scrolling up: ${error}`)
			throw error
		}
	}

	/**
	 * Fetches content from a URL and converts it to markdown
	 * @param url The URL to fetch content from
	 */
	async fetchUrlContent(url: string): Promise<string> {
		try {
			await this.urlContentFetcher.launchBrowser()
			const markdown = await this.urlContentFetcher.urlToMarkdown(url)
			await this.urlContentFetcher.closeBrowser()
			return markdown
		} catch (error) {
			this.outputChannel.appendLine(`Error fetching URL content: ${error}`)
			await this.urlContentFetcher.closeBrowser()
			throw error
		}
	}
}
