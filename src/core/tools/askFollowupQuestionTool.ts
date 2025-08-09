import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { parseXml } from "../../utils/xml"

export async function askFollowupQuestionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const question: string | undefined = block.params.question
	const follow_up: string | undefined = block.params.follow_up

	try {
		if (block.partial) {
			// Early return if required parameter is not yet available
			if (!question) {
				return
			}

			await cline.ask("followup", removeClosingTag("question", question), block.partial).catch(() => {})
			return
		} else {
			if (!question) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("ask_followup_question")
				pushToolResult(await cline.sayAndCreateMissingParamError("ask_followup_question", "question"))
				return
			}

			if (!follow_up) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("ask_followup_question")
				pushToolResult(await cline.sayAndCreateMissingParamError("ask_followup_question", "follow_up"))
				return
			}

			cline.consecutiveMistakeCount = 0

			type Suggest = { answer: string; mode?: string }

			let follow_up_json = {
				question,
				suggest: [] as Suggest[],
			}

			// Define the actual structure returned by the XML parser
			type ParsedSuggestion = string | { "#text": string; "@_mode"?: string }

			let parsedSuggest: {
				suggest: ParsedSuggestion[] | ParsedSuggestion
			}

			try {
				parsedSuggest = parseXml(follow_up, ["suggest"]) as {
					suggest: ParsedSuggestion[] | ParsedSuggestion
				}
			} catch (error) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("ask_followup_question")
				await cline.say("error", `Failed to parse follow_up suggestions: ${error.message}`)
				pushToolResult(formatResponse.toolError(`Invalid follow_up XML format: ${error.message}`))
				return
			}

			const rawSuggestions = Array.isArray(parsedSuggest?.suggest)
				? parsedSuggest.suggest
				: [parsedSuggest?.suggest].filter((sug): sug is ParsedSuggestion => sug !== undefined)

			// Validate that we have at least one suggestion
			if (rawSuggestions.length === 0) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("ask_followup_question")
				await cline.say("error", "No suggestions found in follow_up parameter")
				pushToolResult(
					formatResponse.toolError("The follow_up parameter must contain at least one <suggest> tag"),
				)
				return
			}

			// Transform parsed XML to our Suggest format
			const normalizedSuggest: Suggest[] = rawSuggestions.map((sug) => {
				if (typeof sug === "string") {
					// Simple string suggestion (no mode attribute)
					return { answer: sug }
				} else {
					// XML object with text content and optional mode attribute
					const result: Suggest = { answer: sug["#text"] }
					if (sug["@_mode"]) {
						result.mode = sug["@_mode"]
					}
					return result
				}
			})

			follow_up_json.suggest = normalizedSuggest

			const { text, images } = await cline.ask("followup", JSON.stringify(follow_up_json), false)
			await cline.say("user_feedback", text ?? "", images)
			pushToolResult(formatResponse.toolResult(`<answer>\n${text}\n</answer>`, images))

			return
		}
	} catch (error) {
		await handleError("asking followup question", error)
		return
	}
}
