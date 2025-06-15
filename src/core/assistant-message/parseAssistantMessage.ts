import { DirectiveStreamingParser } from "./DirectiveStreamingParser"
import type { Directive } from "./parsers/types"

// Re-export types for backward compatibility
export type { TextDirective, ToolDirective, Directive } from "./parsers/types"

// Backward compatibility alias
export type AssistantMessageContent = Directive

export function parseAssistantMessage(assistantMessage: string): Directive[] {
	return DirectiveStreamingParser.parse(assistantMessage)
}
