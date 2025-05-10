import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import {
	ListToolsResultSchema,
	ListResourcesResultSchema,
	ListResourceTemplatesResultSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { ConnectionHandler } from "../../ConnectionHandler"
import { ServerConfig, McpConnection } from "../../../types"
import { ConfigSource, McpResource, McpResourceTemplate, McpServer, McpTool } from "../../../../../shared/mcp"

const packageJson = require("../../../../../../package.json")
const version: string = packageJson.version ?? "1.0.0"

/**
 * Base connection handler
 * Provides common functionality for MCP connection handlers
 */
export abstract class BaseHandler implements ConnectionHandler {
	/**
	 * Check if a specific connection type is supported
	 * @param type Connection type
	 * @returns Whether the type is supported
	 */
	abstract supports(type: string): boolean

	/**
	 * Create connection
	 * @param name Server name
	 * @param config Server config
	 * @param source Config source
	 * @param onStatusChange
	 * @returns Created MCP connection
	 */
	abstract createConnection(
		name: string,
		config: ServerConfig,
		source: ConfigSource,
		onStatusChange?: (server: McpServer) => void,
	): Promise<McpConnection>

	/**
	 * Close connection
	 * @param connection Connection to close
	 */
	async closeConnection(connection: McpConnection): Promise<void> {
		try {
			await connection.client.close()
		} catch (error) {
			console.error(`Error disconnecting client for ${connection.server.name}:`, error)
		}

		try {
			await connection.transport.close()
		} catch (error) {
			console.error(`Error closing transport for ${connection.server.name}:`, error)
		}
	}

	/**
	 * Create client instance
	 * @returns New MCP client
	 */
	protected createClient(): Client {
		return new Client(
			{
				name: "Roo Code",
				version,
			},
			{
				capabilities: {},
			},
		)
	}

	/**
	 * Append error message to connection
	 * @param connection MCP connection
	 * @param error Error message
	 * @param level Error level
	 */
	protected appendErrorMessage(connection: McpConnection, error: string, level: "error" | "warn" | "info" = "error") {
		const MAX_ERROR_LENGTH = 1000
		const truncatedError =
			error.length > MAX_ERROR_LENGTH
				? `${error.substring(0, MAX_ERROR_LENGTH)}...(error message truncated)`
				: error

		// Add to error history
		if (!connection.server.errorHistory) {
			connection.server.errorHistory = []
		}

		connection.server.errorHistory.push({
			message: truncatedError,
			timestamp: Date.now(),
			level,
		})

		// Keep only the last 100 errors
		if (connection.server.errorHistory.length > 100) {
			connection.server.errorHistory = connection.server.errorHistory.slice(-100)
		}

		// Update current error display
		connection.server.error = truncatedError
	}

	/**
	 * Fetch tool list
	 * @param connection MCP connection
	 * @returns Tool list
	 */
	protected async fetchToolsList(connection: McpConnection): Promise<McpTool[]> {
		try {
			const result = await connection.client.listTools()
			const parsed = ListToolsResultSchema.parse(result)

			return parsed.tools.map((tool: any) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema as object | undefined,
				alwaysAllow: false,
			}))
		} catch (error) {
			// console.error(`Failed to fetch tools list for ${connection.server.name}:`, error)
			return []
		}
	}

	/**
	 * Fetch resource list
	 * @param connection MCP connection
	 * @returns Resource list
	 */
	protected async fetchResourcesList(connection: McpConnection): Promise<McpResource[]> {
		try {
			const result = await connection.client.listResources()
			const parsed = ListResourcesResultSchema.parse(result)

			return parsed.resources.map((resource: any) => ({
				uri: resource.uri,
				name: resource.name,
				mimeType: resource.mimeType as string | undefined,
				description: resource.description,
			}))
		} catch (error) {
			// console.error(`Failed to fetch resources list for ${connection.server.name}:`, error)
			return []
		}
	}

	/**
	 * Fetch resource template list
	 * @param connection MCP connection
	 * @returns Resource template list
	 */
	protected async fetchResourceTemplatesList(connection: McpConnection): Promise<McpResourceTemplate[]> {
		try {
			const result = await connection.client.listResourceTemplates()
			const parsed = ListResourceTemplatesResultSchema.parse(result)

			return parsed.resourceTemplates.map((template: any) => ({
				uriTemplate: template.uriTemplate,
				name: template.name,
				description: template.description,
				mimeType: template.mimeType as string | undefined,
			}))
		} catch (error) {
			// console.error(`Failed to fetch resource templates list for ${connection.server.name}:`, error)
			return []
		}
	}
}
