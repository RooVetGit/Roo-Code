import { ParsingState } from "./types"

export class ParameterParser {
	static parse(state: ParsingState): boolean {
		if (!state.currentToolUse || !state.currentParamName) return false

		const currentParamValue = state.accumulator.slice(state.currentParamValueStartIndex)
		const paramClosingTag = `</${state.currentParamName}>`

		if (currentParamValue.endsWith(paramClosingTag)) {
			// End of param value.
			state.currentToolUse.params[state.currentParamName] = currentParamValue
				.slice(0, -paramClosingTag.length)
				.trim()
			state.currentParamName = undefined
			return true
		} else {
			// Partial param value is accumulating.
			return true
		}
	}
}
