import { ToolArgs } from "./types"

export function getReadFunctionDescription(args: ToolArgs): string {
	return `## read_function
Description: Request to read a specific function or method definition from a file. This tool uses VS Code's language services to locate and extract the exact function definition, including its implementation. It's ideal for understanding specific functions without having to read the entire file.

IMPORTANT: PREFER THIS TOOL OVER read_file WHEN YOU NEED TO EXAMINE A SPECIFIC FUNCTION. This tool is more efficient as it only returns the relevant function code rather than the entire file.

Use this tool when you need to:
- Understand how a specific function is implemented
- Examine the logic within a method
- See the parameters and return type of a function
- Analyze a particular piece of functionality

Parameters:
- file_path: (required) The path of the file containing the function (relative to the current workspace directory ${args.cwd})
- symbol: (required) The name of the function or method to read

Usage:
<read_function>
<symbol>functionName</symbol>
<file_path>path/to/file.ts</file_path>
</read_function>

Example: Reading a function by name:
<read_function>
<symbol>findReferences</symbol>
<file_path>src/services/references/index.ts</file_path>
</read_function>`
}