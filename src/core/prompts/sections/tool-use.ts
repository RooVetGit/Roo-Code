export function getSharedToolUseSection(): string {
	return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. You can use up to five tools in a single message to reduce the number of interaction rounds, and will receive the results of those tool use in the user's response. Read and write tools should not be used simultaneously in one request. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

<actual_tool_name2>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name2>

For example, to use two read_file tools:

<read_file>
<path>src/main.js</path>
</read_file>

<read_file>
<path>src/index.js</path>
</read_file>

Always use the actual tool name as the XML tag name for proper parsing and execution.`
}
