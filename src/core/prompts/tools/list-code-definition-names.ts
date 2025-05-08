import { ToolArgs } from "./types"
import { PARAMETER_DESCRIPTIONS } from "../constants"

export function getListCodeDefinitionNamesDescription(args: ToolArgs): string {
	return `## list_code_definition_names
Description: Extract structure by listing all code definitions (classes, functions, methods) from source files or directories.
Parameters:
- path: (required) ${PARAMETER_DESCRIPTIONS.PATH(args.cwd)} to analyze
Usage:
<list_code_definition_names>
<path>File or directory path</path>
</list_code_definition_names>

Examples:
<list_code_definition_names>
<path>src/main.ts</path>
</list_code_definition_names>

<list_code_definition_names>
<path>src/components</path>
</list_code_definition_names>`
}
