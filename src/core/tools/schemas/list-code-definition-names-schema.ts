import { BaseToolSchema } from "./base-tool-schema"

export const listCodeDefinitionNamesSchema: BaseToolSchema = {
	name: "list_code_definition_names",
	description:
		"Request to list definition names (classes, functions, methods, etc.) from source code. Can analyze a single file or all files at the top level of a specified directory.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "File or directory path to analyze (relative to workspace directory)",
			required: true,
		},
	],
}
