import * as sax from "sax"
import { DirectiveHandler } from "../DirectiveHandler"
import { ParseContext } from "../ParseContext"
import { TextDirective } from "../directives"

export abstract class BaseDirectiveHandler implements DirectiveHandler {
	abstract readonly tagName: string

	canHandle(tagName: string): boolean {
		return tagName === this.tagName
	}

	onOpenTag(node: sax.Tag, context: ParseContext): void {}
	onCloseTag(tagName: string, context: ParseContext): void {}
	onText(text: string, context: ParseContext): void {}
	onEnd(context: ParseContext): void {}

	protected flushCurrentText(context: ParseContext): void {
		if (context.currentText.trim()) {
			context.contentBlocks.push({
				type: "text",
				content: context.currentText.trim(),
				partial: false,
			} as TextDirective)
			context.currentText = ""
		}
	}
}
