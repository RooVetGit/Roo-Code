import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import {
	BrowserAction,
	BrowserActionResult,
	browserActions,
	ClineSayBrowserAction,
	InteractiveElement,
} from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"

// Helper function to analyze page for text-based browsing
async function analyzePageForTextBrowsing(page: any): Promise<{ content: string; elements: InteractiveElement[] }> {
	try {
		// Extract both content and interactive elements from the same page instance
		const result = await page.evaluate(() => {
			// Get page content and clean it up
			const content = document.documentElement.outerHTML

			// Extract interactive elements
			const elements: any[] = []

			// Find buttons
			document.querySelectorAll("button").forEach((btn, index) => {
				const text = btn.textContent?.trim() || ""
				const selector = btn.id
					? `#${btn.id}`
					: btn.className
						? `.${btn.className.split(" ")[0]}`
						: `button:nth-of-type(${index + 1})`
				elements.push({
					type: "button",
					selector,
					text,
					description: `Button: "${text}" (${selector})`,
				})
			})

			// Find links
			document.querySelectorAll("a[href]").forEach((link, index) => {
				const text = link.textContent?.trim() || ""
				const href = link.getAttribute("href") || ""
				const selector = link.id
					? `#${link.id}`
					: link.className
						? `.${link.className.split(" ")[0]}`
						: `a:nth-of-type(${index + 1})`
				elements.push({
					type: "link",
					selector,
					text,
					href,
					description: `Link: "${text}" -> ${href} (${selector})`,
				})
			})

			// Find input fields
			document.querySelectorAll("input").forEach((input, index) => {
				const type = input.type || "text"
				const placeholder = input.placeholder || ""
				const name = input.name || ""
				const selector = input.id
					? `#${input.id}`
					: input.name
						? `input[name="${input.name}"]`
						: `input:nth-of-type(${index + 1})`
				elements.push({
					type: "input",
					selector,
					placeholder,
					description: `Input (${type}): ${name || placeholder || "unnamed"} (${selector})`,
				})
			})

			// Find textareas
			document.querySelectorAll("textarea").forEach((textarea, index) => {
				const placeholder = textarea.placeholder || ""
				const name = textarea.name || ""
				const selector = textarea.id
					? `#${textarea.id}`
					: textarea.name
						? `textarea[name="${textarea.name}"]`
						: `textarea:nth-of-type(${index + 1})`
				elements.push({
					type: "textarea",
					selector,
					placeholder,
					description: `Textarea: ${name || placeholder || "unnamed"} (${selector})`,
				})
			})

			return { content, elements }
		})

		// Convert HTML to markdown using a simple approach
		// Remove script, style, nav, footer, header tags and their content
		let cleanContent = result.content
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
			.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
			.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
			.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
			.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")

		// Simple HTML to text conversion
		const textContent = cleanContent
			.replace(/<[^>]*>/g, " ") // Remove HTML tags
			.replace(/\s+/g, " ") // Normalize whitespace
			.trim()

		return { content: textContent, elements: result.elements }
	} catch (error) {
		console.error("Error analyzing page for text browsing:", error)
		return {
			content: `Error analyzing page: ${error.message}`,
			elements: [],
		}
	}
}

export async function browserActionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const action: BrowserAction | undefined = block.params.action as BrowserAction
	const url: string | undefined = block.params.url
	const coordinate: string | undefined = block.params.coordinate
	const text: string | undefined = block.params.text
	const size: string | undefined = block.params.size

	if (!action || !browserActions.includes(action)) {
		// checking for action to ensure it is complete and valid
		if (!block.partial) {
			// if the block is complete and we don't have a valid action cline is a mistake
			cline.consecutiveMistakeCount++
			cline.recordToolError("browser_action")
			pushToolResult(await cline.sayAndCreateMissingParamError("browser_action", "action"))
			await cline.browserSession.closeBrowser()
		}

		return
	}

	try {
		if (block.partial) {
			if (action === "launch") {
				await cline.ask("browser_action_launch", removeClosingTag("url", url), block.partial).catch(() => {})
			} else {
				await cline.say(
					"browser_action",
					JSON.stringify({
						action: action as BrowserAction,
						coordinate: removeClosingTag("coordinate", coordinate),
						text: removeClosingTag("text", text),
					} satisfies ClineSayBrowserAction),
					undefined,
					block.partial,
				)
			}
			return
		} else {
			// Initialize with empty object to avoid "used before assigned" errors
			let browserActionResult: BrowserActionResult = {}

			if (action === "launch") {
				if (!url) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("browser_action")
					pushToolResult(await cline.sayAndCreateMissingParamError("browser_action", "url"))
					await cline.browserSession.closeBrowser()
					return
				}

				cline.consecutiveMistakeCount = 0
				const didApprove = await askApproval("browser_action_launch", url)

				if (!didApprove) {
					return
				}

				// Check model capabilities to determine browsing method
				const modelSupportsImages = cline.api.getModel().info.supportsImages ?? false
				const modelSupportsComputerUse = cline.api.getModel().info.supportsComputerUse ?? false

				if (modelSupportsImages) {
					// Use visual browser session for models that support images
					await cline.say("browser_action_result", "") // Starts loading spinner

					await cline.browserSession.launchBrowser(modelSupportsImages, modelSupportsComputerUse)
					browserActionResult = await cline.browserSession.navigateToUrl(url)
				} else {
					// Use text-based browsing for models that don't support images
					try {
						// Pass model capabilities to browser session
						await cline.browserSession.launchBrowser(modelSupportsImages, modelSupportsComputerUse)

						// Navigate to the URL and extract both content and interactive elements
						let pageAnalysis: { content: string; elements: InteractiveElement[] }

						await cline.browserSession.doAction(async (page) => {
							await page.goto(url, { timeout: 10_000, waitUntil: ["domcontentloaded", "networkidle2"] })

							// Extract text content and interactive elements from the same page instance
							pageAnalysis = await analyzePageForTextBrowsing(page)
						})

						const modeDescription = "text-based browsing (model does not support images)"

						browserActionResult = {
							logs: `Navigated to ${url} using ${modeDescription}`,
							screenshot: undefined,
							textContent: pageAnalysis!.content,
							currentUrl: url,
							interactiveElements: pageAnalysis!.elements,
						}
					} catch (error) {
						await cline.browserSession.closeBrowser()
						throw error
					}
				}
			} else {
				// Check model capabilities for non-launch actions
				const modelSupportsImages = cline.api.getModel().info.supportsImages ?? false
				const modelSupportsComputerUse = cline.api.getModel().info.supportsComputerUse ?? false

				// For text-based browsing, we support enhanced programmatic interaction
				if (!modelSupportsImages && action !== "close") {
					if (action === "click") {
						if (!coordinate) {
							cline.consecutiveMistakeCount++
							cline.recordToolError("browser_action")
							pushToolResult(await cline.sayAndCreateMissingParamError("browser_action", "coordinate"))
							return
						}

						try {
							// For text-based browsing, coordinate should be a CSS selector
							const selector = coordinate

							// Perform the click action and get updated page analysis
							let pageAnalysis: { content: string; elements: InteractiveElement[] }
							const clickResult = await cline.browserSession.doAction(async (page) => {
								await page.click(selector)
								// Get updated page state after the action
								pageAnalysis = await analyzePageForTextBrowsing(page)
							})

							const currentUrl = clickResult.currentUrl || url || ""

							browserActionResult = {
								logs: `Clicked element with selector "${selector}". Page updated.`,
								currentUrl: currentUrl,
								textContent: pageAnalysis!.content,
								interactiveElements: pageAnalysis!.elements,
							}

							// Return result directly for text-based browsing
							pushToolResult(
								formatResponse.toolResult(
									`The browser action has been executed using text-based browsing. Element was clicked programmatically.\n\nConsole logs:\n${
										browserActionResult?.logs || "(No new logs)"
									}\n\nUpdated page content:\n${pageAnalysis!.content}\n\nAvailable interactive elements:\n${pageAnalysis!.elements
										.map((el) => `- ${el.description}`)
										.join(
											"\n",
										)}\n\n(REMEMBER: For text-based browsing, use CSS selectors like "button.submit", "#login-btn", "a[href='/about']" instead of coordinates.)`,
								),
							)
							return
						} catch (error) {
							cline.consecutiveMistakeCount++
							cline.recordToolError("browser_action")
							pushToolResult(
								formatResponse.toolResult(
									`Failed to click element: ${error.message}. For text-based browsing, provide a CSS selector (e.g., "button.submit", "#login-btn", "a[href='/about']") instead of coordinates.`,
								),
							)
							return
						}
					} else if (action === "type") {
						if (!coordinate || !text) {
							cline.consecutiveMistakeCount++
							cline.recordToolError("browser_action")
							const missingParam = !coordinate ? "coordinate" : "text"
							pushToolResult(await cline.sayAndCreateMissingParamError("browser_action", missingParam))
							return
						}

						try {
							// For text-based browsing, coordinate should be a CSS selector for the input field
							const selector = coordinate

							// Perform the type action and get the result
							const typeResult = await cline.browserSession.doAction(async (page) => {
								await page.type(selector, text)
							})

							browserActionResult = {
								logs: `Typed "${text}" into element with selector "${selector}".`,
								currentUrl: typeResult.currentUrl || url,
							}

							// Return result directly for text-based browsing
							pushToolResult(
								formatResponse.toolResult(
									`The browser action has been executed using text-based browsing. Text was typed programmatically.\n\nConsole logs:\n${
										browserActionResult?.logs || "(No new logs)"
									}\n\n(REMEMBER: For text-based browsing, use CSS selectors like "input[name='username']", "#password", "textarea.comment" for the coordinate parameter.)`,
								),
							)
							return
						} catch (error) {
							cline.consecutiveMistakeCount++
							cline.recordToolError("browser_action")
							pushToolResult(
								formatResponse.toolResult(
									`Failed to type into element: ${error.message}. For text-based browsing, provide a CSS selector for the input field (e.g., "input[name='username']", "#password", "textarea.comment") in the coordinate parameter.`,
								),
							)
							return
						}
					} else {
						// Other actions not supported for text-based browsing
						cline.consecutiveMistakeCount++
						cline.recordToolError("browser_action")
						pushToolResult(
							formatResponse.toolResult(
								`The action "${action}" is not supported for text-based browsing (model does not support images). Supported actions: "launch" (to fetch page content), "click" (using CSS selectors), "type" (using CSS selectors), and "close".`,
							),
						)
						return
					}
				}

				if (action === "click" || action === "hover") {
					if (!coordinate) {
						cline.consecutiveMistakeCount++
						cline.recordToolError("browser_action")
						pushToolResult(await cline.sayAndCreateMissingParamError("browser_action", "coordinate"))
						await cline.browserSession.closeBrowser()
						return // can't be within an inner switch
					}
				}

				if (action === "type") {
					if (!text) {
						cline.consecutiveMistakeCount++
						cline.recordToolError("browser_action")
						pushToolResult(await cline.sayAndCreateMissingParamError("browser_action", "text"))
						await cline.browserSession.closeBrowser()
						return
					}
				}

				if (action === "resize") {
					if (!size) {
						cline.consecutiveMistakeCount++
						cline.recordToolError("browser_action")
						pushToolResult(await cline.sayAndCreateMissingParamError("browser_action", "size"))
						await cline.browserSession.closeBrowser()
						return
					}
				}

				cline.consecutiveMistakeCount = 0

				await cline.say(
					"browser_action",
					JSON.stringify({
						action: action as BrowserAction,
						coordinate,
						text,
					} satisfies ClineSayBrowserAction),
					undefined,
					false,
				)

				switch (action) {
					case "click":
						browserActionResult = await cline.browserSession.click(coordinate!)
						break
					case "hover":
						browserActionResult = await cline.browserSession.hover(coordinate!)
						break
					case "type":
						browserActionResult = await cline.browserSession.type(text!)
						break
					case "scroll_down":
						browserActionResult = await cline.browserSession.scrollDown()
						break
					case "scroll_up":
						browserActionResult = await cline.browserSession.scrollUp()
						break
					case "resize":
						browserActionResult = await cline.browserSession.resize(size!)
						break
					case "close":
						browserActionResult = await cline.browserSession.closeBrowser()
						break
				}
			}

			switch (action) {
				case "launch":
				case "click":
				case "hover":
				case "type":
				case "scroll_down":
				case "scroll_up":
				case "resize": {
					// Check if we have text content (text-based browsing) or screenshot (visual browsing)
					const hasTextContent = (browserActionResult as any)?.textContent
					const hasScreenshot = browserActionResult?.screenshot

					if (hasTextContent) {
						// Text-based browsing result
						const interactiveElements = (browserActionResult as any)?.interactiveElements || []
						const elementsText =
							interactiveElements.length > 0
								? `\n\nAvailable interactive elements:\n${interactiveElements.map((el: any) => `- ${el.description}`).join("\n")}`
								: ""

						pushToolResult(
							formatResponse.toolResult(
								`The browser action has been executed using text-based browsing. The page content has been converted to markdown for your analysis.\n\nConsole logs:\n${
									browserActionResult?.logs || "(No new logs)"
								}\n\nPage content (markdown):\n${(browserActionResult as any).textContent}${elementsText}\n\n(REMEMBER: For text-based browsing, use CSS selectors like "button.submit", "#login-btn", "a[href='/about']" instead of coordinates. If you need to proceed to using non-\`browser_action\` tools, you MUST first close the browser.)`,
							),
						)
					} else {
						// Visual browsing result (original behavior)
						await cline.say("browser_action_result", JSON.stringify(browserActionResult))
						pushToolResult(
							formatResponse.toolResult(
								`The browser action has been executed. The console logs and screenshot have been captured for your analysis.\n\nConsole logs:\n${
									browserActionResult?.logs || "(No new logs)"
								}\n\n(REMEMBER: if you need to proceed to using non-\`browser_action\` tools or launch a new browser, you MUST first close cline browser. For example, if after analyzing the logs and screenshot you need to edit a file, you must first close the browser before you can use the write_to_file tool.)`,
								hasScreenshot && browserActionResult.screenshot ? [browserActionResult.screenshot] : [],
							),
						)
					}

					break
				}
				case "close":
					pushToolResult(
						formatResponse.toolResult(
							`The browser has been closed. You may now proceed to using other tools.`,
						),
					)

					break
			}

			return
		}
	} catch (error) {
		// Clean up browser session if any error occurs
		await cline.browserSession.closeBrowser()
		await handleError("executing browser action", error)
		return
	}
}
