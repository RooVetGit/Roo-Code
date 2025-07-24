import { BaseDirectiveHandler } from "./BaseDirectiveHandler"
import { ParseContext, CodeBlockState } from "../ParseContext"
import { TextDirective } from "../directives"
import { CodeBlockStateMachine } from "../CodeBlockStateMachine"

export class TextDirectiveHandler extends BaseDirectiveHandler {
	readonly tagName = "text"
	private currentState: "text" | "none" = "text"
	private stateMachine = new CodeBlockStateMachine()

	override canHandle(tagName: string): boolean {
		return false // Text handler is fallback
	}

	override onText(text: string, context: ParseContext): void {
		if (this.currentState === "text") {
			// Process text through the code block state machine
			const result = this.stateMachine.processText(text, context)

			// Always add processed text to current text
			// The suppressXmlParsing flag is used by the parser to decide whether to process XML tags
			context.currentText += result.processedText
		}
	}

	setState(state: "text" | "none"): void {
		this.currentState = state
	}

	override onEnd(context: ParseContext): void {
		// Handle any remaining code block content
		if (context.codeBlockContent) {
			context.currentText += context.codeBlockContent
			context.codeBlockContent = ""
		}

		// Handle any pending backticks that weren't completed
		if (context.pendingBackticks) {
			context.currentText += context.pendingBackticks
			context.pendingBackticks = ""
		}

		// Create text directive if we have content
		if (context.currentText.trim()) {
			context.contentBlocks.push({
				type: "text",
				content: context.currentText.trim(),
				partial: true,
			} as TextDirective)
		}
	}

	/**
	 * Check if we're currently inside a code block
	 */
	isInsideCodeBlock(context: ParseContext): boolean {
		return context.codeBlockState === CodeBlockState.INSIDE
	}
}
