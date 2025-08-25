import { DiffStrategy } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"
import { GroupEntry, ModeConfig } from "@roo-code/types"
import { getGroupName } from "../../../shared/modes"
import { McpServer } from "../../../shared/mcp"

let lastMcpHub: McpHub | undefined
let lastMcpIncludedList: string[] | undefined
let lastFilteredServers: McpServer[] = []

function memoizeFilteredServers(mcpHub: McpHub, mcpIncludedList?: string[]): McpServer[] {
	const mcpHubChanged = mcpHub !== lastMcpHub
	const listChanged = !areArraysEqual(mcpIncludedList, lastMcpIncludedList)

	if (!mcpHubChanged && !listChanged) {
		return lastFilteredServers
	}

	lastMcpHub = mcpHub
	lastMcpIncludedList = mcpIncludedList

	lastFilteredServers = (
		mcpIncludedList && mcpIncludedList.length > 0 ? mcpHub.getAllServers() : mcpHub.getServers()
	).filter((server) => {
		if (mcpIncludedList && mcpIncludedList.length > 0) {
			return mcpIncludedList.includes(server.name) && server.status === "connected"
		}
		return server.status === "connected"
	})

	return lastFilteredServers
}
function areArraysEqual(arr1?: string[], arr2?: string[]): boolean {
	if (!arr1 && !arr2) return true
	if (!arr1 || !arr2) return false
	if (arr1.length !== arr2.length) return false

	return arr1.every((item, index) => item === arr2[index])
}

export async function getMcpServersSection(
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	enableMcpServerCreation?: boolean,
	currentMode?: ModeConfig,
): Promise<string> {
	if (!mcpHub) {
		return ""
	}

	// Get MCP configuration for current mode
	let mcpIncludedList: string[] | undefined

	if (currentMode) {
		// Find MCP group configuration - object format: { mcp: { included: [...] } }
		const mcpGroup = currentMode.groups.find((group: GroupEntry) => {
			if (typeof group === "object" && !Array.isArray(group) && "mcp" in group) {
				return true
			}
			return getGroupName(group) === "mcp"
		})

		// Extract mcpIncludedList from the MCP configuration
		if (mcpGroup && typeof mcpGroup === "object" && !Array.isArray(mcpGroup) && "mcp" in mcpGroup) {
			const mcpOptions = mcpGroup as { mcp?: { included?: unknown[] } }
			mcpIncludedList = Array.isArray(mcpOptions.mcp?.included)
				? mcpOptions.mcp.included.filter((item: unknown): item is string => typeof item === "string")
				: undefined
		}
	}

	const filteredServers = memoizeFilteredServers(mcpHub, mcpIncludedList)

	let connectedServers: string

	if (filteredServers.length > 0) {
		connectedServers = `${filteredServers
			.map((server) => {
				const tools = server.tools
					?.filter((tool) => tool.enabledForPrompt !== false)
					?.map((tool) => {
						const schemaStr = tool.inputSchema
							? `    Input Schema:
	${JSON.stringify(tool.inputSchema, null, 2).split("\n").join("\n    ")}`
							: ""

						return `- ${tool.name}: ${tool.description}\n${schemaStr}`
					})
					.join("\n\n")

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
	} else if (mcpIncludedList && mcpIncludedList.length > 0) {
		const allServers = mcpHub.getAllServers()
		const disconnectedServers = mcpIncludedList
			.map((name) => {
				const server = allServers.find((s) => s.name === name)
				if (server && server.status !== "connected") {
					return `- ${server.name} (${server.status})`
				}
				if (!server) {
					return `- ${name} (not found)`
				}
				return null
			})
			.filter(Boolean)
			.join("\n")
		connectedServers = `(Configured MCP servers are not currently connected)${
			disconnectedServers ? `\n\nConfigured but disconnected servers:\n${disconnectedServers}` : ""
		}`
	} else {
		connectedServers = "(No MCP servers currently connected)"
	}

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
