import { ToolArgs } from "./types"

export function getFindReferencesDescription(args: ToolArgs): string {
	return `## find_references
Description: Request to find all references to a specific symbol across files in the workspace using VS Code's language services. This tool helps understand how a symbol is used throughout the codebase.

Supported symbol types:
- Functions and methods
- Properties and fields
- Variables and constants
- Classes and interfaces
- Enums and enum members

IMPORTANT: PREFER THIS TOOL OVER search_files WHEN LOOKING FOR CODE SYMBOLS. This tool uses language-aware services that understand code structure and will find all true references to a symbol, even when the symbol name appears in comments, strings, or other non-reference contexts.

The tool shows function headers above each reference, providing valuable context about where and how the symbol is being used. It also includes line ranges for each function or class, which can be used with the read_file tool to read the entire function or class implementation.

Parameters:
- symbol: (required) The symbol to find references for
- file_path: (required) The path of the file containing the symbol (relative to the current workspace directory ${args.cwd})
- line_number: (required) The line number where the symbol is located (0-based)

Usage:
<find_references>
<symbol>Symbol name here</symbol>
<file_path>File path here</file_path>
<line_number>line number</line_number>
</find_references>

Examples:

1. Finding references to a function:
<find_references>
<symbol>processData</symbol>
<file_path>src/app.ts</file_path>
<line_number>42</line_number>
</find_references>

2. Finding references to a property:
<find_references>
<symbol>isEnabled</symbol>
<file_path>src/models/User.ts</file_path>
<line_number>15</line_number>
</find_references>

3. Reading a function after finding references:
First, use find_references to locate the function:
<find_references>
<symbol>processData</symbol>
<file_path>src/app.ts</file_path>
<line_number>42</line_number>
</find_references>

Then, use the line range information from the results to read the entire function:
<read_file>
<path>src/app.ts</path>
<start_line>42</start_line>
<end_line>58</end_line>
</read_file>`
}