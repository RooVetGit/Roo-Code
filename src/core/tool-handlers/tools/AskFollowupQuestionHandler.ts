import { ToolUse } from "../../assistant-message" // Using generic ToolUse
import { Cline } from "../../Cline"
import { ToolUseHandler } from "../ToolUseHandler"
import { formatResponse } from "../../prompts/responses"
import { parseXml } from "../../../utils/xml" // Assuming this path is correct
import { telemetryService } from "../../../services/telemetry/TelemetryService"

// Define structure for suggestions parsed from XML
// No interface needed if parseXml returns string[] directly for <suggest> - Removed line with '+' artifact

export class AskFollowupQuestionHandler extends ToolUseHandler {
	// No specific toolUse type override needed

	constructor(cline: Cline, toolUse: ToolUse) {
		super(cline, toolUse)
	}

	async handle(): Promise<boolean> {
		if (this.toolUse.partial) {
			await this.handlePartial()
			return false // Indicate partial handling
		} else {
			await this.handleComplete()
			return true // Indicate complete handling
		}
	}

	validateParams(): void {
		if (!this.toolUse.params.question) {
			throw new Error("Missing required parameter 'question'")
		}
		// follow_up is optional, XML format validated in handleComplete
	}

	protected async handlePartial(): Promise<void> {
		const question = this.toolUse.params.question
		if (!question) return // Need question for message

		try {
			// Show question being asked in UI
			await this.cline.ask("followup", this.removeClosingTag("question", question), true)
		} catch (error) {
			console.warn("AskFollowupQuestionHandler: ask for partial update interrupted.", error)
		}
	}

	protected async handleComplete(): Promise<void> {
		const question = this.toolUse.params.question
		const followUpXml = this.toolUse.params.follow_up

		// --- Parameter Validation ---
		if (!question) {
			this.cline.consecutiveMistakeCount++
			await this.cline.pushToolResult(
				this.toolUse,
				await this.cline.sayAndCreateMissingParamError("ask_followup_question", "question"),
			)
			return
		}

		// --- Parse Follow-up Suggestions ---
		let followUpJson = {
			question,
			suggest: [] as string[], // Expect array of strings
		}

		if (followUpXml) {
			try {
				// Explicitly type the expected structure from parseXml
				// parseXml with ["suggest"] should return { suggest: string | string[] } or similar
				const parsedResult = parseXml(followUpXml, ["suggest"]) as { suggest?: string | string[] }

				// Normalize suggestions into an array
				const normalizedSuggest = Array.isArray(parsedResult?.suggest)
					? parsedResult.suggest
					: parsedResult?.suggest
						? [parsedResult.suggest]
						: [] // Handle single string or undefined

				// Basic validation of suggestion structure
				// Now validate that each item in the array is a string
				if (!normalizedSuggest.every((sug) => typeof sug === "string")) {
					throw new Error("Content within each <suggest> tag must be a string.")
				}

				followUpJson.suggest = normalizedSuggest
			} catch (error: any) {
				this.cline.consecutiveMistakeCount++
				await this.cline.say("error", `Failed to parse follow_up XML: ${error.message}`)
				await this.cline.pushToolResult(
					this.toolUse,
					formatResponse.toolError(`Invalid follow_up XML format: ${error.message}`),
				)
				return
			}
		}

		// --- Ask User ---
		try {
			this.cline.consecutiveMistakeCount = 0 // Reset on successful validation/parse

			const { text, images } = await this.cline.ask(
				"followup",
				JSON.stringify(followUpJson), // Send structured JSON to UI
				false, // Complete message
			)

			// --- Process Response ---
			await this.cline.say("user_feedback", text ?? "", images) // Show user's answer
			// Format the result for the API
			await this.cline.pushToolResult(
				this.toolUse,
				formatResponse.toolResult(`<answer>\n${text}\n</answer>`, images),
			)
			telemetryService.captureToolUsage(this.cline.taskId, this.toolUse.name)
		} catch (error: any) {
			// Handle errors during ask or response processing
			await this.cline.handleErrorHelper(this.toolUse, "asking question", error)
		}
	}
}
