import { ParseContext, CodeBlockState } from "./ParseContext"

export interface ProcessedTextResult {
	processedText: string
	suppressXmlParsing: boolean
	stateChanged: boolean
	nextIndex: number
}

export interface CodeBlockBoundary {
	found: boolean
	endIndex: number
	isComplete: boolean
}

export class CodeBlockStateMachine {
	/**
	 * Process incoming text and manage code block state transitions
	 */
	processText(text: string, context: ParseContext): ProcessedTextResult {
		// Simple approach: scan for ``` patterns and track state
		let result = ""
		let i = 0
		let stateChanged = false

		while (i < text.length) {
			// Check for ``` pattern at current position
			if (this.isCodeBlockBoundary(text, i)) {
				// Found ``` - toggle state
				if (context.codeBlockState === CodeBlockState.OUTSIDE) {
					context.codeBlockState = CodeBlockState.INSIDE
					stateChanged = true
				} else if (context.codeBlockState === CodeBlockState.INSIDE) {
					context.codeBlockState = CodeBlockState.OUTSIDE
					stateChanged = true
				}
				// Include the ``` in the result
				result += "```"
				i += 3
			} else {
				// Regular character
				result += text[i]
				i++
			}
		}

		return {
			processedText: result,
			suppressXmlParsing: context.codeBlockState === CodeBlockState.INSIDE,
			stateChanged,
			nextIndex: i,
		}
	}

	/**
	 * Check if there's a ``` pattern at the given position
	 */
	private isCodeBlockBoundary(text: string, pos: number): boolean {
		return pos <= text.length - 3 && text[pos] === "`" && text[pos + 1] === "`" && text[pos + 2] === "`"
	}
}
