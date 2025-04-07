import { ToolArgs } from "./types"

export function getSearchAndReplaceDescription(args: ToolArgs): string {
	return `## search_and_replace
Find/replace text in files with regex and line range support. Shows diff preview.
Parameters:
- path: File to modify (required, relative to ${args.cwd.toPosix()})
- operations: Search/replace ops (required, JSON array)
	 - search: Text/pattern to find (required)
	 - replace: Replacement text (required, use \n for multi-line)
	 - start_line/end_line: Line range (optional)
	 - use_regex: Use regex pattern (optional)
	 - ignore_case: Case insensitive (optional)
	 - regex_flags: Additional flags (optional)
Usage:
<search_and_replace>
<path>file_path</path>
<operations>[
	 {
	   "search": "find_this",
	   "replace": "with_this",
	   "start_line": 1,
	   "end_line": 10
	 }
]</operations>
</search_and_replace>
Example: Basic replace:
<search_and_replace>
<path>file.ts</path>
<operations>[{"search":"foo","replace":"bar","start_line":1,"end_line":10}]</operations>
</search_and_replace>
Example: Regex replace:
<search_and_replace>
<path>file.ts</path>
<operations>[{"search":"old\\w+","replace":"new$&","use_regex":true}]</operations>
</search_and_replace>`
}
