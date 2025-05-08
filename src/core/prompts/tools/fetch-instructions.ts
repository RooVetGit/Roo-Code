/**
 * Generate the description for the fetch_instructions tool
 * @returns Tool description with parameters and examples
 */
export function getFetchInstructionsDescription(): string {
	return `## fetch_instructions
Description: Retrieve detailed instructions for specialized tasks
Parameters:
- task: (required) Task identifier to get instructions for. Available values:
  • create_mcp_server - Instructions for creating an MCP server
  • create_mode - Instructions for creating a custom mode

Example:
<fetch_instructions>
<task>create_mcp_server</task>
</fetch_instructions>`
}
