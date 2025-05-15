import { ToolArgs } from "./types"

export function getFindReferencesDescription(args: ToolArgs): string {
	return `## find_references
Description: Request to find all references to a specific symbol (variable, function, class, etc.) across files in the workspace using VS Code's language services. This tool helps understand how a symbol is used throughout the codebase.

IMPORTANT: PREFER THIS TOOL OVER search_files WHEN LOOKING FOR CODE SYMBOLS (functions, methods, etc). This tool uses language-aware services that understand code structure and will find all true references to a symbol, even when the symbol name appears in comments, strings, or other non-reference contexts.

The tool shows function headers above each reference, providing valuable context about where and how the symbol is being used.

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

Example: Requesting to find all references to a function named 'processData'
<find_references>
<symbol>processData</symbol>
<file_path>src/app.ts</file_path>
<line_number>42</line_number>
</find_references>`
}