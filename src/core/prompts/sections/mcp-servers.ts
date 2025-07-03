import { DiffStrategy } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"
import { ModeConfig } from "@roo-code/types"
import { getModeBySlug } from "../../../shared/modes"

// Helper functions for MCP restriction checking (copied from use-mcp-tool.ts)
function isServerAllowedForMode(serverName: string, restrictions: any, allowedInModesByDefault?: boolean): boolean {
	// Handle allowedInModesByDefault logic first
	// If server has allowedInModesByDefault: false, it must be explicitly allowed
	if (allowedInModesByDefault === false) {
		// Only allowed if explicitly in allowedServers list
		return restrictions.allowedServers ? restrictions.allowedServers.includes(serverName) : false
	}

	// For allowedInModesByDefault: true (default behavior)
	// If allowedServers is defined, server must be in the list
	if (restrictions.allowedServers && !restrictions.allowedServers.includes(serverName)) {
		return false
	}

	// If disallowedServers is defined, server must not be in the list
	if (restrictions.disallowedServers && restrictions.disallowedServers.includes(serverName)) {
		return false
	}

	return true
}

function isToolAllowedForModeAndServer(serverName: string, toolName: string, restrictions: any): boolean {
	// If allowedTools is defined, tool must be in the list
	if (restrictions.allowedTools) {
		// Filter out empty entries before checking
		const validAllowedTools = restrictions.allowedTools.filter(
			(t: any) => t.serverName?.trim() && t.toolName?.trim(),
		)
		if (validAllowedTools.length > 0) {
			const isAllowed = validAllowedTools.some((t: any) => t.serverName === serverName && t.toolName === toolName)
			if (!isAllowed) return false
		}
	}

	// If disallowedTools is defined, tool must not be in the list
	if (restrictions.disallowedTools) {
		// Filter out empty entries before checking
		const validDisallowedTools = restrictions.disallowedTools.filter(
			(t: any) => t.serverName?.trim() && t.toolName?.trim(),
		)
		const isDisallowed = validDisallowedTools.some(
			(t: any) => t.serverName === serverName && t.toolName === toolName,
		)
		if (isDisallowed) return false
	}

	return true
}

export async function getMcpServersSection(
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	enableMcpServerCreation?: boolean,
	currentMode?: string,
	customModes?: ModeConfig[],
): Promise<string> {
	if (!mcpHub) {
		return ""
	}

	let availableServers = mcpHub.getServers()

	// Filter servers based on mode restrictions
	if (currentMode && customModes) {
		const mode = getModeBySlug(currentMode, customModes)
		const restrictions = mode?.mcpRestrictions

		if (restrictions || mode) {
			// Always filter based on allowedInModesByDefault, even if no explicit restrictions
			availableServers = availableServers.filter((server) => {
				// Get server configuration to check allowedInModesByDefault setting
				const serverConfig = mcpHub.getServerConfig(server.name)
				const allowedInModesByDefault = serverConfig?.allowedInModesByDefault ?? true // Default to true if not specified

				return isServerAllowedForMode(server.name, restrictions || {}, allowedInModesByDefault)
			})
		}
	}

	const connectedServers =
		availableServers.length > 0
			? `${availableServers
					.filter((server) => server.status === "connected")
					.map((server) => {
						let availableTools = server.tools?.filter((tool) => tool.enabledForPrompt !== false) || []

						// Filter tools based on mode restrictions
						if (currentMode && customModes) {
							const mode = getModeBySlug(currentMode, customModes)
							const restrictions = mode?.mcpRestrictions

							if (restrictions) {
								availableTools = availableTools.filter((tool) =>
									isToolAllowedForModeAndServer(server.name, tool.name, restrictions),
								)
							}
						}

						const tools =
							availableTools.length > 0
								? availableTools
										.map((tool) => {
											const schemaStr = tool.inputSchema
												? `    Input Schema:
		${JSON.stringify(tool.inputSchema, null, 2).split("\n").join("\n    ")}`
												: ""

											return `- ${tool.name}: ${tool.description}\n${schemaStr}`
										})
										.join("\n\n")
								: null

						const templates = server.resourceTemplates
							?.map((template) => `- ${template.uriTemplate} (${template.name}): ${template.description}`)
							.join("\n")

						const resources = server.resources
							?.map((resource) => `- ${resource.uri} (${resource.name}): ${resource.description}`)
							.join("\n")

						const config = JSON.parse(server.config)

						return (
							`## ${server.name}${config.command ? ` (\`${config.command}${config.args && Array.isArray(config.args) ? ` ${config.args.join(" ")}` : ""}\`)` : ""}` +
							(server.instructions ? `\n\n### Instructions\n${server.instructions}` : "") +
							(tools ? `\n\n### Available Tools\n${tools}` : "") +
							(templates ? `\n\n### Resource Templates\n${templates}` : "") +
							(resources ? `\n\n### Direct Resources\n${resources}` : "")
						)
					})
					.join("\n\n")}`
			: currentMode && customModes && getModeBySlug(currentMode, customModes)?.mcpRestrictions
				? "(No MCP servers are available for the current mode due to restrictions)"
				: "(No MCP servers currently connected)"

	const baseSection = `MCP SERVERS

The Model Context Protocol (MCP) enables communication between the system and MCP servers that provide additional tools and resources to extend your capabilities. MCP servers can be one of two types:

1. Local (Stdio-based) servers: These run locally on the user's machine and communicate via standard input/output
2. Remote (SSE-based) servers: These run on remote machines and communicate via Server-Sent Events (SSE) over HTTP/HTTPS

# Connected MCP Servers

When a server is connected, you can use the server's tools via the \`use_mcp_tool\` tool, and access the server's resources via the \`access_mcp_resource\` tool.

${connectedServers}`

	if (!enableMcpServerCreation) {
		return baseSection
	}

	return (
		baseSection +
		`
## Creating an MCP Server

The user may ask you something along the lines of "add a tool" that does some function, in other words to create an MCP server that provides tools and resources that may connect to external APIs for example. If they do, you should obtain detailed instructions on this topic using the fetch_instructions tool, like this:
<fetch_instructions>
<task>create_mcp_server</task>
</fetch_instructions>`
	)
}
