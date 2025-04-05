import { ToolArgs } from "./types"

export function getNewTaskDescription(args: ToolArgs): string {
	return `## new_task
Create new task instance in specified mode.

Parameters:
- mode: Starting mode (required, e.g. "code")
- message: Initial instructions (required)

Usage:
<new_task>
<mode>target_mode</mode>
<message>task_instructions</message>
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Implement new feature</message>
</new_task>
`
}
