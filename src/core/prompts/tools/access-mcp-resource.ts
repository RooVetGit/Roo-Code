import { ToolArgs } from "./types"

export function getAccessMcpResourceDescription(args: ToolArgs): string | undefined {
	if (!args.mcpHub) {
		return undefined
	}
	return `## access_mcp_resource
Description: Access resources (data, files, API responses) from connected MCP servers.
Parameters:
- server_name: (required) Name of the MCP server providing the resource
- uri: (required) Resource identifier URI
Usage:
<access_mcp_resource>
<server_name>server name</server_name>
<uri>resource URI</uri>
</access_mcp_resource>

Example:
<access_mcp_resource>
<server_name>weather-server</server_name>
<uri>weather://san-francisco/current</uri>
</access_mcp_resource>`
}
