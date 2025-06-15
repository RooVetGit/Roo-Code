import { TextContent, ToolUse, ToolParamName } from "../../../shared/tools"

// Type aliases for directive parsing
export type TextDirective = TextContent
export type ToolDirective = ToolUse
export type Directive = TextDirective | ToolDirective

export interface ParsingState {
	contentBlocks: Directive[]
	currentTextContent?: TextDirective
	currentTextContentStartIndex: number
	currentToolUse?: ToolDirective
	currentToolUseStartIndex: number
	currentParamName?: ToolParamName
	currentParamValueStartIndex: number
	accumulator: string
}
