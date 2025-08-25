import { ToolArgs } from "../types"
import { BaseToolSchema } from "./base-tool-schema"

export function generateNewTaskSchema(args: ToolArgs): BaseToolSchema {
	const schema: BaseToolSchema = {
		name: "new_task",
		description: "This will let you create a new task instance in the chosen mode using your provided message.",
		parameters: [
			{
				name: "mode",
				type: "string",
				description: 'The slug of the mode to start the new task in (e.g., "code", "debug", "architect").',
				required: true,
			},
			{
				name: "message",
				type: "string",
				description: "The initial user message or instructions for this new task.",
				required: true,
			},
		],
		systemPrompt: `## new_task
Description: This will let you create a new task instance in the chosen mode using your provided message.

Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "debug", "architect").
- message: (required) The initial user message or instructions for this new task.

Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
</new_task>

Example:
<new_task>
<mode>code</mode>
<message>Implement a new feature for the application.</message>
</new_task>`,
	}

	return schema
}
