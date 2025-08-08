import { ToolArgs } from "./types"

export function getNewTaskDescription(_args: ToolArgs): string {
	return `## new_task
Description: This will let you create a new task instance in the chosen mode using your provided message and optionally specify an API configuration profile to use.

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this new task.
- config: (optional) The slug/name of the API configuration profile to use for this task (e.g., "claude-3-5-sonnet", "gpt-4-debug", "fast-model"). If not specified, uses the default configuration for the mode.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
<config>optional-config-slug-here</config>
</new_task>

Examples:

1. Basic usage (without config):
<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
</new_task>

2. With specific configuration:
<new_task>
<mode>architect</mode>
<message>Design the database schema for the new feature</message>
<config>accurate-model</config>
</new_task>
`
}
