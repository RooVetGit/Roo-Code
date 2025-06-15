import { ParsingState } from "./types"

export class TextContentParser {
	static parse(state: ParsingState, currentIndex: number, didStartToolUse: boolean): void {
		if (!didStartToolUse) {
			// No tool use, so it must be text either at the beginning or between tools.
			if (state.currentTextContent === undefined) {
				state.currentTextContentStartIndex = currentIndex
			}

			state.currentTextContent = {
				type: "text",
				content: state.accumulator.slice(state.currentTextContentStartIndex).trim(),
				partial: true,
			}
		}
	}

	static finalize(state: ParsingState, toolUseOpeningTag: string): void {
		if (state.currentTextContent) {
			state.currentTextContent.partial = false

			// Remove the partially accumulated tool use tag from the end of text (<tool).
			state.currentTextContent.content = state.currentTextContent.content
				.slice(0, -toolUseOpeningTag.slice(0, -1).length)
				.trim()

			state.contentBlocks.push(state.currentTextContent)
			state.currentTextContent = undefined
		}
	}
}
