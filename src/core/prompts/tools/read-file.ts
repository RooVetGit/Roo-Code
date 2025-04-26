import { ToolArgs } from "./types"

export function getReadFileDescription(args: ToolArgs): string {
	return `## read_file
Description: Request to read the contents of one or more files at the specified path(s). Use this when you need to examine the contents of existing files you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files. The output includes line numbers prefixed to each line (e.g. "1 | const x = 1"), making it easier to reference specific lines when creating diffs or discussing code. When reading multiple files, the output for each file will be clearly demarcated. By specifying start_line and end_line parameters, you can efficiently read specific portions of large files without loading the entire file into memory (this applies only when reading a single file). Automatically extracts raw text from PDF and DOCX files. May not be suitable for other types of binary files, as it returns the raw content as a string.
Parameters:
- path: (required) The path of the file to read, or a JSON string array of multiple file paths (relative to the current workspace directory ${args.cwd}). The maximum number of concurrent file reads is controlled by the 'maxConcurrentFileReads' user setting (default: 1); respect this limit when requesting multiple files. Providing a single path string maintains the original behavior.
- start_line: (optional) The starting line number to read from (1-based). If not provided, it starts from the beginning of the file. *Applies only when reading a single file.*
- end_line: (optional) The ending line number to read to (1-based, inclusive). If not provided, it reads to the end of the file. *Applies only when reading a single file.*
Usage:
<read_file>
<path>File path here or JSON array string of paths</path>
<start_line>Starting line number (optional, single file only)</start_line>
<end_line>Ending line number (optional, single file only)</end_line>
</read_file>

Examples:

1. Reading an entire single file:
<read_file>
<path>frontend-config.json</path>
</read_file>

2. Reading multiple files:
<read_file>
<path>["package.json", "README.md"]</path>
</read_file>

3. Reading the first 1000 lines of a large log file (single file only):
<read_file>
<path>logs/application.log</path>
<end_line>1000</end_line>
</read_file>

4. Reading lines 500-1000 of a CSV file (single file only):
<read_file>
<path>data/large-dataset.csv</path>
<start_line>500</start_line>
<end_line>1000</end_line>
</read_file>

5. Reading a specific function in a source file (single file only):
<read_file>
<path>src/app.ts</path>
<start_line>46</start_line>
<end_line>68</end_line>
</read_file>

Note: When both start_line and end_line are provided (for single file reads), this tool efficiently streams only the requested lines, making it suitable for processing large files like logs, CSV files, and other large datasets without memory issues.`
}
