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
			await cline.ask("followup", removeClosingTag("question", question), block.partial).catch(() => {})
			return
		} else {
			if (!question) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("ask_followup_question")
				pushToolResult(await cline.sayAndCreateMissingParamError("ask_followup_question", "question"))
				return
			}

			type Suggest = { answer: string; mode?: string }

			let follow_up_json = {
				question,
				suggest: [] as Suggest[],
			}

			if (follow_up) {
				// Define the actual structure returned by the XML parser for both formats
				type ParsedSuggestion =
					| string // For backward compatibility with old format
					| { "#text": string; "@_mode"?: string } // Old attribute format
					| { content: string; mode?: string } // New nested element format
					| { [key: string]: any } // Fallback for unexpected structures

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
					await cline.say("error", `Failed to parse operations: ${error.message}`)
					pushToolResult(formatResponse.toolError("Invalid operations xml format"))
					return
				}

				const rawSuggestions = Array.isArray(parsedSuggest?.suggest)
					? parsedSuggest.suggest
					: [parsedSuggest?.suggest].filter((sug): sug is ParsedSuggestion => sug !== undefined)

				// Helper functions for parsing different formats
				const parseNestedFormat = (sug: any): Suggest | null => {
					// New nested element format
					if (sug.content) {
						return { answer: sug.content, ...(sug.mode && { mode: sug.mode }) }
					}
					return null
				}

				const parseAttributeFormat = (sug: any): Suggest | null => {
					// Old attribute format (backward compatibility)
					if (sug["#text"]) {
						return { answer: sug["#text"], ...(sug["@_mode"] && { mode: sug["@_mode"] }) }
					}
					return null
				}

				const parseStringWithNestedXml = (str: string): Suggest | null => {
					// Check if string contains nested XML (new format with stopNodes)
					if (str.includes("<content>") || str.includes("<mode>")) {
						try {
							const nestedParsed = parseXml(`<suggest>${str}</suggest>`) as any
							if (nestedParsed?.suggest) {
								const nested = nestedParsed.suggest
								return { answer: nested.content || str, ...(nested.mode && { mode: nested.mode }) }
							}
						} catch {
							// If parsing fails, return null to try other formats
						}
					}
					return null
				}

				// Transform parsed XML to our Suggest format
				const normalizedSuggest: Suggest[] = rawSuggestions.map((sug: ParsedSuggestion) => {
					// Handle string suggestions
					if (typeof sug === "string") {
						// Try parsing as nested XML first
						const nestedResult = parseStringWithNestedXml(sug)
						if (nestedResult) return nestedResult

						// Simple string suggestion (backward compatibility)
						return { answer: sug }
					}

					// Handle object suggestions
					if (sug && typeof sug === "object") {
						// Try new nested element format first
						const nestedResult = parseNestedFormat(sug)
						if (nestedResult) return nestedResult

						// Try old attribute format
						const attributeResult = parseAttributeFormat(sug)
						if (attributeResult) return attributeResult

						// Fallback for any other object structure
						return { answer: JSON.stringify(sug) }
					}

					// Fallback for any unexpected type
					return { answer: String(sug) }
				})

				follow_up_json.suggest = normalizedSuggest
			}

			cline.consecutiveMistakeCount = 0
			const { text, images } = await cline.ask("followup", JSON.stringify(follow_up_json), false)
			await cline.say("user_feedback", text ?? "", images)
			pushToolResult(formatResponse.toolResult(`<answer>\n${text}\n</answer>`, images))

			return
		}
	} catch (error) {
		await handleError("asking question", error)
		return
	}
}
