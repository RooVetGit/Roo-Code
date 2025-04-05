import { ToolArgs } from "./types"

export function getUseMcpToolDescription(args: ToolArgs): string | undefined {
	if (!args.mcpHub) {
		return undefined
	}
	return `## use_mcp_tool
Use tools provided by MCP servers. Each tool has defined input schemas.

Parameters:
- server_name: MCP server name (required)
- tool_name: Tool to execute (required)
- arguments: JSON input parameters (required)

Usage:
<use_mcp_tool>
<server_name>server_name</server_name>
<tool_name>tool_name</tool_name>
<arguments>{"param":"value"}</arguments>
</use_mcp_tool>

Example:
<use_mcp_tool>
<server_name>weather-server</server_name>
<tool_name>get_forecast</tool_name>
<arguments>{"city":"San Francisco","days":5}</arguments>
</use_mcp_tool>`
}
