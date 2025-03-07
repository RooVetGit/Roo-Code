import { ToolArgs } from "./types"

export function getAttemptCompletionDescription(_: ToolArgs): string {
	return `## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. Optionally you may provide a CLI command to showcase the result of your work. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must ask yourself in <thinking></thinking> tags if you've confirmed from the user that any previous tool uses were successful. If not, then DO NOT use this tool.
Parameters:
- result: (required) The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.
- command: (optional) A CLI command to execute to show a live demo of the result to the user. For example, use \`open index.html\` to display a created html website, or \`open localhost:3000\` to display a locally running development server. But DO NOT use commands like \`echo\` or \`cat\` that merely print text. This command should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
- next_step: (required) A list of suggested next tasks that logically follow from the completed work. Each suggestion must:
  1. Be provided in its own <suggest> tag with two fields:
     - task: The description of the suggested task
     - mode: The available mode slug to execute the task in (e.g., "code", "architect", "ask")
  2. Be specific, actionable, and directly related to the completed task
  3. Be ordered by priority or logical sequence
  4. Provide minimum 2-4 suggestions and maximum 12 suggestions

Usage:
<attempt_completion>
<result>
Your final result description here
</result>
<next_step>
<suggest>
<task>Implement authentication service tests</task>
<mode>code</mode>
</suggest>
</next_step>
<command>Command to demonstrate result (optional)</command>
</attempt_completion>

Example: Basic completion with result and command
<attempt_completion>
<result>
I've updated the CSS styling for the navigation menu
</result>
<next_step>
<suggest>
<task>Add responsive design breakpoints for mobile devices</task>
<mode>code</mode>
</suggest>
<suggest>
<task>Implement dark mode theme variations</task>
<mode>code</mode>
</suggest>
<suggest>
<task>Create documentation for styling guidelines</task>
<mode>architect</mode>
</suggest>
</next_step>
<command>open index.html</command>
</attempt_completion>

Example: Completion with next step suggestions
<attempt_completion>
<result>
I've implemented the user authentication feature
</result>
<next_step>
<suggest>
<task>Implement authentication service tests</task>
<mode>code</mode>
</suggest>
<suggest>
<task>Add password reset functionality</task>
<mode>code</mode>
</suggest>
<suggest>
<task>Design social login integration architecture</task>
<mode>architect</mode>
</suggest>
<suggest>
<task>Create user authentication documentation</task>
<mode>architect</mode>
</suggest>
<suggest>
<task>Implement session management</task>
<mode>code</mode>
</suggest>
</next_step>
<command>npm run dev</command>
</attempt_completion>

Note: When providing next step suggestions:
1. Keep suggestions focused and directly related to the completed task
2. Order suggestions by priority or logical sequence
3. Provide minimum 2-4 suggestions and maximum 12 suggestions
4. Make each suggestion specific and actionable
5. Include appropriate mode for each suggestion based on the task type`
}
