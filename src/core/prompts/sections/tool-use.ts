import { TOOL_USE_FORMAT } from "../constants"

export function getSharedToolUseSection(): string {
	return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

# Tool Use Formatting

${TOOL_USE_FORMAT}

For example, to use the read_file tool:

<read_file>
<path>src/main.js</path>
</read_file>

Always use the actual tool name as the XML tag name for proper parsing and execution.`
}
