import { BaseToolSchema } from "./base-tool-schema"

export const writeToFileSchema: BaseToolSchema = {
	name: "write_to_file",
	description:
		"Request to write content to a file. Used for creating new files or complete rewrites of existing files. Automatically creates any directories needed.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "File path to write to (relative to workspace directory)",
			required: true,
		},
		{
			name: "content",
			type: "string",
			description: "Content to write to the file",
			required: true,
		},
		{
			name: "line_count",
			type: "number",
			description: "Total number of lines in the file, including empty lines",
			required: true,
		},
	],
}
