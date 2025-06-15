import { Directive, ParsingState, TextContentParser, ToolUseParser, ParameterParser } from "./parsers"

export class DirectiveStreamingParser {
	static parse(assistantMessage: string): Directive[] {
		const state: ParsingState = {
			contentBlocks: [],
			currentTextContent: undefined,
			currentTextContentStartIndex: 0,
			currentToolUse: undefined,
			currentToolUseStartIndex: 0,
			currentParamName: undefined,
			currentParamValueStartIndex: 0,
			accumulator: "",
		}

		for (let i = 0; i < assistantMessage.length; i++) {
			const char = assistantMessage[i]
			state.accumulator += char

			// There should not be a param without a tool use.
			if (ParameterParser.parse(state)) {
				continue
			}

			// No currentParamName.
			if (ToolUseParser.parse(state)) {
				continue
			}

			// No currentToolUse.
			const didStartToolUse = ToolUseParser.checkForToolStart(state)
			TextContentParser.parse(state, i, didStartToolUse)
		}

		// Handle remaining partial content
		this.handlePartialContent(state)

		return state.contentBlocks
	}

	private static handlePartialContent(state: ParsingState): void {
		if (state.currentToolUse) {
			// Stream did not complete tool call, add it as partial.
			if (state.currentParamName) {
				// Tool call has a parameter that was not completed.
				state.currentToolUse.params[state.currentParamName] = state.accumulator
					.slice(state.currentParamValueStartIndex)
					.trim()
			}

			state.contentBlocks.push(state.currentToolUse)
		}

		// NOTE: It doesn't matter if check for currentToolUse or
		// currentTextContent, only one of them will be defined since only one can
		// be partial at a time.
		if (state.currentTextContent) {
			// Stream did not complete text content, add it as partial.
			state.contentBlocks.push(state.currentTextContent)
		}
	}
}
