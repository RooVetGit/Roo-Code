import { TextContent, ToolParamName, ToolUse, toolParamNames } from "../../shared/tools"
import { toolNames, ToolName } from "../../schemas"

// We keep parsing state between chunks so we don't repeatedly
// re-scan the entire assistant message each time a new token arrives.
export interface ParserState {
	currentToolUse?: ToolUse
	currentParamName?: ToolParamName
	currentTextContent?: TextContent
}

const toolOpeningTags = toolNames.map((name) => `<${name}>`)
const paramOpeningTags = toolParamNames.map((name) => `<${name}>`)

/**
 * Parses a chunk of streaming assistant text, mutating `state` and
 * returning *completed* content blocks in the order they were closed.
 */
export function parseAssistantMessageChunk(
	state: ParserState,
	chunk: string,
): (ToolUse | TextContent)[] {
	let accumulator = ""
	const completedBlocks: (ToolUse | TextContent)[] = []

	// Helper – finalise and push current text block.
	const flushText = () => {
		if (state.currentTextContent) {
			state.currentTextContent.content = state.currentTextContent.content + accumulator.trimEnd()
			accumulator = ""
			// Only push when a tool starts or chunk ends (done below)
		}
	}

	for (let i = 0; i < chunk.length; i++) {
		const char = chunk[i]
		accumulator += char

		if (state.currentToolUse && state.currentParamName) {
			// Inside a param – look for param closing tag.
			const paramClosing = `</${state.currentParamName}>`
			if (accumulator.endsWith(paramClosing)) {
				// Strip closing tag from param value.
				const value = accumulator.slice(0, -paramClosing.length)
				state.currentToolUse.params[state.currentParamName] =
					(state.currentToolUse.params[state.currentParamName] ?? "") + value

				state.currentParamName = undefined
				accumulator = "" // reset accumulator for next parsing portion
			}
			continue // Still inside param; don't treat anything else.
		}

		// Inside a tool but not inside param.
		if (state.currentToolUse) {
			const toolClosing = `</${state.currentToolUse.name}>`
			if (accumulator.endsWith(toolClosing)) {
				// Tool block complete
				state.currentToolUse.partial = false
				state.currentToolUse = undefined
				accumulator = ""
				continue
			}

			// Look for param opening tags
			for (const open of paramOpeningTags) {
				if (accumulator.endsWith(open)) {
					state.currentParamName = open.slice(1, -1) as ToolParamName
					accumulator = "" // reset; param value starts next char
					// Initialize empty param value
					state.currentToolUse.params[state.currentParamName] = ""
					break
				}
			}
			continue
		}

		// Not in a tool – look for opening of a tool.
		for (const open of toolOpeningTags) {
			if (accumulator.endsWith(open)) {
				// Flush any text accumulated *before* the tool tag.
				if (state.currentTextContent) {
					state.currentTextContent.partial = false
					completedBlocks.push(state.currentTextContent)
					state.currentTextContent = undefined
				}

				state.currentToolUse = {
					type: "tool_use",
					name: open.slice(1, -1) as ToolName,
					params: {},
					partial: true,
				}
				// Expose the new (partial) tool block immediately so the UI can
				// respond (e.g. opening diff view for write_to_file).
				completedBlocks.push(state.currentToolUse)
				accumulator = "" // reset; tool content begins next char
				break
			}
		}

		// If we just started a tool, skip further text processing.
		if (state.currentToolUse) {
			continue
		}

		// Regular text content.
		if (!state.currentTextContent) {
			state.currentTextContent = {
				type: "text",
				content: "",
				partial: true,
			}
			// Immediately push the partial text block so downstream consumers
			// can stream it progressively.
			completedBlocks.push(state.currentTextContent)
		}
		// Text will be flushed at the end or before next block.
	}

	// End of chunk – append remaining accumulator to current context.
	if (state.currentParamName && state.currentToolUse) {
		// Still inside param value.
		state.currentToolUse.params[state.currentParamName] =
			(state.currentToolUse.params[state.currentParamName] ?? "") + accumulator
		accumulator = ""
	} else if (state.currentToolUse) {
		// Inside tool but outside param – append to a special placeholder param? (ignored)
		// Nothing to do.
	} else {
		// Plain text
		if (!state.currentTextContent) {
			state.currentTextContent = {
				type: "text",
				content: "",
				partial: true,
			}
		}
		state.currentTextContent.content += accumulator
		accumulator = ""
	}

	// If end of chunk finalises a text block fully (no open tool starting later)
	flushText()

	return completedBlocks
}

export function createInitialParserState(): ParserState {
	return {
		currentToolUse: undefined,
		currentParamName: undefined,
		currentTextContent: undefined,
	}
} 