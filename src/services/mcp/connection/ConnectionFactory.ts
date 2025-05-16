import { ServerConfig, McpConnection } from "../types"
import { ConnectionHandler } from "./ConnectionHandler"
import { FileWatcher } from "./FileWatcher"
import { ConfigManager } from "../config"
import { ConfigSource, McpServer } from "../../../shared/mcp"

/**
 * Connection factory class
 * Responsible for creating and managing MCP connections
 */
export class ConnectionFactory {
	private handlers: ConnectionHandler[] = []
	private connections: McpConnection[] = []
	private fileWatcher: FileWatcher
	private provider: any
	private configHandler: ConfigManager
	private onStatusChange?: (server: McpServer) => void

	constructor(configHandler: ConfigManager, provider?: any, onStatusChange?: (server: McpServer) => void) {
		this.configHandler = configHandler
		this.fileWatcher = new FileWatcher()
		this.provider = provider
		this.onStatusChange = onStatusChange
	}

	/**
	 * Register a new connection handler
	 * @param handler Connection handler
	 */
	registerHandler(handler: ConnectionHandler): void {
		this.handlers.push(handler)
	}

	/**
	 * Get handler for a specific type
	 * @param type Connection type
	 * @returns Connection handler or undefined
	 */
	getHandlerForType(type: string): ConnectionHandler | undefined {
		return this.handlers.find((h) => h.supports(type))
	}

	/**
	 * Create connection
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
		const patchedConfig: ServerConfig = { ...config }
		if (!patchedConfig.type) {
			if (patchedConfig.command) {
				patchedConfig.type = "stdio"
			} else if (patchedConfig.url) {
				patchedConfig.type = "sse"
			}
		}

		// Find handler that supports the connection type
		const handler = this.getHandlerForType(patchedConfig.type)

		if (!handler) {
			throw new Error(`Unsupported connection type: ${patchedConfig.type}`)
		}

		// Prefer parameter callback, otherwise use the callback from factory constructor
		let statusChangeCb: ((server: McpServer) => void) | undefined

		if (onStatusChange) {
			// If parameter callback is provided, call both it and the factory callback if present
			statusChangeCb = (server: McpServer) => {
				onStatusChange(server)
				if (this.onStatusChange) {
					this.onStatusChange(server)
				}
			}
		} else if (this.onStatusChange) {
			// If only factory callback is present, use that
			statusChangeCb = (server: McpServer) => {
				this.onStatusChange!(server)
			}
		} else {
			// No callbacks provided
			statusChangeCb = undefined
		}

		// Use handler to create connection
		const connection = await handler.createConnection(name, patchedConfig, source, statusChangeCb)

		// Setup file watcher
		if (
			patchedConfig.watchPaths?.length ||
			(patchedConfig.type === "stdio" && patchedConfig.args?.some((arg) => arg.includes("build/index.js")))
		) {
			this.setupFileWatcher(connection, patchedConfig)
		}

		// Remove any existing object with the same name and source to avoid duplicates
		this.connections = this.connections.filter(
			(conn) => !(conn.server.name === name && conn.server.source === source),
		)
		this.connections.push(connection)
		return connection
	}

	/**
	 * Close connection
	 * @param name Server name
	 * @param source Optional config source
	 */
	async closeConnection(name: string, source?: ConfigSource, allowKeep?: boolean): Promise<void> {
		// Find and close connections
		const connections = source ? this.findConnections(name, source) : this.findConnections(name)

		for (const conn of connections) {
			// Clear file watcher
			this.fileWatcher.clearWatchers(name)

			// Find corresponding handler to close connection
			const handler = this.getHandlerForType(JSON.parse(conn.server.config).type || "stdio")
			if (handler) {
				await handler.closeConnection(conn)
			}
		}

		// Remove from array unless allowKeep is true
		if (!allowKeep) {
			this.connections = this.connections.filter((conn) => {
				if (conn.server.name !== name) return true
				if (source && conn.server.source !== source) return true
				return false
			})
		}
	}

	/**
	 * Get connection object by server
	 * @param server Server object
	 * @returns Connection object
	 */
	getConnectionByServer(server: McpServer): McpConnection {
		const connection = this.connections.find(
			(conn) => conn.server.name === server.name && conn.server.source === server.source,
		)

		if (!connection) {
			throw new Error(`No connection found for server: ${server.name}`)
		}

		return connection
	}

	/**
	 * Get server list
	 * @returns Active server list
	 */
	getActiveServers(): McpServer[] {
		return this.connections.filter((conn) => !conn.server.disabled).map((conn) => conn.server)
	}

	/**
	 * Get all servers
	 * @returns All server list
	 */
	getAllServers(): McpServer[] {
		return this.connections.map((conn) => conn.server)
	}

	/**
	 * Restart connection
	 * @param name Server name
	 * @param source Optional config source
	 */
	async restartConnection(name: string, source?: ConfigSource): Promise<void> {
		const connections = source ? this.findConnections(name, source) : this.findConnections(name)

		if (connections.length === 0) {
			throw new Error(`No connection found for server: ${name}`)
		}

		for (const conn of connections) {
			// Set status to connecting
			conn.server.status = "connecting"
			conn.server.error = ""

			// Notify status change if callback exists
			if (this.onStatusChange) {
				this.onStatusChange(conn.server)
			}

			const config = JSON.parse(conn.server.config)
			const connSource = conn.server.source || "global"

			// Close existing connection but do not remove the object, so notifyServersChanged can find "connecting"
			await this.closeConnection(name, connSource, true)

			// Create new connection
			await this.createConnection(name, config, connSource)
		}
	}

	/**
	 * Setup file watcher
	 * @param connection MCP connection
	 * @param config Server config
	 */
	private async setupFileWatcher(connection: McpConnection, config: ServerConfig): Promise<void> {
		const clonedConfig: ServerConfig = JSON.parse(JSON.stringify(config))
		try {
			const source = connection.server.source || "global"
			let configPath: string | null = null
			if (source === "project") {
				configPath = await this.configHandler.getProjectConfigPath()
			} else {
				configPath = await this.configHandler.getGlobalConfigPath(this.provider)
			}
			if (configPath && !clonedConfig.watchPaths?.includes(configPath)) {
				clonedConfig.watchPaths = clonedConfig.watchPaths || []
				clonedConfig.watchPaths.push(configPath)
			}
		} catch (error) {
			console.error("Failed to get config path:", error)
		}

		// Setup file watcher
		if (clonedConfig.watchPaths?.length) {
			this.fileWatcher.setupWatchers(connection.server.name, clonedConfig.watchPaths, async () => {
				await this.restartConnection(connection.server.name, connection.server.source)
			})
		}
	}

	/**
	 * Find connections by name and source
	 * @param name Server name
	 * @param source Optional config source
	 * @returns Connection list
	 */
	private findConnections(name: string, source?: ConfigSource): McpConnection[] {
		return this.connections.filter((conn) => {
			if (conn.server.name !== name) return false
			if (source && conn.server.source !== source) return false
			return true
		})
	}

	/**
	 * Dispose resources
	 */
	async dispose(): Promise<void> {
		// Close all connections
		for (const conn of this.connections) {
			await this.closeConnection(conn.server.name, conn.server.source)
		}

		// Clear file watchers
		this.fileWatcher.dispose()
	}
}
