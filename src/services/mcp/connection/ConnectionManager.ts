import * as vscode from "vscode"
import { t } from "../../../i18n"
import { ConfigManager } from "../config"
import { ServerConfig, McpConnection } from "../types"
import { ConnectionFactory } from "./ConnectionFactory"
import deepEqual from "fast-deep-equal"
import { ConfigSource, McpServer } from "../../../shared/mcp"

/**
 * Connection manager class
 * Responsible for managing the lifecycle of MCP connections and configuration synchronization
 */
export class ConnectionManager {
	private configHandler: ConfigManager
	private factory: ConnectionFactory
	private isConnecting: boolean = false

	constructor(configHandler: ConfigManager, factory: ConnectionFactory) {
		this.configHandler = configHandler
		this.factory = factory
	}

	/**
	 * Get connection object
	 * @param serverName Server name
	 * @param source Optional config source
	 * @returns Connection object
	 */
	async getConnection(serverName: string, source?: ConfigSource): Promise<McpConnection> {
		// Find connection
		const connections = this.factory
			.getAllServers()
			.filter((s) => s.name === serverName && (!source || s.source === source))

		if (connections.length === 0) {
			throw new Error(`No connection found for server: ${serverName}`)
		}

		// Use the first matched connection
		const server = connections[0]

		// Get connection object
		return this.factory.getConnectionByServer(server)
	}

	/**
	 * Get active server list
	 * @returns Active server list
	 */
	getActiveServers(): McpServer[] {
		return this.factory.getActiveServers()
	}

	/**
	 * Get all servers
	 * @returns All server list
	 */
	getAllServers(): McpServer[] {
		return this.factory.getAllServers()
	}

	/**
	 * Initialize connections
	 * @param provider ClineProvider instance
	 */
	async initializeConnections(provider: vscode.Disposable): Promise<void> {
		this.isConnecting = true

		try {
			// Initialize global connections
			const globalConfigPath = await this.configHandler.getGlobalConfigPath(provider as any)
			const globalConfigs = await this.configHandler.readConfig(globalConfigPath)
			await this.updateServerConnections(globalConfigs, "global")

			// Initialize project connections
			const projectConfigPath = await this.configHandler.getProjectConfigPath()
			if (projectConfigPath) {
				const projectConfigs = await this.configHandler.readConfig(projectConfigPath)
				await this.updateServerConnections(projectConfigs, "project")
			}
		} catch (error) {
			console.error("Failed to initialize connections:", error)
		} finally {
			this.isConnecting = false
		}
	}

	/**
	 * Update server connections
	 * @param configs Server configs
	 * @param source Config source
	 */
	async updateServerConnections(configs: Record<string, ServerConfig>, source: ConfigSource): Promise<void> {
		// Get the names of currently connected servers
		const currentServers = this.factory
			.getAllServers()
			.filter((server) => server.source === source)
			.map((server) => server.name)

		// Get the server names from the config
		const configServers = Object.keys(configs)

		// Close connections for deleted servers
		for (const serverName of currentServers) {
			if (!configServers.includes(serverName)) {
				await this.factory.closeConnection(serverName, source)
			}
		}

		// Update or create server connections
		for (const serverName of configServers) {
			try {
				const config = configs[serverName]

				// Validate config
				const validatedConfig = this.configHandler.validateServerConfig(config, serverName)

				// Find existing connection
				const existingServer = this.factory
					.getAllServers()
					.find((server) => server.name === serverName && server.source === source)

				if (existingServer) {
					// Configuration changed, reconnect
					const currentConfig = JSON.parse(existingServer.config)

					const stripNonConnectionFields = (configObj: any) => {
						// Exclude alwaysAllow and timeout, timeout changes do not trigger reconnection
						const { alwaysAllow: _alwaysAllow, timeout: _timeout, disabled: _disabled, ...rest } = configObj
						return rest
					}

					const strippedCurrent = stripNonConnectionFields(currentConfig)
					const strippedValidated = stripNonConnectionFields(validatedConfig)

					// Use deep comparison from fast-deep-equal instead of JSON.stringify
					if (!deepEqual(strippedCurrent, strippedValidated)) {
						await this.factory.closeConnection(serverName, source)
						await this.factory.createConnection(serverName, validatedConfig, source)
					} else {
						// No connection parameter change, but dynamic parameters like timeout may change, need to sync config field
						// Ensure callTool always reads the latest config
						for (const server of this.factory.getAllServers()) {
							if (server.name === serverName && server.source === source) {
								const conn = this.factory.getConnectionByServer(server)
								conn.server.config = JSON.stringify(validatedConfig)
							}
						}
					}
				} else {
					// Create new connection
					await this.factory.createConnection(serverName, validatedConfig, source)
				}
			} catch (error) {
				console.error(`Failed to update connection for ${serverName}:`, error)
				vscode.window.showErrorMessage(
					t("common:errors.failed_connect_server", { serverName, error: `${error}` }),
				)
			}
		}
	}

	/**
	 * Restart connection
	 * @param serverName Server name
	 * @param source Optional config source
	 */
	async restartConnection(serverName: string, source?: ConfigSource): Promise<void> {
		try {
			vscode.window.showInformationMessage(t("common:info.mcp_server_restarting", { serverName }))
			await this.factory.restartConnection(serverName, source)
			vscode.window.showInformationMessage(t("common:info.mcp_server_connected", { serverName }))
		} catch (error) {
			console.error(`Failed to restart connection for ${serverName}:`, error)
			vscode.window.showErrorMessage(t("common:errors.failed_restart_server", { serverName, error: `${error}` }))
		}
	}

	/**
	 * Dispose resources
	 */
	async dispose(): Promise<void> {
		await this.factory.dispose()
	}

	/**
	 * Get connection status
	 */
	get connecting(): boolean {
		return this.isConnecting
	}
}
