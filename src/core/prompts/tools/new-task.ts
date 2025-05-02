import { ToolArgs } from "./types"

export function getNewTaskDescription(_args: ToolArgs): string {
	return `## new_task
Description: This will let you create a new task instance in the chosen mode using your provided message and attached files.

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this new task.
- files: (optional) A list of relevant files to include in the new task. Use a parent <files> tag containing one or more <file> tags, each with a relative workspace path, optionally followed by \`:startLine:endLine\` to specify a range (e.g., \`<file>path/to/file.ts:10:50</file>\`) if needed).

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
<files>
<file>path/without/range.js</file>
<file>path/with/range.py:25:100</file>
</files>
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
<files>
<file>src/somefile.ts</file>
<file>src/anotherfile.ts:10:50</file>
</files>
</new_task>
`
}
