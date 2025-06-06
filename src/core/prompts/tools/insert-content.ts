import { ToolArgs } from "./types"

export function getInsertContentDescription(args: ToolArgs): string {
	return `## insert_content
Description: Use this tool specifically for adding new lines of content into a file without modifying existing content. Specify the line number to insert before, or use line 0 to append to the end. Ideal for adding imports, functions, configuration blocks, log entries, or any multi-line text block.

Parameters:
- path: (required) File path relative to workspace directory ${args.cwd.toPosix()}
- line: (required) Line number where content will be inserted (1-based). Must be between 1 and N+1 (where N is the current number of lines in the file), inclusive. Use 1 to insert at the beginning of the file. Use N+1 to append at the end of the file (or use 0, which is an alias for N+1).
- content: (required) The content to insert. Can be multiple lines.

Example for inserting imports at start of file:
<insert_content>
<path>src/utils.ts</path>
<line>1</line>
<content>
// Add imports at start of file
import { sum } from './math';
</content>
</insert_content>

Example for appending to the end of file (using N+1, assuming file has 100 lines, so insert at 101):
<insert_content>
<path>src/utils.ts</path>
<line>101</line>
<content>
// This is appended to the end of the file
</content>
</insert_content>

Example for appending to the end of file (using 0):
<insert_content>
<path>src/utils.ts</path>
<line>0</line>
<content>
// This is also appended to the end of the file
</content>
</insert_content>
`
}
