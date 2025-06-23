import { Directive } from "./directives"

export enum CodeBlockState {
	OUTSIDE = "outside", // Normal parsing mode
	INSIDE = "inside", // Inside code block - suppress XML
	PARTIAL_START = "partial_start", // Detected partial ``` at start
	PARTIAL_END = "partial_end", // Detected partial ``` at end
}

export interface ParseContext {
	currentText: string
	contentBlocks: Directive[]
	hasXmlTags: boolean
	hasIncompleteXml: boolean

	// Code block state tracking
	codeBlockState: CodeBlockState
	pendingBackticks: string // For partial ``` detection
	codeBlockContent: string // Accumulated content inside code blocks
	codeBlockStartIndex: number // Track where code block started
}
