import { DiffStrategy } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"

/**
 * Format tool information for MCP server documentation
 * @param tool - Tool definition from MCP server
 * @returns Formatted tool description with schema
 */
function formatToolInfo(tool: any): string {
	const schemaStr = tool.inputSchema
		? `    Input Schema:\n    ${JSON.stringify(tool.inputSchema, null, 2).split("\n").join("\n    ")}`
		: ""

	return `- ${tool.name}: ${tool.description}\n${schemaStr}`
}

/**
 * Generate MCP server section for the system prompt
 * @param mcpHub - MCP Hub instance with server information
 * @param diffStrategy - Diff strategy for file modifications
 * @param enableMcpServerCreation - Whether to include server creation instructions
 * @returns Formatted MCP servers section
 */
export async function getMcpServersSection(
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	enableMcpServerCreation?: boolean,
): Promise<string> {
	if (!mcpHub) {
		return ""
	}

	// Get connected servers info
	const connectedServers =
		mcpHub.getServers().length > 0
			? `${mcpHub
					.getServers()
					.filter((server) => server.status === "connected")
					.map((server) => {
						const tools = server.tools?.map(formatToolInfo).join("\n\n")

						const templates = server.resourceTemplates
							?.map((template) => `- ${template.uriTemplate} (${template.name}): ${template.description}`)
							.join("\n")

						const resources = server.resources
							?.map((resource) => `- ${resource.uri} (${resource.name}): ${resource.description}`)
							.join("\n")

						const config = JSON.parse(server.config)
						const commandString = `${config.command}${config.args && Array.isArray(config.args) ? ` ${config.args.join(" ")}` : ""}`

						return (
							`## ${server.name} (\`${commandString}\`)` +
							(tools ? `\n\n### Available Tools\n${tools}` : "") +
							(templates ? `\n\n### Resource Templates\n${templates}` : "") +
							(resources ? `\n\n### Direct Resources\n${resources}` : "")
						)
					})
					.join("\n\n")}`
			: "(No MCP servers currently connected)"

	const baseSection = `MCP SERVERS

The Model Context Protocol (MCP) enables communication with servers that provide additional tools and resources. Types:

1. Local (Stdio-based): Run on user's machine via standard input/output
2. Remote (SSE-based): Run on remote machines via HTTP/HTTPS

# Connected MCP Servers

Access server tools with \`use_mcp_tool\` and resources with \`access_mcp_resource\`.

${connectedServers}`

	if (!enableMcpServerCreation) {
		return baseSection
	}

	return (
		baseSection +
		`

## Creating an MCP Server

If asked to "add a tool" for specific functionality, get detailed instructions using:
<fetch_instructions>
<task>create_mcp_server</task>
</fetch_instructions>`
	)
}
