import * as sax from "sax"
import { Directive } from "./directives"
import { ParseContext, CodeBlockState } from "./ParseContext"
import { DirectiveRegistryFactory } from "./DirectiveRegistryFactory"
import { FallbackParser } from "./FallbackParser"
import { XmlUtils } from "./XmlUtils"
import { DirectiveHandler } from "./DirectiveHandler"
import { ParameterCodeBlockHandler } from "./ParameterCodeBlockHandler"
import { ToolDirectiveHandler } from "./handlers"

export class DirectiveStreamingParser {
	private static registry = DirectiveRegistryFactory.create()

	static parse(assistantMessage: string): Directive[] {
		const context: ParseContext = {
			currentText: "",
			contentBlocks: [],
			hasXmlTags: false,
			hasIncompleteXml: XmlUtils.hasIncompleteXml(assistantMessage),
			codeBlockState: CodeBlockState.OUTSIDE,
			pendingBackticks: "",
			codeBlockContent: "",
			codeBlockStartIndex: -1,
		}

		const parser = sax.parser(false, { lowercase: true })
		let parseError = false
		let tagStack: string[] = []
		let activeHandler: DirectiveHandler | null = null

		parser.onopentag = (node: sax.Tag) => {
			// Check if we're inside a code block (either global or within tool parameters)
			const insideCodeBlock = this.isInsideCodeBlock(context, activeHandler)

			// Check if we're inside a tool parameter (but not at the parameter level itself)
			const insideToolParameter = this.isInsideToolParameter(activeHandler)

			// Only process XML tags if NOT inside code block AND NOT inside tool parameter
			if (!insideCodeBlock && !insideToolParameter) {
				context.hasXmlTags = true
				tagStack.push(node.name)
				const handler = this.registry.getHandler(node.name)

				if (handler) {
					activeHandler = handler
					this.registry.getTextHandler().setState("none")
				}
				if (activeHandler) {
					activeHandler.onOpenTag(node, context)
				}
			} else {
				// Inside code block or tool parameter - treat as plain text
				const tagText = `<${node.name}${this.attributesToString(node.attributes)}>`
				if (activeHandler) {
					activeHandler.onText(tagText, context)
				} else {
					this.registry.getTextHandler().onText(tagText, context)
				}
			}
		}

		parser.onclosetag = (tagName: string) => {
			// Check if we're inside a code block (either global or within tool parameters)
			const insideCodeBlock = this.isInsideCodeBlock(context, activeHandler)

			// Check if we're inside a tool parameter (but not at the parameter level itself)
			const insideToolParameter = this.isInsideToolParameter(activeHandler, tagName)

			if (!insideCodeBlock && !insideToolParameter) {
				// Normal XML processing
				if (activeHandler) {
					activeHandler.onCloseTag(tagName, context)
					if (tagName === activeHandler.tagName) {
						activeHandler = null
						this.registry.getTextHandler().setState("text")
					}
				}
				tagStack.pop()
			} else {
				// Inside code block or tool parameter - treat as plain text
				if (activeHandler) {
					activeHandler.onText(`</${tagName}>`, context)
				} else {
					this.registry.getTextHandler().onText(`</${tagName}>`, context)
				}
			}
		}

		parser.ontext = (text: string) => {
			if (activeHandler) {
				activeHandler.onText(text, context)
			} else {
				this.registry.getTextHandler().onText(text, context)
			}
		}

		parser.onend = () => {
			for (const handler of this.registry.getAllHandlers()) {
				handler.onEnd(context)
			}
		}

		parser.onerror = (error: Error) => {
			parseError = true
		}

		try {
			const wrappedMessage = `<root>${assistantMessage}</root>`
			parser.write(wrappedMessage).close()
		} catch (e) {
			parseError = true
		}

		if (parseError || (!context.hasXmlTags && context.contentBlocks.length === 0 && assistantMessage.trim())) {
			return FallbackParser.parse(assistantMessage)
		}

		return context.contentBlocks
	}

	/**
	 * Check if we're inside a code block (either global or within tool parameters)
	 */
	private static isInsideCodeBlock(context: ParseContext, activeHandler: DirectiveHandler | null): boolean {
		return (
			context.codeBlockState === CodeBlockState.INSIDE ||
			(!!activeHandler &&
				activeHandler instanceof ToolDirectiveHandler &&
				!!(activeHandler as ParameterCodeBlockHandler).isInsideParameterCodeBlock())
		)
	}

	/**
	 * Check if we're inside a tool parameter (but not at the parameter level itself)
	 */
	private static isInsideToolParameter(activeHandler: DirectiveHandler | null, tagName?: string): boolean {
		if (!activeHandler || !(activeHandler instanceof ToolDirectiveHandler)) {
			return false
		}

		const typedHandler = activeHandler as ParameterCodeBlockHandler
		const isInParamContext = typedHandler.currentContext === "param"

		// For close tags, also check if this is not the parameter tag itself
		if (tagName !== undefined) {
			return isInParamContext && tagName !== typedHandler.currentParamName
		}

		// For open tags, just check if we're in param context
		return isInParamContext
	}

	/**
	 * Convert SAX node attributes to string representation
	 */
	private static attributesToString(attributes: { [key: string]: string }): string {
		if (!attributes || Object.keys(attributes).length === 0) {
			return ""
		}
		return Object.entries(attributes)
			.map(([key, value]) => ` ${key}="${value}"`)
			.join("")
	}
}
