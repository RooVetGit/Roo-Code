import { ToolArgs } from "./types"

export function getAttemptCompletionDescription({ experiments }: ToolArgs): string {
	return `## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. Optionally you may provide a CLI command to showcase the result of your work. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must ask yourself in <thinking></thinking> tags if you've confirmed from the user that any previous tool uses were successful. If not, then DO NOT use this tool.
Parameters:
- result: (required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.
- command: (optional) A CLI command to execute to show a live demo of the result to the user. For example, use \`open index.html\` to display a created html website, or \`open localhost:3000\` to display a locally running development server. But DO NOT use commands like \`echo\` or \`cat\` that merely print text. This command should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.${
		experiments?.["prompt_suggest"]
			? `
- values: (optional) A list of suggested tasks in the format "create new task for [task description] by using new_task tool". Each suggestion must be provided in its own <suggest> tag. The order of suggestions is important as they will be shown to the user in the same order.`
			: ``
	}
Usage:
<attempt_completion>
<result>
Your final result description here
</result>${
		experiments?.["prompt_suggest"]
			? `
<values>
<suggest>
- Suggested new task 1
</suggest>
<suggest>
- Suggested new task 2
</suggest>
</values>`
			: ``
	}
<command>Command to demonstrate result (optional)</command>
</attempt_completion>

Example: Requesting to attempt completion with a result and command
<attempt_completion>
<result>
I've updated the CSS
</result>
<command>open index.html</command>
</attempt_completion>${
		experiments?.["prompt_suggest"]
			? `

Example: Completion with new task suggestions
<attempt_completion>
<result>
I've implemented the user authentication feature
</result>
<values>
<suggest>
- create new task for authentication service tests by using new_task tool
</suggest>
<suggest>
- create new task for password reset functionality by using new_task tool
</suggest>
<suggest>
- create new task for social login integration by using new_task tool
</suggest>
</values>
<command>npm run dev</command>
</attempt_completion>

Example: Completion with new task suggestions
<attempt_completion>
<result>
I've fixed the memory leak
</result>
<values>
<suggest>
- create new task for performance monitoring system by using new_task tool
</suggest>
<suggest>
- create new task for regression test suite by using new_task tool
</suggest>
<suggest>
- create new task for error tracking by using new_task tool
</suggest>
</values>
</attempt_completion>

Example: Completion with new task suggestions
<attempt_completion>
<result>
I've completed the initial database schema design
</result>
<values>
<suggest>
- Split into new task using new_task: Implement database migration system
</suggest>
<suggest>
- Split into new task using new_task: Create data access layer
</suggest>
<suggest>
- Document schema design decisions and constraints
</suggest>
<suggest>
- Review schema for optimization opportunities
</suggest>
</values>
</attempt_completion>

Example: Completion with new task suggestions
<attempt_completion>
<result>
I've created the API endpoints
</result>
<values>
<suggest>
- create new task for API documentation by using new_task tool
</suggest>
<suggest>
- create new task for integration test suite by using new_task tool
</suggest>
<suggest>
- create new task for security features by using new_task tool
</suggest>
</values>
<command>npm run dev</command>
</attempt_completion>`
			: ``
	}`
}
