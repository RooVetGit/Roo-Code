import * as sax from "sax"
import { BaseDirectiveHandler } from "./BaseDirectiveHandler"
import { ParseContext, CodeBlockState } from "../ParseContext"
import { ToolDirective, ToolParamName } from "../directives"
import { CodeBlockStateMachine } from "../CodeBlockStateMachine"
import { ToolName } from "@roo-code/types"

export class ToolDirectiveHandler extends BaseDirectiveHandler {
	readonly tagName: string
	private currentToolDirective?: ToolDirective
	public currentParamName?: ToolParamName
	private currentParamValue = ""
	public currentContext: "param" | "none" = "none"
	private stateMachine = new CodeBlockStateMachine()
	private paramCodeBlockState: CodeBlockState = CodeBlockState.OUTSIDE

	constructor(toolName: string) {
		super()
		this.tagName = toolName
	}

	override onOpenTag(node: sax.Tag, context: ParseContext): void {
		if (node.name === this.tagName) {
			this.flushCurrentText(context)
			this.currentToolDirective = {
				type: "tool_use",
				name: this.tagName as ToolName,
				params: {},
				partial: true,
			}
			this.currentContext = "none"
		} else if (this.currentToolDirective) {
			this.currentParamName = node.name as ToolParamName
			this.currentParamValue = ""
			this.currentContext = "param"
			// Reset code block state for new parameter
			this.paramCodeBlockState = CodeBlockState.OUTSIDE
		}
	}

	override onCloseTag(tagName: string, context: ParseContext): void {
		if (tagName === this.tagName && this.currentToolDirective) {
			this.currentToolDirective.partial =
				context.hasIncompleteXml || Object.keys(this.currentToolDirective.params).length === 0
			context.contentBlocks.push(this.currentToolDirective)
			this.currentToolDirective = undefined
		} else if (this.currentToolDirective && this.currentParamName && tagName === this.currentParamName) {
			;(this.currentToolDirective.params as Record<string, string>)[this.currentParamName] =
				this.currentParamValue.trim()
			this.currentParamName = undefined
			this.currentParamValue = ""
			this.currentContext = "none"
		}
	}

	override onText(text: string, context: ParseContext): void {
		if (this.currentContext === "param" && this.currentParamName && this.currentToolDirective) {
			// Create a temporary context to track code block state within this parameter
			const tempContext = {
				...context,
				codeBlockState: this.paramCodeBlockState,
			}

			// Process text through the code block state machine
			const result = this.stateMachine.processText(text, tempContext)

			// Update our parameter-specific code block state
			this.paramCodeBlockState = tempContext.codeBlockState

			this.currentParamValue += result.processedText
		}
	}

	override onEnd(context: ParseContext): void {
		if (this.currentToolDirective) {
			if (this.currentParamName && this.currentParamValue) {
				;(this.currentToolDirective.params as Record<string, string>)[this.currentParamName] =
					this.currentParamValue.trim()
			}
			this.currentToolDirective.partial = true
			context.contentBlocks.push(this.currentToolDirective)
		}
	}

	/**
	 * Check if we're currently inside a code block within a tool parameter
	 */
	isInsideParameterCodeBlock(): boolean {
		return this.currentContext === "param" && this.paramCodeBlockState === CodeBlockState.INSIDE
	}
}
