import { ToolArgs } from "./types"

export function getAccessMcpResourceDescription(args: ToolArgs): string | undefined {
	if (!args.mcpHub) {
		return undefined
	}
	return `## access_mcp_resource
Access MCP server resources (files, APIs, etc.)

Parameters:
- server_name: MCP server name (required)
- uri: Resource identifier (required)

Usage:
<access_mcp_resource>
<server_name>server_name</server_name>
<uri>resource_uri</uri>
</access_mcp_resource>

Example:
<access_mcp_resource>
<server_name>weather-server</server_name>
<uri>weather://san-francisco/current</uri>
</access_mcp_resource>`
}
