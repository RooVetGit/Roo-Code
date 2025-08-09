import { ToolArgs } from "./types"

export function getSearchFilesDescription(args: ToolArgs): string {
	return `## search_files
Description: Request to perform a regex search across files in a directory, providing context-rich results. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.
Parameters:
- path: (optional) The path of the directory to search in (relative to the current workspace directory ${args.cwd}). If not provided, searches from the current workspace root. This directory will be recursively searched.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).
Usage:
<search_files>
<path>Directory path here (optional - defaults to workspace root)</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
</search_files>

Example 1: Search for a pattern in all files from workspace root
<search_files>
<regex>browserActionTool</regex>
</search_files>

Example 2: Search in a specific directory for .ts files
<search_files>
<path>src/tools</path>
<regex>.*</regex>
<file_pattern>*.ts</file_pattern>
</search_files>`
}
