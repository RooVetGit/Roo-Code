import { ToolArgs } from "./types"
import { getModeBySlug, isServerAllowedForMode } from "../../../shared/modes"

export function getAccessMcpResourceDescription(args: ToolArgs): string | undefined {
	if (!args.mcpHub) {
		return undefined
	}

	let availableServers = args.mcpHub.getServers()

	// Filter servers based on mode restrictions
	if (args.currentMode && args.customModes) {
		const mode = getModeBySlug(args.currentMode, args.customModes)
		const restrictions = mode?.mcpRestrictions || {} // Use empty object if no restrictions defined

		// Always filter based on allowedInModesByDefault, even if no explicit restrictions
		availableServers = availableServers.filter((server) => {
			// Get server configuration to check allowedInModesByDefault setting
			const serverConfig = args.mcpHub?.getServerConfig(server.name)
			const allowedInModesByDefault = serverConfig?.allowedInModesByDefault ?? true // Default to true if not specified

			return isServerAllowedForMode(server.name, restrictions, allowedInModesByDefault)
		})
	}

	// Generate description with filtered servers and their available resources
	if (availableServers.length === 0) {
		return `## access_mcp_resource
Description: Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.
**Note: No MCP servers are available for the current mode.**

This tool allows you to access resources provided by Model Context Protocol (MCP) servers, but the current mode has restrictions that prevent access to all configured MCP servers.

Parameters:
- server_name: (required) The name of the MCP server providing the resource
- uri: (required) The URI identifying the specific resource to access`
	}

	const serverDescriptions = availableServers
		.map((server) => {
			const resourceCount = (server.resources || []).length
			const resourceTemplateCount = (server.resourceTemplates || []).length
			const totalResources = resourceCount + resourceTemplateCount

			return `**${server.name}**: ${totalResources} resource${totalResources !== 1 ? "s" : ""} available`
		})
		.join("\n")

	return `## access_mcp_resource
Description: Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.

**Available servers for current mode:**
${serverDescriptions}

Parameters:
- server_name: (required) The name of the MCP server providing the resource
- uri: (required) The URI identifying the specific resource to access

Usage:
<access_mcp_resource>
<server_name>server name here</server_name>
<uri>resource URI here</uri>
</access_mcp_resource>

Example: Requesting to access an MCP resource

<access_mcp_resource>
<server_name>weather-server</server_name>
<uri>weather://san-francisco/current</uri>
</access_mcp_resource>`
}
