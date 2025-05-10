import { ToolArgs } from "./types"

export function getReadFileDescription(args: ToolArgs): string {
	return `## read_file
Description: Request to read the contents of one or more files. The tool outputs line-numbered content (e.g. "1 | const x = 1") for easy reference when creating diffs or discussing code. Use line ranges to efficiently read specific portions of large files. Supports text extraction from PDF and DOCX files, but may not handle other binary files properly.

${args.settings?.maxConcurrentFileReads ? `**IMPORTANT: You can read a maximum of ${args.settings?.maxConcurrentFileReads} files in a single request.** If you need to read more files, use multiple sequential read_file requests.` : ""}

Parameters:
- args: Contains one or more file elements, where each file contains:
  - path: (required) File path (relative to workspace directory ${args.cwd})
  - line_range: (optional) One or more line range elements in format "start-end" (1-based, inclusive)

Usage:
<read_file>
<args>
  <file>
    <path>path/to/file</path>
    <line_range>1-100</line_range>
    <line_range>200-300</line_range>
  </file>
</args>
</read_file>

Examples:

1. Reading a single file with one line range:
<read_file>
<args>
  <file>
    <path>src/app.ts</path>
    <line_range>1-1000</line_range>
  </file>
</args>
</read_file>

2. Reading multiple files with different line ranges${args.settings?.maxConcurrentFileReads ? ` (within the ${args.settings?.maxConcurrentFileReads}-file limit)` : ""}:
<read_file>
<args>
  <file>
    <path>src/app.ts</path>
    <line_range>1-50</line_range>
    <line_range>100-150</line_range>
  </file>
  <file>
    <path>src/utils.ts</path>
    <line_range>10-20</line_range>
  </file>
</args>
</read_file>

3. Reading an entire file (omitting line ranges):
<read_file>
<args>
  <file>
    <path>config.json</path>
  </file>
</args>
</read_file>

IMPORTANT: You MUST use this Efficient Reading Strategy:
- You MUST read all related files and implementations together in a single operation${args.settings?.maxConcurrentFileReads ? ` (up to ${args.settings?.maxConcurrentFileReads} files at once)` : ""}
- You MUST obtain all necessary context before proceeding with changes
- You MUST combine adjacent line ranges (<10 lines apart)
- You MUST use multiple ranges for content separated by >10 lines
- You MUST include sufficient line context for planned modifications while keeping ranges minimal
${args.settings?.maxConcurrentFileReads ? `- When you need to read more than ${args.settings?.maxConcurrentFileReads} files, prioritize the most critical files first, then use subsequent read_file requests for additional files` : ""}`
}
