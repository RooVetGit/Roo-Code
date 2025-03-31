import { ToolArgs } from "./types"

export function getSearchFilesDescription(args: ToolArgs): string {
	return `## search_files
Regex search across files with context. Recursively searches directory.

Parameters:
- path: Directory to search (required, relative to ${args.cwd})
- regex: Pattern to match (required, Rust regex syntax)
- file_pattern: File filter (optional, e.g. '*.ts')

Usage:
<search_files>
<path>directory_path</path>
<regex>pattern</regex>
<file_pattern>filter</file_pattern>  <!-- optional -->
</search_files>

Example: Search TS files:
<search_files>
<path>.</path>
<regex>.*</regex>
<file_pattern>*.ts</file_pattern>
</search_files>`
}
