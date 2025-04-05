import { ToolArgs } from "./types"

export function getListCodeDefinitionNamesDescription(args: ToolArgs): string {
	return `## list_code_definition_names
List top-level code definitions (classes, functions etc.) in a directory.
Parameters:
- path: Directory to scan (required, relative to ${args.cwd})
Usage:
<list_code_definition_names>
<path>directory_path</path>
</list_code_definition_names>

Example:
<list_code_definition_names>
<path>.</path>
</list_code_definition_names>`
}
