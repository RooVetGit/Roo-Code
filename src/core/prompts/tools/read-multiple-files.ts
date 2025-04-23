import { ToolArgs } from "./types"

// Based on readFileTool, adapted for multiple files
export function getReadMultipleFilesDescription(args: ToolArgs): string {
	return `## read_multiple_files
Description: Request to read the contents of multiple files simultaneously. This is more efficient than reading files one by one. Each file's content is returned with its path. Failed reads for individual files won't stop the entire operation. Use this when you need to examine the contents of multiple existing files. Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files.
Parameters:
- paths: (required) A JSON array of strings, where each string is the path of a file to read (relative to the current workspace directory ${args.cwd})
Usage:
<read_multiple_files>
<paths>["path/to/file1.txt", "path/to/another/file2.js"]</paths>
</read_multiple_files>

Example: Requesting to read two files

<read_multiple_files>
<paths>["src/main.ts", "docs/README.md"]</paths>
</read_multiple_files>

Note: This tool currently reads the entire content of each file. Range reads (start_line/end_line) are not supported for this tool yet.`
}
