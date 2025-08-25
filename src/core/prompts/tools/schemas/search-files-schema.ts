import { ToolArgs } from "../types"
import { BaseToolSchema } from "./base-tool-schema"

export function generateSearchFilesSchema(args: ToolArgs): BaseToolSchema {
	const schema: BaseToolSchema = {
		name: "search_files",
		description: `Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.`,
		parameters: [
			{
				name: "path",
				type: "string",
				description: `Directory path to search in (relative to workspace directory ${args.cwd}). This directory will be recursively searched. When searching the entire workspace, the parameter value is '.'`,
				required: true,
			},
			{
				name: "regex",
				type: "string",
				description: "Regular expression pattern to search for. Uses Rust regex syntax.",
				required: true,
			},
			{
				name: "file_pattern",
				type: "string",
				description:
					"Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).",
				required: false,
			},
		],
		systemPrompt: `## search_files
Description: Request to perform a regex search across files in a specified directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.
Parameters:
- path: (required) The path of the directory to search in (relative to the current workspace directory ${args.cwd}). This directory will be recursively searched.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).
Usage:
<search_files>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
</search_files>

Example: Requesting to search for all .ts files in the current directory
<search_files>
<path>.</path>
<regex>.*</regex>
<file_pattern>*.ts</file_pattern>
</search_files>`,
	}

	return schema
}
