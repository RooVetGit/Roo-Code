import { BaseToolSchema } from "./base-tool-schema"

export const insertContentSchema: BaseToolSchema = {
	name: "insert_content",
	description:
		"Add new lines of content into a file without modifying existing content. Specify the line number to insert before, or use line 0 to append to the end.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "File path (relative to workspace directory)",
			required: true,
		},
		{
			name: "line",
			type: "number",
			description: "Line number where content will be inserted (1-based, 0 to append at end)",
			required: true,
		},
		{
			name: "content",
			type: "string",
			description: "Content to insert at the specified line",
			required: true,
		},
	],
}
