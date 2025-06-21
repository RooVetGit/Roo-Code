import * as sax from "sax"
import { ParseContext } from "./ParseContext"

export interface DirectiveHandler {
	readonly tagName: string
	canHandle(tagName: string): boolean
	onOpenTag(node: sax.Tag, context: ParseContext): void
	onCloseTag(tagName: string, context: ParseContext): void
	onText(text: string, context: ParseContext): void
	onEnd(context: ParseContext): void
}
