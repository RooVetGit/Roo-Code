import { ToolArgs } from "./types"

export function getSearchAndReplaceDescription(args: ToolArgs): string {
	return `## search_and_replace
Description: Request to perform search and replace operations on a file. Each operation can specify a search pattern (string or regex) and replacement text, with optional line range restrictions and regex flags. Shows a diff preview before applying changes.
Parameters:
- path: (required) The path of the file to modify (relative to the current workspace directory ${args.cwd.toPosix()})
- operations: (required) One or more search/replace operations in the following format:

<operation
  start_line="Starting line number (1-based)" (optional)
  end_line="Ending line number (1-based)" (optional)
  use_regex="true|false" (optional)
  ignore_case="true|false" (optional)
  regex_flags="Additional regex flags" (optional)
>
  <search>Text or pattern to search for</search>
  <replace>Text to replace matches with</replace>
</operation>

Examples:
<search_and_replace>
<path>example.ts</path>
<operations>
<operation
  start_line="1"
  end_line="10"
>
  <search>foo</search>
  <replace>bar</replace>
</operation>
</operations>
</search_and_replace>

Example: Replace using regex with flags
<search_and_replace>
<path>example.ts</path>
<operations>
<operation
  use_regex="true"
  ignore_case="true"
  regex_flags="g"
>
  <search>old\\w+</search>
  <replace>new$&</replace>
</operation>
</operations>
</search_and_replace>`
}
