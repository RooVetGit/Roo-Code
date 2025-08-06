import { BaseToolSchema } from "./base-tool-schema"

export const searchAndReplaceSchema: BaseToolSchema = {
	name: "search_and_replace",
	description:
		"Find and replace specific text strings or patterns (using regex) within a file. Suitable for targeted replacements across multiple locations within the file.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "File path to modify (relative to workspace directory)",
			required: true,
		},
		{
			name: "search",
			type: "string",
			description: "Text or pattern to search for",
			required: true,
		},
		{
			name: "replace",
			type: "string",
			description: "Text to replace matches with",
			required: true,
		},
		{
			name: "start_line",
			type: "number",
			description: "Starting line number for restricted replacement (1-based)",
			required: false,
		},
		{
			name: "end_line",
			type: "number",
			description: "Ending line number for restricted replacement (1-based)",
			required: false,
		},
		{
			name: "use_regex",
			type: "boolean",
			description: "Treat search as a regex pattern",
			required: false,
		},
		{
			name: "ignore_case",
			type: "boolean",
			description: "Ignore case when matching",
			required: false,
		},
	],
}
