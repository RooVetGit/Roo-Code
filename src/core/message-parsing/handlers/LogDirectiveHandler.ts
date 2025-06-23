import * as sax from "sax"
import { BaseDirectiveHandler } from "./BaseDirectiveHandler"
import { ParseContext } from "../ParseContext"
import { LogDirective } from "../directives"

export class LogDirectiveHandler extends BaseDirectiveHandler {
	readonly tagName = "log_message"
	private currentLogMessage?: LogDirective
	private currentContext: "message" | "level" | "none" = "none"

	override onOpenTag(node: sax.Tag, context: ParseContext): void {
		if (node.name === this.tagName) {
			this.flushCurrentText(context)
			this.currentLogMessage = {
				type: "log_message",
				message: "",
				level: "info",
				partial: true,
			}
			this.currentContext = "none"
		} else if (node.name === "message" && this.currentLogMessage) {
			this.currentContext = "message"
		} else if (node.name === "level" && this.currentLogMessage) {
			this.currentContext = "level"
		}
	}

	override onCloseTag(tagName: string, context: ParseContext): void {
		if (tagName === this.tagName && this.currentLogMessage) {
			this.currentLogMessage.partial = context.hasIncompleteXml
			context.contentBlocks.push(this.currentLogMessage)
			this.currentLogMessage = undefined
		} else if (tagName === "message" || tagName === "level") {
			this.currentContext = "none"
		}
	}

	override onText(text: string, context: ParseContext): void {
		if (!this.currentLogMessage) return

		if (this.currentContext === "message") {
			this.currentLogMessage.message += text
		} else if (this.currentContext === "level") {
			const levelText = text.trim()
			if (["debug", "info", "warn", "error"].includes(levelText)) {
				this.currentLogMessage.level = levelText as "debug" | "info" | "warn" | "error"
			}
		}
	}

	override onEnd(context: ParseContext): void {
		if (this.currentLogMessage) {
			this.currentLogMessage.partial = true
			context.contentBlocks.push(this.currentLogMessage)
		}
	}
}
