import { ToolArgs } from "./types"
import { PARAMETER_DESCRIPTIONS } from "../constants"

export function getListFilesDescription(args: ToolArgs): string {
	return `## list_files
Description: List files and directories in the specified location. Shows only top-level contents by default.
Parameters:
- path: (required) ${PARAMETER_DESCRIPTIONS.PATH(args.cwd)}
- recursive: (optional) Set to "true" to list all nested files and subdirectories
Usage:
<list_files>
<path>Directory path</path>
<recursive>true or false (optional)</recursive>
</list_files>

Examples:
<list_files>
<path>.</path>
</list_files>

<list_files>
<path>src</path>
<recursive>true</recursive>
</list_files>`
}
