import { ToolArgs } from "./types"

export function getInsertContentDescription(args: ToolArgs): string {
	return `## insert_content
Description: Use this tool specifically for adding new lines of content into a file without modifying existing content. Specify the line number to insert before, or use line 0 to append to the end. Ideal for adding imports, functions, configuration blocks, log entries, or any multi-line text block.

Parameters:
- path: (required) File path relative to workspace directory ${args.cwd.toPosix()}
- line: (required) Line number where content will be inserted (1-based)
	      Use 0 to append at end of file
	      Use any positive number to insert before that line
- content: (required) The content to insert at the specified line

Example for inserting imports at start of file:
<insert_content>
<path>src/utils.ts</path>
<line>1</line>
<content>
// Add imports at start of file
import { sum } from './math';
</content>
</insert_content>

Example for appending to the end of file:
<insert_content>
<path>src/utils.ts</path>
<line>0</line>
<content>
// This is the end of the file
</content>
</insert_content>

Example for creating very large files that exceed output limits:
<write_to_file>
<path>src/large_file.txt</path>
<content>
// This is the beginning of a very large file but you must terminate prematurely in order for line_count to be produced:
</content>
<line_count>100</line_count>
</write_to_file>

Then use insert_content to append the rest of the content starting immediately where you left off; repeat as many times as necessary:
<insert_content>
<path>src/large_file.txt</path>
<line>0</line>
<content>
// This is a continuation of very large file
</content>
</insert_content>
`
}
