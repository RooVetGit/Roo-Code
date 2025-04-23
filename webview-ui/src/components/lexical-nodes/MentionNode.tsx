import React from "react"
import { DecoratorNode, EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from "lexical"

export type SerializedMentionNode = Spread<
	{
		mentionName: string // The full mention text, e.g., "@file:path/to/file.txt"
		type: "mention"
		version: 1
	},
	SerializedLexicalNode
>

export class MentionNode extends DecoratorNode<React.ReactNode> {
	__mentionName: string

	static getType(): string {
		return "mention"
	}

	static clone(node: MentionNode): MentionNode {
		return new MentionNode(node.__mentionName, node.__key)
	}

	constructor(mentionName: string, key?: NodeKey) {
		super(key)
		this.__mentionName = mentionName
	}

	createDOM(config: EditorConfig): HTMLElement {
		const dom = document.createElement("span")
		const theme = config.theme
		const className = theme.mention // Use theme class for styling
		if (className !== undefined) {
			dom.className = className
		}
		// Add data attribute for easier selection or debugging if needed
		dom.setAttribute("data-lexical-mention", "true")
		dom.setAttribute("data-mention-name", this.__mentionName)
		// Make it non-editable directly, but allow deletion
		dom.style.userSelect = "none"
		// dom.contentEditable = 'false'; // DecoratorNode handles this implicitly? Check Lexical docs.
		return dom
	}

	updateDOM(): boolean {
		// Returning false tells Lexical that this node does not need its
		// DOM element replacing with a new copy from createDOM.
		return false
	}

	decorate(): React.ReactNode {
		// Render the mention text directly within the decorator
		return this.__mentionName
	}

	exportJSON(): SerializedMentionNode {
		return {
			...super.exportJSON(), // Export properties from DecoratorNode
			mentionName: this.__mentionName,
			type: "mention",
			version: 1,
		}
	}

	static importJSON(serializedNode: SerializedMentionNode): MentionNode {
		const node = $createMentionNode(serializedNode.mentionName)
		// DecoratorNode properties like format, indent, direction might need to be handled
		// node.setFormat(serializedNode.format);
		// node.setIndent(serializedNode.indent);
		// node.setDirection(serializedNode.direction);
		return node
	}

	getTextContent(): string {
		// Important for plain text serialization and copy/paste
		return this.__mentionName
	}

	isInline(): boolean {
		// Mentions behave like inline elements
		return true
	}

	isKeyboardSelectable(): boolean {
		// Allow selection for deletion etc.
		return true
	}
}

export function $createMentionNode(mentionName: string): MentionNode {
	return new MentionNode(mentionName)
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
	return node instanceof MentionNode
}
