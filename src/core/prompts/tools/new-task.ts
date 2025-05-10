import { ToolArgs } from "./types"

export function getNewTaskDescription(_args: ToolArgs): string {
	return `## new_task
Description: Create a new task with a specified starting mode and initial message. This tool instructs the system to create a new Cline instance in the given mode with the provided message.

Parameters:
- mode_slug: (required) The slug of the mode to start the new task in (e.g., "code", "ask", "architect").
- message: (required) The initial user message or instructions for this new task.

Usage:
<new_task>
<mode_slug>your-mode-slug-here</mode_slug>
<message>Your initial instructions here</message>
</new_task>

Example:
<new_task>
<mode_slug>code</mode_slug>
<message>Implement a new feature for the application.</message>
</new_task>
`
}
