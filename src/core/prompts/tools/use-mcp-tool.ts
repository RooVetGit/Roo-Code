import { ToolArgs } from "./types"

export function getUseMcpToolDescription(args: ToolArgs): string | undefined {
	if (!args.mcpHub) {
		return undefined
	}
	return `## use_mcp_tool
Description: Execute specialized tools from MCP servers using their defined input schemas.
Parameters:
- server_name: (required) MCP server providing the tool
- tool_name: (required) Name of the tool to execute
- arguments: (required) JSON object with input parameters
Usage:
<use_mcp_tool>
<server_name>provider_server</server_name>
<tool_name>specific_tool</tool_name>
<arguments>
{
  "param1": "value1",
  "param2": "value2"
}
</arguments>
</use_mcp_tool>

Example:
<use_mcp_tool>
<server_name>weather-server</server_name>
<tool_name>get_forecast</tool_name>
<arguments>
{
  "city": "San Francisco",
  "days": 5
}
</arguments>
</use_mcp_tool>`
}
