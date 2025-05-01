import { ToolArgs } from "./types"

export function getNewTaskDescription(_args: ToolArgs): string {
	return `## new_task
Description: This will let you create a new task instance in the chosen mode using your provided message and attached files.

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this new task.
- files: (optional) A list of files to include in the new task. Use a parent <files> tag containing one or more <file> tags, each with a relative workspace path.
	
Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
<files>
<file>path1</file>
<file>path2</file>
</files>
</new_task>
	
Example:
<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
<files>
<file>src/somefile.ts</file>
<file>src/anotherfile.ts</file>
</files>
</new_task>
`
}
