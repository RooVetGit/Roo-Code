import { type ToolName, toolNames } from "@roo-code/types"
import { ToolParamName, toolParamNames } from "../../../shared/tools"
import { ParsingState } from "./types"
import { TextContentParser } from "./TextContentParser"

export class ToolUseParser {
	static checkForToolStart(state: ParsingState): boolean {
		let didStartToolUse = false
		const possibleToolUseOpeningTags = toolNames.map((name) => `<${name}>`)

		for (const toolUseOpeningTag of possibleToolUseOpeningTags) {
			if (state.accumulator.endsWith(toolUseOpeningTag)) {
				// Start of a new tool use.
				state.currentToolUse = {
					type: "tool_use",
					name: toolUseOpeningTag.slice(1, -1) as ToolName,
					params: {},
					partial: true,
				}

				state.currentToolUseStartIndex = state.accumulator.length

				// This also indicates the end of the current text content.
				TextContentParser.finalize(state, toolUseOpeningTag)

				didStartToolUse = true
				break
			}
		}

		return didStartToolUse
	}

	static parse(state: ParsingState): boolean {
		if (!state.currentToolUse) return false

		const currentToolValue = state.accumulator.slice(state.currentToolUseStartIndex)
		const toolUseClosingTag = `</${state.currentToolUse.name}>`

		if (currentToolValue.endsWith(toolUseClosingTag)) {
			// End of a tool use.
			state.currentToolUse.partial = false
			state.contentBlocks.push(state.currentToolUse)
			state.currentToolUse = undefined
			return true
		} else {
			this.parseParameter(state)
			this.parseSpecialCases(state)
			return true // Continue processing
		}
	}

	private static parseParameter(state: ParsingState): void {
		const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
		for (const paramOpeningTag of possibleParamOpeningTags) {
			if (state.accumulator.endsWith(paramOpeningTag)) {
				// Start of a new parameter.
				state.currentParamName = paramOpeningTag.slice(1, -1) as ToolParamName
				state.currentParamValueStartIndex = state.accumulator.length
				break
			}
		}
	}

	private static parseSpecialCases(state: ParsingState): void {
		if (!state.currentToolUse) return

		// Special case for write_to_file where file contents could
		// contain the closing tag, in which case the param would have
		// closed and we end up with the rest of the file contents here.
		// To work around this, we get the string between the starting
		// content tag and the LAST content tag.
		const contentParamName: ToolParamName = "content"

		if (state.currentToolUse.name === "write_to_file" && state.accumulator.endsWith(`</${contentParamName}>`)) {
			const toolContent = state.accumulator.slice(state.currentToolUseStartIndex)
			const contentStartTag = `<${contentParamName}>`
			const contentEndTag = `</${contentParamName}>`
			const contentStartIndex = toolContent.indexOf(contentStartTag) + contentStartTag.length
			const contentEndIndex = toolContent.lastIndexOf(contentEndTag)

			if (contentStartIndex !== -1 && contentEndIndex !== -1 && contentEndIndex > contentStartIndex) {
				state.currentToolUse.params[contentParamName] = toolContent
					.slice(contentStartIndex, contentEndIndex)
					.trim()
			}
		}
	}
}
