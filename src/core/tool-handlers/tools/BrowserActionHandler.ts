import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import {
	BrowserAction,
	BrowserActionResult,
	browserActions,
	ClineSayBrowserAction,
} from "../../../shared/ExtensionMessage"
import { telemetryService } from "../../../services/telemetry/TelemetryService"

export class BrowserActionHandler extends ToolUseHandler {
	// No specific toolUse type override needed

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
	}

	async handle(): Promise<boolean> {
		// Ensure browser is closed if another tool is attempted after this one
		// This logic might be better placed in the main loop or a pre-tool-execution hook
		// if (this.toolUse.name !== "browser_action") {
		//   await this.cline.browserSession.closeBrowser();
		// }

		if (this.toolUse.partial) {
			await this.handlePartial()
			return false // Indicate partial handling
		} else {
			await this.handleComplete()
			return true // Indicate complete handling
		}
	}

	validateParams(): void {
		const action = this.toolUse.params.action as BrowserAction | undefined
		if (!action || !browserActions.includes(action)) {
			throw new Error(
				"Missing or invalid required parameter 'action'. Must be one of: " + browserActions.join(", "),
			)
		}
		if (action === "launch" && !this.toolUse.params.url) {
			throw new Error("Missing required parameter 'url' for 'launch' action.")
		}
		if (action === "click" && !this.toolUse.params.coordinate) {
			throw new Error("Missing required parameter 'coordinate' for 'click' action.")
		}
		if (action === "type" && !this.toolUse.params.text) {
			throw new Error("Missing required parameter 'text' for 'type' action.")
		}
	}

	protected async handlePartial(): Promise<void> {
		const action = this.toolUse.params.action as BrowserAction | undefined
		const url = this.toolUse.params.url
		const coordinate = this.toolUse.params.coordinate
		const text = this.toolUse.params.text

		// Only show UI updates if action is valid so far
		if (action && browserActions.includes(action)) {
			try {
				if (action === "launch") {
					await this.cline.ask(
						"browser_action_launch",
						this.removeClosingTag("url", url),
						true, // partial
					)
				} else {
					await this.cline.say(
						"browser_action",
						JSON.stringify({
							action: action,
							coordinate: this.removeClosingTag("coordinate", coordinate),
							text: this.removeClosingTag("text", text),
						} satisfies ClineSayBrowserAction),
						undefined, // images
						true, // partial
					)
				}
			} catch (error) {
				console.warn("BrowserActionHandler: ask/say for partial update interrupted.", error)
			}
		}
	}

	protected async handleComplete(): Promise<void> {
		const action = this.toolUse.params.action as BrowserAction // Already validated
		const url = this.toolUse.params.url
		const coordinate = this.toolUse.params.coordinate
		const text = this.toolUse.params.text

		try {
			// Re-validate parameters for the complete action
			this.validateParams() // Throws on error

			let browserActionResult: BrowserActionResult

			if (action === "launch") {
				this.cline.consecutiveMistakeCount = 0
				const didApprove = await this.cline.askApprovalHelper(this.toolUse, "browser_action_launch", url)
				if (!didApprove) return

				await this.cline.say("browser_action_result", "") // Show loading spinner
				await this.cline.browserSession.launchBrowser() // Access via cline instance
				browserActionResult = await this.cline.browserSession.navigateToUrl(url!) // url is validated
			} else {
				// Validate params specific to other actions
				if (action === "click" && !coordinate) throw new Error("Missing coordinate for click")
				if (action === "type" && !text) throw new Error("Missing text for type")

				this.cline.consecutiveMistakeCount = 0
				// No explicit approval needed for actions other than launch in original code
				await this.cline.say(
					"browser_action",
					JSON.stringify({ action, coordinate, text } satisfies ClineSayBrowserAction),
					undefined,
					false, // complete
				)

				// Execute action via browserSession on Cline instance
				switch (action) {
					case "click":
						browserActionResult = await this.cline.browserSession.click(coordinate!)
						break
					case "type":
						browserActionResult = await this.cline.browserSession.type(text!)
						break
					case "scroll_down":
						browserActionResult = await this.cline.browserSession.scrollDown()
						break
					case "scroll_up":
						browserActionResult = await this.cline.browserSession.scrollUp()
						break
					case "close":
						browserActionResult = await this.cline.browserSession.closeBrowser()
						break
					default:
						// Should not happen due to initial validation
						throw new Error(`Unhandled browser action: ${action}`)
				}
			}

			// --- Process Result ---
			let resultText: string
			let resultImages: string[] | undefined

			if (action === "close") {
				resultText = `The browser has been closed. You may now proceed to using other tools.`
			} else {
				// For launch, click, type, scroll actions
				await this.cline.say("browser_action_result", JSON.stringify(browserActionResult)) // Show raw result
				resultText = `The browser action '${action}' has been executed. The console logs and screenshot have been captured for your analysis.\n\nConsole logs:\n${browserActionResult.logs || "(No new logs)"}\n\n(REMEMBER: if you need to proceed to using non-\`browser_action\` tools or launch a new browser, you MUST first close this browser.)`
				resultImages = browserActionResult.screenshot ? [browserActionResult.screenshot] : undefined
			}

			await this.cline.pushToolResult(this.toolUse, formatResponse.toolResult(resultText, resultImages))
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			// Ensure browser is closed on any error during execution
			await this.cline.browserSession.closeBrowser()
			await this.cline.handleErrorHelper(this.toolUse, `executing browser action '${action}'`, error)
		}
	}
}
