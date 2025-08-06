import { BaseToolSchema } from "./base-tool-schema"

export const searchFilesSchema: BaseToolSchema = {
	name: "search_files",
	description:
		"Request to perform a regex search across files in a specified directory, providing context-rich results. Searches for patterns or specific content across multiple files, displaying each match with encapsulating context.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "Directory path to search in (relative to workspace directory)",
			required: true,
		},
		{
			name: "regex",
			type: "string",
			description: "Regular expression pattern to search for (Rust regex syntax)",
			required: true,
		},
		{
			name: "file_pattern",
			type: "string",
			description: "Glob pattern to filter files (e.g., '*.ts')",
			required: false,
		},
	],
}
