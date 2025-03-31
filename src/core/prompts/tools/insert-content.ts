import { ToolArgs } from "./types"

export function getInsertContentDescription(args: ToolArgs): string {
	return `## insert_content
Insert content at specific lines in a file. Preferred for adding new code.

Parameters:
- path: File path (required, relative to ${args.cwd.toPosix()})
- operations: JSON array of insertions (required)
	 - start_line: Line to insert at (required)
	 - content: Content to insert (required, use \n for multi-line)

Usage:
<insert_content>
<path>file_path</path>
<operations>[
	 {"start_line": N, "content": "text"},
	 {"start_line": M, "content": "multi\nline"}
]</operations>
</insert_content>

Example: Add import and function:
<insert_content>
<path>file.ts</path>
<operations>[
	 {"start_line": 1, "content": "import { sum } from './utils';"},
	 {"start_line": 10, "content": "function total(items: number[]): number {\n  return items.reduce((a,b) => a+b, 0);\n}"}
]</operations>
</insert_content>

Note: Maintain proper indentation for inserted content.`
}
