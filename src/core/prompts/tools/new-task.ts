import { ToolArgs } from "./types"

/**
 * Generate description for the new_task tool
 * @param args Tool arguments
 * @returns Tool description
 */
export function getNewTaskDescription(_args: ToolArgs): string {
	return `## new_task
Description: Create a new task instance with specified mode and starting instructions.

Parameters:
- mode: (required) Target mode identifier (e.g., "code", "ask", "architect")
- message: (required) Initial instruction or query for the new task

Usage:
<new_task>
<mode>target_mode</mode>
<message>Task instructions</message>
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Create a React component that displays a paginated table of user data.</message>
</new_task>
`
}
