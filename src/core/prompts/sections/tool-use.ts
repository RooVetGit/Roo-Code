export function getSharedToolUseSection(modelId?: string): string {
	// Check if this is a GPT-5 model
	const isGpt5Model = modelId?.toLowerCase().includes("gpt-5") || modelId?.toLowerCase().includes("gpt5")

	// Add GPT-5 specific clarification about explanations with tool use
	const toolUseIntro = isGpt5Model
		? `You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. **IMPORTANT for GPT-5**: When using tools to make code changes, you should provide explanations of your changes alongside the tool use in the same message. The "one tool per message" rule means you can only invoke one tool's XML tags per message, but you can and should include explanatory text before or after the tool invocation to describe what you're doing and why. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.`
		: `You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.`

	return `====

TOOL USE

${toolUseIntro}

# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

Always use the actual tool name as the XML tag name for proper parsing and execution.`
}
