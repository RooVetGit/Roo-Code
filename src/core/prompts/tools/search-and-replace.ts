import { ToolArgs } from "./types"
import { PARAMETER_DESCRIPTIONS } from "../constants"

export function getSearchAndReplaceDescription(args: ToolArgs): string {
	return `## search_and_replace
Description: Find and replace text or patterns in files with preview. Supports regex, case sensitivity, and line range targeting.

Required Parameters:
- path: ${PARAMETER_DESCRIPTIONS.PATH(args.cwd.toPosix())}
- search: Text or pattern to find
- replace: Replacement text

Optional Parameters:
- start_line: First line to check (1-based)
- end_line: Last line to check (1-based)
- use_regex: "true" to use regex patterns
- ignore_case: "true" for case-insensitive matching

Examples:

1. Simple replacement:
<search_and_replace>
<path>example.ts</path>
<search>oldText</search>
<replace>newText</replace>
</search_and_replace>

2. Regex replacement:
<search_and_replace>
<path>example.ts</path>
<search>old\w+</search>
<replace>new$&</replace>
<use_regex>true</use_regex>
<ignore_case>true</ignore_case>
</search_and_replace>`
}
