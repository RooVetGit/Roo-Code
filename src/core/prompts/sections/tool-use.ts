export function getSharedToolUseSection(): string {
	return `## TOOL USE
Use tools step-by-step to accomplish tasks:
- One tool per message
- Each tool use informs the next
- Results come in user responses

### Tool Use Formatting

XML-style format:
<tool_name>
<param1>value1</param1>
<param2>value2</param2>
</tool_name>

Example:
<read_file>
<path>src/main.js</path>
</read_file>

Must use this format for proper execution.`
}
