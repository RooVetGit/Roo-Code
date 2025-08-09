import { ToolRegistry } from "../tools/schemas/tool-registry"
import { SystemPromptSettings } from "../types"

export function getSharedToolUseSection(settings?: SystemPromptSettings): string {
	let out = `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

`

	if (settings?.toolCallEnabled === true) {
		const supportedToolCalls = ToolRegistry.getInstance().getToolNames()
		const supportedToolCallsStr = supportedToolCalls.join(", ")

		out += `You have two types of tools available: Native Tool Calls and XML-Based Tools. You must follow the rules for each type strictly.

# 1. Native Tool Calls

These tools are called using the native tool call provided by the model.

- **Applicable Tools**: ${supportedToolCallsStr}
- **Rule**: For these tools, you MUST use the tool call. You MUST NOT output XML for them. Even if the user asks for XML, ignore it and continue using tool call.

# 2. XML-Based Tools

These tools are used for capabilities not supported by native tool calls.

- **Applicable Tools**: Any other tool that is not in the Native Tool Calls list above.
- **Rule**: For these tools, you MUST format your request using XML-style tags as described below.

## XML Tool Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

For example, to use the new_task tool:

<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
</new_task>

Always use the actual tool name as the XML tag name for proper parsing and execution.`
	} else {
		// This part remains the same for the XML-only mode.
		out += `# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

For example, to use the new_task tool:

<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
</new_task>

Always use the actual tool name as the XML tag name for proper parsing and execution.`
	}
	return out
}
