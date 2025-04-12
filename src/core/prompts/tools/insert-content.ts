import { ToolArgs } from "./types"

export function getInsertContentDescription(args: ToolArgs): string {
	return `## insert_content
Description: Insert new content at specific line positions in a file.

Parameters:
- path: (required) File path relative to workspace directory ${args.cwd.toPosix()}
- operations: (required) One or more insertion operations in the following format:

<operation>
:start_line: (required) Line number where content will be inserted (1-based)
	           Use 0 to append at end of file
	           Use any positive number to insert before that line
-------
[content to insert]
</operation>

Examples:
<insert_content>
<path>src/utils.ts</path>
<operations>
<operation>
:start_line:1
-------
// Add imports at start of file
import { sum } from './math';
</operation>

<operation>
:start_line:0
-------
// Add method at end of file
function calculateTotal(items: number[]): number {
	   return items.reduce((sum, item) => sum + item, 0);
}
</operation>

<operation>
:start_line:15
-------
// Insert before line 15
const DEFAULT_VALUE = 0;
</operation>
</operations>
</insert_content>`
}
