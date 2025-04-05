export function getFetchInstructionsDescription(): string {
	return `## fetch_instructions
Get task instructions. Supported tasks:
- create_mcp_server
- create_mode

Example:
<fetch_instructions>
<task>create_mcp_server</task>
</fetch_instructions>`
}
