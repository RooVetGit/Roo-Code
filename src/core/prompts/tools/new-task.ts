import { ToolArgs } from "./types"

export function getNewTaskDescription(args: ToolArgs): string {
	const todosRequired = args.settings?.newTaskRequireTodos === true

	// Always show the todos parameter, but mark it as optional or required based on setting
	return `## new_task
Description: This will let you create a new task instance in the chosen mode using your provided message${todosRequired ? " and initial todo list" : ""}.

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this new task.
- todos: (${todosRequired ? "required" : "optional"}) The initial todo list in markdown checklist format for the new task.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>${
		todosRequired
			? `
<todos>
[ ] First task to complete
[ ] Second task to complete
[ ] Third task to complete
</todos>`
			: ""
	}
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>${todosRequired ? "Implement user authentication" : "Implement a new feature for the application"}</message>${
		todosRequired
			? `
<todos>
[ ] Set up auth middleware
[ ] Create login endpoint
[ ] Add session management
[ ] Write tests
</todos>`
			: ""
	}
</new_task>

${
	!todosRequired
		? `Example with optional todos:
<new_task>
<mode>code</mode>
<message>Implement user authentication</message>
<todos>
[ ] Set up auth middleware
[ ] Create login endpoint
[ ] Add session management
[ ] Write tests
</todos>
</new_task>
`
		: ""
}`
}
