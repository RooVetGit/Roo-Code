import { ToolArgs } from "./types"

export function getReadFileDescription(args: ToolArgs): string {
	return `## read_file
Read file contents with line numbers. Use to analyze code, text files, or configs. Handles PDF/DOCX. Not for binary files.

Parameters:
- path: File path (required, relative to ${args.cwd})
- start_line: Starting line (optional, 1-based)
- end_line: Ending line (optional, inclusive)
- auto_truncate: Auto-truncate large files (optional, default false)

Usage:
<read_file>
<path>file_path</path>
<start_line>N</start_line>  <!-- optional -->
<end_line>M</end_line>    <!-- optional -->
<auto_truncate>true</auto_truncate>  <!-- optional -->
</read_file>

Examples:
1. Full file: <read_file><path>config.json</path></read_file>
2. First 1000 lines: <read_file><path>app.log</path><end_line>1000</end_line></read_file>
3. Lines 500-1000: <read_file><path>data.csv</path><start_line>500</start_line><end_line>1000</end_line></read_file>
4. Function: <read_file><path>src/app.ts</path><start_line>46</start_line><end_line>68</end_line></read_file>
5. Auto-truncate: <read_file><path>large.ts</path><auto_truncate>true</auto_truncate></read_file>

Efficiently streams requested lines for large files. Auto-truncate provides line count and method summaries.`
}
