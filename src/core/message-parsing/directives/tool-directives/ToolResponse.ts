import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Type representing the response from a tool execution.
 */
export type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>
