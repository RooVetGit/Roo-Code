import { ToolArgs } from "./types"

export function getGetSymbolDocumentationDescription(): string {
	return `## get_symbol_documentation
Description: Request to retrieve documentation, type information, and other hover details for a symbol in the codebase.
Parameters:
- symbol_name: (required) The name of the symbol to look up (function, class, method, etc.)
- path: (optional) Path to a file where the symbol is used/referenced, to scope the search and avoid conflicts with similarly named symbols

Usage:
<get_symbol_documentation>
<symbol_name>MyClass</symbol_name>
<path>src/models/user.ts</path>
</get_symbol_documentation>

Example: Requesting documentation for a class named "User" that is referenced in a specific file
<get_symbol_documentation>
<symbol_name>User</symbol_name>
<path>src/controllers/auth.ts</path>
</get_symbol_documentation>`
}
