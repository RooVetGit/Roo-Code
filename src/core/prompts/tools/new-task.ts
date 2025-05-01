import { ToolArgs } from "./types"

export function getNewTaskDescription(_args: ToolArgs): string {
	return `## new_task
Description: Create a new task with a specified starting mode and initial message. This tool instructs the system to create a new Cline instance in the given mode with the provided message.
	
Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "ask", "architect").
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
