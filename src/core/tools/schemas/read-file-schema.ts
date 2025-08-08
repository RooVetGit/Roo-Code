import { ToolArgs } from "../../prompts/tools/types"
import { BaseToolSchema } from "./base-tool-schema"
const baseReadFileSchema: BaseToolSchema = {
	name: "read_file",
	description:
		"Request to read the contents a file. Supports text extraction from PDF and DOCX files, but may not handle other binary files properly.",
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
					description: "Array of files to read",
					required: true,
					items: {
						name: "fileItem",
						type: "object",
						description: "Single file to read",
						required: true,
						properties: {
							path: {
								name: "path",
								type: "string",
								description: "File path (relative to workspace directory)",
								required: true,
							},
						},
					},
				},
			},
		},
	],
}

export const readFileSchema: BaseToolSchema = {
	...baseReadFileSchema,
	customDescription: (args: ToolArgs) => {
		const schema = JSON.parse(JSON.stringify(baseReadFileSchema))
		const maxConcurrentReads = args.settings?.maxConcurrentFileReads ?? 5
		const isMultipleReadsEnabled = maxConcurrentReads > 1
		const partialReadsEnabled = args.partialReadsEnabled || false
		if (partialReadsEnabled) {
			schema.parameters[0].properties.file.items.properties.line_range = {
				name: "line_range",
				type: "string",
				description: `One or more line range elements in format "start-end" (1-based, inclusive)
- You MUST use line ranges to read specific portions of large files, rather than reading entire files when not needed
- You MUST combine adjacent line ranges (<10 lines apart)
- You MUST use multiple ranges for content separated by >10 lines
- You MUST include sufficient line context for planned modifications while keeping ranges minimal`,
				required: false,
			}
		}
		schema.description = `Request to read the contents of ${isMultipleReadsEnabled ? `up to ${maxConcurrentReads} files at once` : "a file"}. The tool outputs line-numbered content (e.g. "1 | const x = 1") for easy reference when creating diffs or discussing code.${args.partialReadsEnabled ? " Use line ranges to efficiently read specific portions of large files." : ""} Supports text extraction from PDF and DOCX files, but may not handle other binary files properly.`
		if (isMultipleReadsEnabled) {
			// schema.description += `\n\n**IMPORTANT: You can read a maximum of ${maxConcurrentReads} files in a single request.** If you need to read more files, use multiple sequential read_file requests.`
		}
		schema.parameters[0].properties.file.description = `Array of files to read (up to ${maxConcurrentReads} files at once). Each file must include the path and optionally a line range.
IMPORTANT: You MUST use this Efficient Reading Strategy:
- ${isMultipleReadsEnabled ? `You MUST read all related files and implementations together in a single operation (up to ${maxConcurrentReads} files at once)` : "You MUST read files one at a time, as multiple file reads are currently disabled"}
- You MUST obtain all necessary context before proceeding with changes`
		if (isMultipleReadsEnabled) {
			schema.parameters[0].properties.file.description += `${isMultipleReadsEnabled ? `- When you need to read more than ${maxConcurrentReads} files, prioritize the most critical files first, then use subsequent read_file requests for additional files` : ""}`
		}
		return schema as BaseToolSchema
	},
}
