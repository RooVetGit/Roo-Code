import { ServerConfig, McpConnection } from "../types"
import { ConfigSource, McpServer } from "../../../shared/mcp"

/**
 * Connection handler interface
 * Defines common methods for creating and managing MCP connections
 */
export interface ConnectionHandler {
	/**
	 * Check if a specific connection type is supported
	 * @param type Connection type
	 * @returns Whether the type is supported
	 */
	supports(type: string): boolean

	/**
	 * Create connection
	 * @param name Server name
	 * @param config Server config
	 * @param source Config source
	 * @param onStatusChange
	 * @returns Created MCP connection
	 */
	createConnection(
		name: string,
		config: ServerConfig,
		source: ConfigSource,
		onStatusChange?: (server: McpServer) => void,
	): Promise<McpConnection>

	/**
	 * Close connection
	 * @param connection Connection to close
	 */
	closeConnection(connection: McpConnection): Promise<void>
}
