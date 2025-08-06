import { BaseToolSchema } from "./base-tool-schema"

export const listFilesSchema: BaseToolSchema = {
	name: "list_files",
	description:
		"Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If false or omitted, only top-level contents are listed.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "Directory path to list (relative to workspace directory)",
			required: true,
		},
		{
			name: "recursive",
			type: "boolean",
			description: "Whether to list files recursively",
			required: false,
		},
	],
}
