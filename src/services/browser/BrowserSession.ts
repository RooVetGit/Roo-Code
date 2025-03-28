import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { Browser, Page, ScreenshotOptions, TimeoutError, launch, connect, ElementHandle } from "puppeteer-core"
// @ts-ignore
import PCR from "puppeteer-chromium-resolver"
import pWaitFor from "p-wait-for"
import delay from "delay"
import axios from "axios"
import { fileExistsAtPath } from "../../utils/fs"
import { BrowserActionResult } from "../../shared/ExtensionMessage"
import { discoverChromeInstances, testBrowserConnection } from "./browserDiscovery"

interface PCRStats {
	puppeteer: { launch: typeof launch }
	executablePath: string
}

export class BrowserSession {
	private context: vscode.ExtensionContext
	private browser?: Browser
	private page?: Page
	private currentMousePosition?: string
	private cachedWebSocketEndpoint?: string
	private lastConnectionAttempt: number = 0

	constructor(context: vscode.ExtensionContext) {
		this.context = context
	}

	/**
	 * Test connection to a remote browser
	 */
	async testConnection(host: string): Promise<{ success: boolean; message: string; endpoint?: string }> {
		return testBrowserConnection(host)
	}

	private async ensureChromiumExists(): Promise<PCRStats> {
		const globalStoragePath = this.context?.globalStorageUri?.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}

		const puppeteerDir = path.join(globalStoragePath, "puppeteer")
		const dirExists = await fileExistsAtPath(puppeteerDir)
		if (!dirExists) {
			await fs.mkdir(puppeteerDir, { recursive: true })
		}

		// if chromium doesn't exist, this will download it to path.join(puppeteerDir, ".chromium-browser-snapshots")
		// if it does exist it will return the path to existing chromium
		const stats: PCRStats = await PCR({
			downloadPath: puppeteerDir,
		})

		return stats
	}

	async launchBrowser(): Promise<void> {
		console.log("launch browser called")
		if (this.browser) {
			// throw new Error("Browser already launched")
			await this.closeBrowser() // this may happen when the model launches a browser again after having used it already before
		}

		// Function to get viewport size
		const getViewport = () => {
			const size = (this.context.globalState.get("browserViewportSize") as string | undefined) || "900x600"
			const [width, height] = size.split("x").map(Number)
			return { width, height }
		}

		// Check if remote browser connection is enabled
		const remoteBrowserEnabled = this.context.globalState.get("remoteBrowserEnabled") as boolean | undefined

		// If remote browser connection is not enabled, use local browser
		if (!remoteBrowserEnabled) {
			console.log("Remote browser connection is disabled, using local browser")
			const stats = await this.ensureChromiumExists()
			this.browser = await stats.puppeteer.launch({
				args: [
					"--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
				],
				executablePath: stats.executablePath,
				defaultViewport: getViewport(),
				// headless: false,
			})
			this.page = await this.browser?.newPage()
			return
		}
		// Remote browser connection is enabled
		let remoteBrowserHost = this.context.globalState.get("remoteBrowserHost") as string | undefined
		let browserWSEndpoint: string | undefined = this.cachedWebSocketEndpoint
		let reconnectionAttempted = false

		// Try to connect with cached endpoint first if it exists and is recent (less than 1 hour old)
		if (browserWSEndpoint && Date.now() - this.lastConnectionAttempt < 3600000) {
			try {
				console.log(`Attempting to connect using cached WebSocket endpoint: ${browserWSEndpoint}`)
				this.browser = await connect({
					browserWSEndpoint,
					defaultViewport: getViewport(),
				})
				this.page = await this.browser?.newPage()
				return
			} catch (error) {
				console.log(`Failed to connect using cached endpoint: ${error}`)
				// Clear the cached endpoint since it's no longer valid
				this.cachedWebSocketEndpoint = undefined
				// User wants to give up after one reconnection attempt
				if (remoteBrowserHost) {
					reconnectionAttempted = true
				}
			}
		}

		// If user provided a remote browser host, try to connect to it
		if (remoteBrowserHost && !reconnectionAttempted) {
			console.log(`Attempting to connect to remote browser at ${remoteBrowserHost}`)
			try {
				// Fetch the WebSocket endpoint from the Chrome DevTools Protocol
				const versionUrl = `${remoteBrowserHost.replace(/\/$/, "")}/json/version`
				console.log(`Fetching WebSocket endpoint from ${versionUrl}`)

				const response = await axios.get(versionUrl)
				browserWSEndpoint = response.data.webSocketDebuggerUrl

				if (!browserWSEndpoint) {
					throw new Error("Could not find webSocketDebuggerUrl in the response")
				}

				console.log(`Found WebSocket endpoint: ${browserWSEndpoint}`)

				// Cache the successful endpoint
				this.cachedWebSocketEndpoint = browserWSEndpoint
				this.lastConnectionAttempt = Date.now()

				this.browser = await connect({
					browserWSEndpoint,
					defaultViewport: getViewport(),
				})
				this.page = await this.browser?.newPage()
				return
			} catch (error) {
				console.error(`Failed to connect to remote browser: ${error}`)
				// Fall back to auto-discovery if remote connection fails
			}
		}

		// Always try auto-discovery if no custom URL is specified or if connection failed
		try {
			console.log("Attempting auto-discovery...")
			const discoveredHost = await discoverChromeInstances()

			if (discoveredHost) {
				console.log(`Auto-discovered Chrome at ${discoveredHost}`)

				// Don't save the discovered host to global state to avoid overriding user preference
				// We'll just use it for this session

				// Try to connect to the discovered host
				const testResult = await testBrowserConnection(discoveredHost)

				if (testResult.success && testResult.endpoint) {
					// Cache the successful endpoint
					this.cachedWebSocketEndpoint = testResult.endpoint
					this.lastConnectionAttempt = Date.now()

					this.browser = await connect({
						browserWSEndpoint: testResult.endpoint,
						defaultViewport: getViewport(),
					})
					this.page = await this.browser?.newPage()
					return
				}
			}
		} catch (error) {
			console.error(`Auto-discovery failed: ${error}`)
			// Fall back to local browser if auto-discovery fails
		}

		// If all remote connection attempts fail, fall back to local browser
		console.log("Falling back to local browser")
		const stats = await this.ensureChromiumExists()
		this.browser = await stats.puppeteer.launch({
			args: [
				"--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
			],
			executablePath: stats.executablePath,
			defaultViewport: getViewport(),
			// headless: false,
		})
		// (latest version of puppeteer does not add headless to user agent)
		this.page = await this.browser?.newPage()
	}

	async closeBrowser(): Promise<BrowserActionResult> {
		if (this.browser || this.page) {
			console.log("closing browser...")

			const remoteBrowserEnabled = this.context.globalState.get("remoteBrowserEnabled") as string | undefined
			if (remoteBrowserEnabled && this.browser) {
				await this.browser.disconnect().catch(() => {})
			} else {
				await this.browser?.close().catch(() => {})
			}

			this.browser = undefined
			this.page = undefined
			this.currentMousePosition = undefined
		}
		return {}
	}

	async doAction(action: (page: Page) => Promise<void>): Promise<BrowserActionResult> {
		if (!this.page) {
			throw new Error(
				"Browser is not launched. This may occur if the browser was automatically closed by a non-`browser_action` tool.",
			)
		}

		const logs: string[] = []
		let lastLogTs = Date.now()

		const consoleListener = (msg: any) => {
			if (msg.type() === "log") {
				logs.push(msg.text())
			} else {
				logs.push(`[${msg.type()}] ${msg.text()}`)
			}
			lastLogTs = Date.now()
		}

		const errorListener = (err: Error) => {
			logs.push(`[Page Error] ${err.toString()}`)
			lastLogTs = Date.now()
		}

		// Add the listeners
		this.page.on("console", consoleListener)
		this.page.on("pageerror", errorListener)

		try {
			await action(this.page)
		} catch (err) {
			// Re-throw the file chooser error to ensure it propagates to the caller
			if (err instanceof Error && err.message.includes("Clicking this element opened a file selection dialog")) {
				throw err // Re-throw to ensure the click action fails properly
			} else if (!(err instanceof TimeoutError)) {
				logs.push(`[Error] ${err.toString()}`)
			}
			// Re-throw the error to be caught by the caller (e.g., the test)
			throw err
		}

		// Wait for console inactivity, with a timeout
		await pWaitFor(() => Date.now() - lastLogTs >= 500, {
			timeout: 3_000,
			interval: 100,
		}).catch(() => {})

		let options: ScreenshotOptions = {
			encoding: "base64",

			// clip: {
			// 	x: 0,
			// 	y: 0,
			// 	width: 900,
			// 	height: 600,
			// },
		}

		let screenshotBase64 = await this.page.screenshot({
			...options,
			type: "webp",
			quality: ((await this.context.globalState.get("screenshotQuality")) as number | undefined) ?? 75,
		})
		let screenshot = `data:image/webp;base64,${screenshotBase64}`

		if (!screenshotBase64) {
			console.log("webp screenshot failed, trying png")
			screenshotBase64 = await this.page.screenshot({
				...options,
				type: "png",
			})
			screenshot = `data:image/png;base64,${screenshotBase64}`
		}

		if (!screenshotBase64) {
			throw new Error("Failed to take screenshot.")
		}

		// this.page.removeAllListeners() <- causes the page to crash!
		this.page.off("console", consoleListener)
		this.page.off("pageerror", errorListener)

		return {
			screenshot,
			logs: logs.join("\n"),
			currentUrl: this.page.url(),
			currentMousePosition: this.currentMousePosition,
		}
	}

	async navigateToUrl(url: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			// networkidle2 isn't good enough since page may take some time to load. we can assume locally running dev sites will reach networkidle0 in a reasonable amount of time
			await page.goto(url, { timeout: 7_000, waitUntil: ["domcontentloaded", "networkidle2"] })
			// await page.goto(url, { timeout: 10_000, waitUntil: "load" })
			await this.waitTillHTMLStable(page) // in case the page is loading more resources
		})
	}

	// page.goto { waitUntil: "networkidle0" } may not ever resolve, and not waiting could return page content too early before js has loaded
	// https://stackoverflow.com/questions/52497252/puppeteer-wait-until-page-is-completely-loaded/61304202#61304202
	private async waitTillHTMLStable(page: Page, timeout = 5_000) {
		const checkDurationMsecs = 500 // 1000
		const maxChecks = timeout / checkDurationMsecs
		let lastHTMLSize = 0
		let checkCounts = 1
		let countStableSizeIterations = 0
		const minStableSizeIterations = 3

		while (checkCounts++ <= maxChecks) {
			let html = await page.content()
			let currentHTMLSize = html.length

			// let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length)
			console.log("last: ", lastHTMLSize, " <> curr: ", currentHTMLSize)

			if (lastHTMLSize !== 0 && currentHTMLSize === lastHTMLSize) {
				countStableSizeIterations++
			} else {
				countStableSizeIterations = 0 //reset the counter
			}

			if (countStableSizeIterations >= minStableSizeIterations) {
				console.log("Page rendered fully...")
				break
			}

			lastHTMLSize = currentHTMLSize
			await delay(checkDurationMsecs)
		}
	}

	async click(coordinate: string): Promise<BrowserActionResult> {
		const [x, y] = coordinate.split(",").map(Number)
		return this.doAction(async (page) => {
			// Set up file chooser interception
			console.log("[TEST_DEBUG] Attaching filechooser listener")
			page.once("filechooser", async (fileChooser) => {
				console.log("[TEST_DEBUG] Filechooser listener triggered!")
				// Intercept file chooser triggered by click and throw an error
				throw new Error(
					"Clicking this element opened a file selection dialog. You MUST use the 'upload' action with a valid CSS selector for the file input element and the file path instead of clicking.",
				)
			})
			console.log("[TEST_DEBUG] Filechooser listener attached")

			// Set up network activity monitoring
			let hasNetworkActivity = false
			const requestListener = () => {
				hasNetworkActivity = true
			}

			// Add the request listener to detect network activity
			page.on("request", requestListener)

			// Perform the click
			console.log(`[TEST_DEBUG] Performing click at ${x},${y}`)
			await page.mouse.click(x, y)
			console.log(`[TEST_DEBUG] Click performed at ${x},${y}`)
			this.currentMousePosition = coordinate

			// Small delay before checking for navigation
			await delay(100)

			// Wait for navigation/loading only if there was network activity
			if (hasNetworkActivity) {
				await page
					.waitForNavigation({
						waitUntil: ["domcontentloaded", "networkidle2"],
						timeout: 7000,
					})
					.catch(() => {})
				await this.waitTillHTMLStable(page)
			}

			// Clean up the request listener
			page.off("request", requestListener)
		})
	}

	async type(text: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await page.keyboard.type(text)
		})
	}

	async scrollDown(): Promise<BrowserActionResult> {
		const size = ((await this.context.globalState.get("browserViewportSize")) as string | undefined) || "900x600"
		const height = parseInt(size.split("x")[1])
		return this.doAction(async (page) => {
			await page.evaluate((scrollHeight) => {
				window.scrollBy({
					top: scrollHeight,
					behavior: "auto",
				})
			}, height)
			await delay(300)
		})
	}

	async scrollUp(): Promise<BrowserActionResult> {
		const size = ((await this.context.globalState.get("browserViewportSize")) as string | undefined) || "900x600"
		const height = parseInt(size.split("x")[1])
		return this.doAction(async (page) => {
			await page.evaluate((scrollHeight) => {
				window.scrollBy({
					top: -scrollHeight,
					behavior: "auto",
				})
			}, height)
			await delay(300)
		})
	}

	/**
	 * Uploads a file to a file input element identified by the selector
	 *
	 * This method implements a robust file upload strategy with multiple fallback mechanisms:
	 * 1. First tries to directly set the file on the input element (works with hidden inputs)
	 * 2. Falls back to using the FileChooser API if direct method fails
	 *
	 * @param selector CSS selector for the file input element
	 * @param filepath Path to the file to upload
	 * @returns Browser action result with screenshot and logs
	 */
	async upload(selector: string, filepath: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			// Verify file exists before attempting upload
			await this.verifyFileExists(filepath)

			console.log(`[UPLOAD] Starting upload of file: ${filepath} using selector: ${selector}`)

			// Set up network monitoring to track upload activity
			const { requestListener, responseListener } = this.setupNetworkMonitoring(page)
			page.on("request", requestListener)
			page.on("response", responseListener)

			// Track initial page state to detect changes after upload
			const initialUrl = page.url()
			const initialContent = await page.content()

			try {
				// Try multiple upload methods with fallbacks
				await this.attemptUploadWithMultipleMethods(page, selector, filepath, initialUrl, initialContent)
			} catch (error) {
				console.error(`[UPLOAD] All upload methods failed: ${error.message}`)
				throw new Error(
					`Failed to upload file: ${error.message}. Please check that your selector points to a valid file input element.`,
				)
			} finally {
				// Clean up listeners
				page.off("request", requestListener)
				page.off("response", responseListener)
			}
		})
	}

	/**
	 * Verifies that the file exists before attempting to upload it
	 *
	 * @param filepath Path to the file to upload
	 * @throws Error if the file does not exist
	 */
	private async verifyFileExists(filepath: string): Promise<void> {
		try {
			await fs.access(filepath)
		} catch (error) {
			throw new Error(`File not found: ${filepath}. Please check the path and ensure the file exists.`)
		}
	}

	/**
	 * Sets up network monitoring to track upload activity
	 *
	 * @param page The Puppeteer page
	 * @returns Object containing request and response listeners
	 */
	private setupNetworkMonitoring(page: Page): {
		requestListener: (request: any) => void
		responseListener: (response: any) => void
	} {
		const requestListener = (request: any) => {
			const url = request.url()
			if (request.method() === "POST" || request.method() === "PUT") {
				console.log(`[UPLOAD] Network request: ${request.method()} ${url}`)
			}
		}

		const responseListener = (response: any) => {
			const url = response.url()
			const status = response.status()
			if (status >= 200 && status < 300) {
				console.log(`[UPLOAD] Network response: ${status} ${url}`)
			} else if (status >= 400) {
				console.log(`[UPLOAD] Network error: ${status} ${url}`)
			}
		}

		return { requestListener, responseListener }
	}

	/**
	 * Attempts to upload a file using multiple methods with fallbacks
	 *
	 * @param page The Puppeteer page
	 * @param selector CSS selector for the file input element
	 * @param filepath Path to the file to upload
	 * @param initialUrl The URL before the upload started
	 * @param initialContent The page content before the upload started
	 */
	private async attemptUploadWithMultipleMethods(
		page: Page,
		selector: string,
		filepath: string,
		initialUrl: string,
		initialContent: string,
	): Promise<void> {
		// Try direct input method first (most reliable)
		try {
			await this.uploadWithDirectInputMethod(page, selector, filepath, initialUrl, initialContent)
			return
		} catch (directMethodError) {
			console.log(`[UPLOAD] Direct input method failed: ${directMethodError.message}`)
			console.log("[UPLOAD] Trying FileChooser API method as fallback")
		}

		// Try FileChooser API method as fallback
		try {
			await this.uploadWithFileChooserAPI(page, selector, filepath, initialUrl, initialContent)
			return
		} catch (fileChooserError) {
			console.error(`[UPLOAD] FileChooser API method failed: ${fileChooserError.message}`)
			throw new Error("All upload methods failed. Please check the selector and file path.")
		}
	}

	/**
	 * Uploads a file using the direct input method
	 * This method works by directly setting the file on the input element
	 *
	 * @param page The Puppeteer page
	 * @param selector CSS selector for the file input element
	 * @param filepath Path to the file to upload
	 * @param initialUrl The URL before the upload started
	 * @param initialContent The page content before the upload started
	 */
	private async uploadWithDirectInputMethod(
		page: Page,
		selector: string,
		filepath: string,
		initialUrl: string,
		initialContent: string,
	): Promise<void> {
		const fileInputs = await page.$$('input[type="file"]')

		if (fileInputs.length === 0) {
			console.log("[UPLOAD] No file input elements found on the page")
			throw new Error("No file input elements found on the page")
		}

		// Find the target input element
		const targetInput = await this.findTargetFileInput(page, selector, fileInputs)

		// Now that we have a file input element, set its file
		if (targetInput) {
			// Make the file input visible and enabled if it's hidden
			const originalStyles = await this.makeFileInputAccessible(page, targetInput)

			// Upload the file
			const inputElement = targetInput as unknown as ElementHandle<HTMLInputElement>
			await inputElement.uploadFile(filepath)
			console.log(`[UPLOAD] File uploaded successfully using direct input method: ${filepath}`)

			// Restore the original styles
			await this.restoreFileInputStyles(page, targetInput, originalStyles)

			// Wait for upload to complete
			await this.waitForUploadToComplete(page, initialUrl, initialContent)
		} else {
			throw new Error("Could not find a suitable file input element")
		}
	}

	/**
	 * Finds the target file input element based on the selector
	 * Falls back to the first available file input if the selector doesn't match
	 *
	 * @param page The Puppeteer page
	 * @param selector CSS selector for the file input element
	 * @param fileInputs Array of file input elements found on the page
	 * @returns The target file input element or null if not found
	 */
	private async findTargetFileInput(
		page: Page,
		selector: string,
		fileInputs: ElementHandle<Element>[],
	): Promise<ElementHandle<Element> | null> {
		let targetInput = null

		// First try direct match
		try {
			targetInput = await page.$(selector)

			if (targetInput) {
				// Check if this is actually a file input
				const isFileInput = await page.evaluate((el) => (el as HTMLInputElement).type === "file", targetInput)
				if (!isFileInput) {
					console.log(`[UPLOAD] Selected element with selector "${selector}" is not a file input`)
					targetInput = null
				}
			}
		} catch (err) {
			console.log(`[UPLOAD] Error finding element with selector "${selector}": ${err.message}`)
		}

		// If we couldn't find the exact selector or it wasn't a file input,
		// try to find the closest file input
		if (!targetInput) {
			console.log(`[UPLOAD] Could not find file input with selector "${selector}", trying to find any file input`)

			// Just use the first file input as a fallback
			targetInput = fileInputs[0]
			console.log(`[UPLOAD] Using first available file input as fallback`)
		}

		return targetInput
	}

	/**
	 * Makes a file input element accessible by modifying its styles
	 * This is necessary for hidden file inputs that are not directly interactive
	 *
	 * @param page The Puppeteer page
	 * @param inputElement The file input element
	 * @returns The original styles to restore later
	 */
	private async makeFileInputAccessible(page: Page, inputElement: ElementHandle<Element>): Promise<any> {
		return page.evaluate((el) => {
			// Cast to HTMLInputElement to access style and other properties
			const input = el as HTMLInputElement

			// Save original values to restore later
			const originalDisplay = input.style.display
			const originalVisibility = input.style.visibility
			const originalPosition = input.style.position

			// Make it visible and interactive
			input.style.display = "block"
			input.style.visibility = "visible"
			input.style.position = "fixed"
			input.style.top = "0"
			input.style.left = "0"
			input.style.opacity = "1"
			input.style.zIndex = "9999"
			input.disabled = false

			return { originalDisplay, originalVisibility, originalPosition }
		}, inputElement)
	}

	/**
	 * Restores the original styles of a file input element
	 *
	 * @param page The Puppeteer page
	 * @param inputElement The file input element
	 * @param originalStyles The original styles to restore
	 */
	private async restoreFileInputStyles(
		page: Page,
		inputElement: ElementHandle<Element>,
		originalStyles: any,
	): Promise<void> {
		await page.evaluate(
			(el, originals) => {
				// Cast to HTMLInputElement to access style properties
				const input = el as HTMLInputElement
				input.style.display = originals.originalDisplay
				input.style.visibility = originals.originalVisibility
				input.style.position = originals.originalPosition
			},
			inputElement,
			originalStyles,
		)
	}

	/**
	 * Attempts to upload a file using the FileChooser API
	 * This is a fallback method that works by clicking on the file input
	 *
	 * @param page The Puppeteer page
	 * @param selector CSS selector for the file input element
	 * @param filepath Path to the file to upload
	 * @param initialUrl The URL before the upload started
	 * @param initialContent The page content before the upload started
	 */
	private async uploadWithFileChooserAPI(
		page: Page,
		selector: string,
		filepath: string,
		initialUrl: string,
		initialContent: string,
	): Promise<void> {
		console.log("[UPLOAD] Trying FileChooser API method as fallback")
		try {
			const [fileChooser] = await Promise.all([
				page.waitForFileChooser({ timeout: 5000 }),
				page.click(selector).catch((err) => {
					throw new Error(`Failed to click on selector "${selector}": ${err.message}`)
				}),
			])

			await fileChooser.accept([filepath])
			console.log(`[UPLOAD] File uploaded successfully using FileChooser API: ${filepath}`)

			// Wait for upload to complete
			await this.waitForUploadToComplete(page, initialUrl, initialContent)
		} catch (fileChooserError) {
			console.error(`[UPLOAD] FileChooser API method failed: ${fileChooserError.message}`)
			throw new Error(
				`Upload failed: ${fileChooserError.message}. Try using a more specific selector for the file input element.`,
			)
		}
	}

	/**
	 * Waits for an upload to complete by monitoring network activity, URL changes, and UI changes
	 *
	 * This method uses multiple strategies to detect when an upload has completed:
	 * 1. Monitors network activity and waits for it to settle
	 * 2. Checks for URL changes that might indicate navigation after upload
	 * 3. Checks for content changes that might indicate successful upload
	 * 4. Looks for common success indicators in the page content
	 *
	 * @param page The Puppeteer page
	 * @param initialUrl The URL before the upload started
	 * @param initialContent The page content before the upload started
	 */
	private async waitForUploadToComplete(page: Page, initialUrl: string, initialContent: string): Promise<void> {
		console.log("[UPLOAD] Waiting for upload to complete...")

		// Wait for network activity to settle
		try {
			// First, wait a short time for any network activity to start
			await delay(500)

			await this.waitForNetworkActivityToSettle(page)

			// Wait for HTML to stabilize
			await this.waitTillHTMLStable(page, 10000)

			// Check for changes that might indicate successful upload
			await this.detectUploadCompletionChanges(page, initialUrl, initialContent)

			console.log("[UPLOAD] Upload process completed successfully")
		} catch (error) {
			console.error(`[UPLOAD] Error while waiting for upload to complete: ${error.message}`)
		}
	}

	/**
	 * Waits for network activity to settle (no new activity for 2 seconds)
	 *
	 * @param page The Puppeteer page
	 */
	private async waitForNetworkActivityToSettle(page: Page): Promise<void> {
		// Track network activity
		let lastNetworkActivityTime = Date.now()
		let hasActiveRequests = false

		const requestStartListener = () => {
			hasActiveRequests = true
			lastNetworkActivityTime = Date.now()
		}

		const requestEndListener = () => {
			lastNetworkActivityTime = Date.now()
		}

		page.on("request", requestStartListener)
		page.on("requestfinished", requestEndListener)
		page.on("requestfailed", requestEndListener)

		try {
			await pWaitFor(
				() => {
					const timeSinceLastActivity = Date.now() - lastNetworkActivityTime
					const networkIsQuiet = timeSinceLastActivity > 2000

					if (networkIsQuiet && hasActiveRequests) {
						console.log("[UPLOAD] Network activity has settled")
						return true
					}

					return false
				},
				{
					timeout: 15000, // 15 seconds max wait time
					interval: 500,
				},
			)
		} catch (error) {
			console.log("[UPLOAD] Timed out waiting for network activity to settle")
		} finally {
			// Clean up listeners
			page.off("request", requestStartListener)
			page.off("requestfinished", requestEndListener)
			page.off("requestfailed", requestEndListener)
		}
	}

	/**
	 * Detects changes that might indicate a successful upload
	 *
	 * @param page The Puppeteer page
	 * @param initialUrl The URL before the upload started
	 * @param initialContent The page content before the upload started
	 */
	private async detectUploadCompletionChanges(page: Page, initialUrl: string, initialContent: string): Promise<void> {
		// Check for URL changes that might indicate successful upload
		const currentUrl = page.url()
		if (currentUrl !== initialUrl) {
			console.log(`[UPLOAD] URL changed after upload: ${initialUrl} -> ${currentUrl}`)
		}

		// Check for content changes that might indicate successful upload
		const currentContent = await page.content()
		if (currentContent.length !== initialContent.length) {
			console.log(
				`[UPLOAD] Page content changed after upload: ${initialContent.length} bytes -> ${currentContent.length} bytes`,
			)
		}

		// Look for common success indicators in the page
		const successIndicators = await this.checkForUploadSuccessIndicators(page)
		if (successIndicators.length > 0) {
			console.log(`[UPLOAD] Found success indicators: ${successIndicators.join(", ")}`)
		}
	}
	/**
	 * Checks for common indicators that an upload was successful
	 *
	 * This method looks for:
	 * 1. Success text messages in the page content
	 * 2. Success elements/icons that might indicate completion
	 * 3. New file elements that might have appeared after upload
	 *
	 * @param page The Puppeteer page
	 * @returns Array of success indicators found
	 */
	private async checkForUploadSuccessIndicators(page: Page): Promise<string[]> {
		const indicators: string[] = []

		try {
			// Check for success messages
			const successTexts = [
				"success",
				"uploaded",
				"complete",
				"finished",
				"done",
				"file uploaded",
				"upload successful",
				"upload complete",
			]

			// Look for success text in the page
			const successTextFound = await page.evaluate((texts) => {
				const pageText = document.body.innerText.toLowerCase()
				return texts.find((text) => pageText.includes(text.toLowerCase()))
			}, successTexts)

			if (successTextFound) {
				indicators.push(`Success text: "${successTextFound}"`)
			}

			// Check for success icons or elements
			const successSelectors = [
				".success",
				".upload-success",
				".complete",
				".done",
				'[data-status="success"]',
				'[data-upload-status="complete"]',
				".fa-check",
				".fa-check-circle",
				'.material-icons:contains("check")',
			]

			for (const selector of successSelectors) {
				try {
					const element = await page.$(selector)
					if (element) {
						indicators.push(`Success element: "${selector}"`)
						break
					}
				} catch (error) {
					// Ignore errors from invalid selectors
				}
			}

			// Check for new file elements that might have appeared
			const fileSelectors = [
				".file",
				".file-item",
				".uploaded-file",
				".document",
				'[data-type="file"]',
				"[data-file-type]",
			]

			for (const selector of fileSelectors) {
				try {
					const elements = await page.$$(selector)
					if (elements.length > 0) {
						indicators.push(`File elements: ${elements.length} "${selector}" elements found`)
						break
					}
				} catch (error) {
					// Ignore errors from invalid selectors
				}
			}
		} catch (error) {
			console.error(`[UPLOAD] Error checking for success indicators: ${error.message}`)
		}

		return indicators
	}

	// Helper method for testing to get element coordinates
	async getElementCoordinatesForTest(selector: string): Promise<{ x: number; y: number } | null> {
		if (!this.page) {
			throw new Error("Browser page not available")
		}
		const element = await this.page.$(selector)
		if (!element) {
			return null
		}
		const boundingBox = await element.boundingBox()
		if (!boundingBox) {
			return null
		}
		return {
			x: Math.round(boundingBox.x + boundingBox.width / 2),
			y: Math.round(boundingBox.y + boundingBox.height / 2),
		}
	}
}
