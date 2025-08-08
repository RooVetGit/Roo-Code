import { BaseToolSchema } from "./base-tool-schema"

export const applyDiffSchema: BaseToolSchema = {
	name: "apply_diff",
	description:
		"Request to apply PRECISE, TARGETED modifications to one or more files by searching for specific sections of content and replacing them. This tool is for SURGICAL EDITS ONLY - specific changes to existing code. This tool supports both single-file and multi-file operations, allowing you to make changes across multiple files in a single request. You can perform multiple distinct search and replace operations within a single apply_diff call by providing multiple SEARCH/REPLACE blocks in the diff parameter. This is the preferred way to make several targeted changes efficiently. The SEARCH section must exactly match existing content including whitespace and indentation. If you're not confident in the exact content to search for, use the read_file tool first to get the exact content.",
	parameters: [
		{
			name: "args",
			type: "object",
			description: "Arguments for the apply_diff tool",
			required: true,
			properties: {
				file: {
					name: "file",
					type: "array",
					description: "the operations of multiple files to perform",
					required: true,
					items: {
						name: "fileItem",
						type: "object",
						description: "Single file diff",
						required: true,
						properties: {
							path: {
								name: "path",
								type: "string",
								description:
									"The path of the file to modify (relative to the current workspace directory)",
								required: true,
							},
							diff: {
								name: "diff",
								type: "array",
								description: "Array of diff operations for this file",
								required: true,
								items: {
									name: "diffItem",
									type: "object",
									description: "Single diff operation",
									required: true,
									properties: {
										content: {
											name: "content",
											type: "string",
											description: `Your search/replace content here.
You can use multi search/replace block in one diff block, but make sure to include the line numbers for each block.
Only use a single line of '=======' between search and replacement content, because multiple '=======' will corrupt the file. 
first line must be <<<<<<< SEARCH
end line must be >>>>>>> REPLACE`,
											required: true,
										},
										start_line: {
											name: "start_line",
											type: "number",
											description: "The line number where the search str starts",
											required: true,
										},
									},
								},
							},
						},
					},
				},
			},
		},
	],
}
