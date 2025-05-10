import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { ServerConfig, McpConnection } from "../../types"
import { ConfigSource, McpServer } from "../../../../shared/mcp"
import { BaseHandler } from "./base/BaseHandler"

/**
 * SSE connection handler
 * Responsible for creating and managing MCP connections based on Server-Sent Events
 */
export class SseHandler extends BaseHandler {
	/**
	 * Check if a specific connection type is supported
	 * @param type Connection type
	 * @returns Whether the type is supported
	 */
	supports(type: string): boolean {
		return type === "sse"
	}

	/**
	 * Create SSE connection
	 * @param name Server name
	 * @param config Server config
	 * @param source Config source
	 * @param onStatusChange
	 * @returns Created MCP connection
	 */
	async createConnection(
		name: string,
		config: ServerConfig,
		source: ConfigSource,
		onStatusChange?: (server: McpServer) => void,
	): Promise<McpConnection> {
		if (!config.url) {
			throw new Error(`Server "${name}" of type "sse" must have a "url" property`)
		}

		// Create client
		const client = this.createClient()

		// Create transport
		const transport = new SSEClientTransport(new URL(config.url), {
			requestInit: {
				headers: config.headers || {},
			},
			eventSourceInit: {
				withCredentials: config.headers?.["Authorization"] ? true : false,
			},
		})

		// Create connection object
		const connection: McpConnection = {
			server: {
				name,
				config: JSON.stringify(config),
				status: "connecting",
				disabled: config.disabled,
				source,
				errorHistory: [],
			},
			client,
			transport,
		}

		// Setup error handling
		this.setupErrorHandling(connection, transport, onStatusChange)
		if (onStatusChange) onStatusChange(connection.server)

		// Connect
		try {
			await client.connect(transport)
			connection.server.status = "connected"
			if (onStatusChange) onStatusChange(connection.server)

			// Fetch tool and resource lists
			connection.server.tools = await this.fetchToolsList(connection)
			connection.server.resources = await this.fetchResourcesList(connection)
			connection.server.resourceTemplates = await this.fetchResourceTemplatesList(connection)
		} catch (error) {
			connection.server.status = "disconnected"
			this.appendErrorMessage(connection, error instanceof Error ? error.message : `${error}`)
			if (onStatusChange) onStatusChange(connection.server)
		}

		return connection
	}

	/**
	 * Setup error handling
	 * @param connection MCP connection
	 * @param transport SSE transport
	 * @param onStatusChange
	 */
	protected setupErrorHandling(
		connection: McpConnection,
		transport: SSEClientTransport,
		onStatusChange?: (server: McpServer) => void,
	): void {
		// Handle errors
		transport.onerror = (error: Error) => {
			console.error(`[${connection.server.name}] transport error:`, error)
			connection.server.status = "disconnected"
			connection.server.error = error.message
			if (onStatusChange) onStatusChange(connection.server)
		}

		// Handle close
		transport.onclose = () => {
			console.log(`[${connection.server.name}] transport closed`)
			connection.server.status = "disconnected"
			if (onStatusChange) onStatusChange(connection.server)
		}
	}
}
