import { ToolArgs } from "./types"
import { PARAMETER_DESCRIPTIONS } from "../constants"

export function getInsertContentDescription(args: ToolArgs): string {
	return `## insert_content
Description: Add new lines to a file without modifying existing content. Ideal for adding imports, functions, or configuration blocks.

Parameters:
- path: (required) ${PARAMETER_DESCRIPTIONS.PATH(args.cwd.toPosix())}
- line: (required) ${PARAMETER_DESCRIPTIONS.LINE}
- content: (required) ${PARAMETER_DESCRIPTIONS.CONTENT}

Examples:
<insert_content>
<path>src/utils.ts</path>
<line>1</line>
<content>
// Add imports at start of file
import { sum } from './math';
</content>
</insert_content>

<insert_content>
<path>src/utils.ts</path>
<line>0</line>
<content>
// Append to end of file
</content>
</insert_content>
`
}
