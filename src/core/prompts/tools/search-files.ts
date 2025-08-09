import { ToolArgs } from "./types"

export function getSearchFilesDescription(args: ToolArgs): string {
	return `## search_files
Description: Request to perform a regex search across files in a directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with surrounding context.
Parameters:
- path: (optional) The directory to search in, relative to workspace ${args.cwd}. Defaults to "." (current directory). Use "." to search the entire project.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts' for TypeScript files). Defaults to "*" (all files).
Usage:
<search_files>
<path>.</path>
<regex>Your regex pattern here</regex>
<file_pattern>*.ts</file_pattern>
</search_files>

Examples:

1. Search entire project for a pattern:
<search_files>
<regex>TODO</regex>
</search_files>

2. Search in a specific directory:
<search_files>
<path>src/components</path>
<regex>useState</regex>
<file_pattern>*.tsx</file_pattern>
</search_files>`
}
