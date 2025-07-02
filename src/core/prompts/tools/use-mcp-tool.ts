import { ToolArgs } from "./types"
import { getModeBySlug, isServerAllowedForMode, isToolAllowedForModeAndServer } from "../../../shared/modes"

export function getUseMcpToolDescription(args: ToolArgs): string | undefined {
	if (!args.mcpHub) {
		return undefined
	}

	let availableServers = args.mcpHub.getServers()

	// NEW: Filter servers based on mode restrictions
	if (args.currentMode && args.customModes) {
		const mode = getModeBySlug(args.currentMode, args.customModes)
		const restrictions = mode?.mcpRestrictions || {} // Use empty object if no restrictions defined

		// Always filter based on defaultEnabled, even if no explicit restrictions
		availableServers = availableServers.filter((server) => {
			// Get server configuration to check defaultEnabled setting
			const serverConfig = args.mcpHub?.getServerConfig(server.name)
			const defaultEnabled = serverConfig?.defaultEnabled ?? true // Default to true if not specified

			return isServerAllowedForMode(server.name, restrictions, defaultEnabled)
		})
	}

	// Generate description with filtered servers and their available tools
	if (availableServers.length === 0) {
		return `## use_mcp_tool
Description: Request to use a tool provided by a connected MCP server. 
**Note: No MCP servers are available for the current mode.**

This tool allows you to execute tools provided by Model Context Protocol (MCP) servers, but the current mode has restrictions that prevent access to all configured MCP servers.

Parameters:
- server_name: (required) The name of the MCP server providing the tool
- tool_name: (required) The name of the tool to execute  
- arguments: (required) A JSON object containing the tool's input parameters`
	}

	const serverDescriptions = availableServers
		.map((server) => {
			let availableTools = server.tools || []

			// Filter tools based on mode restrictions (only if explicit restrictions exist)
			if (args.currentMode && args.customModes) {
				const mode = getModeBySlug(args.currentMode, args.customModes)
				const restrictions = mode?.mcpRestrictions

				if (restrictions) {
					availableTools = availableTools.filter((tool) =>
						isToolAllowedForModeAndServer(server.name, tool.name, restrictions),
					)
				}
			}

			const toolList =
				availableTools.length > 0
					? availableTools
							.map((tool) => {
								const desc = tool.description ? ` - ${tool.description}` : ""
								return `  • ${tool.name}${desc}`
							})
							.join("\n")
					: "  (No tools available for current mode)"

			return `**${server.name}**:\n${toolList}`
		})
		.join("\n\n")

	return `## use_mcp_tool
Description: Request to use a tool provided by a connected MCP server. Each MCP server can provide multiple tools with different capabilities. Tools have defined input schemas that specify required and optional parameters.

**Available servers and tools for current mode:**
${serverDescriptions}

Parameters:
- server_name: (required) The name of the MCP server providing the tool
- tool_name: (required) The name of the tool to execute
- arguments: (required) A JSON object containing the tool's input parameters, following the tool's input schema

Usage:
<use_mcp_tool>
<server_name>server name here</server_name>
<tool_name>tool name here</tool_name>
<arguments>
{
  "param1": "value1",
  "param2": "value2"
}
</arguments>
</use_mcp_tool>

Example: Requesting to use an MCP tool

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
