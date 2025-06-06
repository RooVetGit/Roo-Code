import { ToolArgs } from "./types"

export function getSearchAndReplaceDescription(args: ToolArgs): string {
	return `## search_and_replace
Description: Use this tool to find and replace specific text strings or patterns (using regex) within a file. It's suitable for targeted replacements across multiple locations within the file. Supports literal text and regex patterns, case sensitivity options, and optional line ranges. Shows a diff preview before applying changes.

Required Parameters:
- path: The path of the file to modify (relative to the current workspace directory ${args.cwd.toPosix()})
- search: The text or pattern to search for
- replace: The text to replace matches with

Optional Parameters:
- start_line: Starting line number for restricted replacement (1-based)
- end_line: Ending line number for restricted replacement (1-based)
- use_regex: Set to "true" to treat search as a regex pattern (default: false)
- ignore_case: Set to "true" to ignore case when matching (default: false)
- requireUniqueMatch: Set to "true" to ensure only one match is found and replaced (default: false). If true, 'search' is a literal string, 'use_regex' is ignored for matching (though 'ignore_case' is still respected). If 0 or >1 matches, an error occurs.

Notes:
- When use_regex is true (and requireUniqueMatch is false), the search parameter is treated as a regular expression pattern.
- When ignore_case is true, the search is case-insensitive.
- If requireUniqueMatch is true, the 'search' string is treated as a literal string and the tool will only perform a replacement if exactly one occurrence is found. 'use_regex' is ignored for matching purposes if requireUniqueMatch is true (though 'ignore_case' is still respected for the literal match). If 0 or more than 1 match is found, an error is returned.

Examples:

1. Simple text replacement:
<search_and_replace>
<path>example.ts</path>
<search>oldText</search>
<replace>newText</replace>
</search_and_replace>

2. Case-insensitive regex pattern:
<search_and_replace>
<path>example.ts</path>
<search>old\w+</search>
<replace>new$&</replace>
<use_regex>true</use_regex>
<ignore_case>true</ignore_case>
</search_and_replace>`
}
