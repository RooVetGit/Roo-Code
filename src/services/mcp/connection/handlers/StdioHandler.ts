import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { ServerConfig, McpConnection } from "../../types"
import { injectEnv } from "../../../../utils/config"
import { ConfigSource, McpServer } from "../../../../shared/mcp"
import { BaseHandler } from "./base/BaseHandler"

/**
 * Stdio connection handler
 * Responsible for creating and managing MCP connections based on stdio
 */
export class StdioHandler extends BaseHandler {
	/**
	 * Check if a specific connection type is supported
	 * @param type Connection type
	 * @returns Whether the type is supported
	 */
	supports(type: string): boolean {
		return type === "stdio"
	}

	/**
	 * Create stdio connection
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
		if (!config.command) {
			throw new Error(`Server "${name}" of type "stdio" must have a "command" property`)
		}

		// Create client
		const client = this.createClient()

		// Create transport
		const transport = new StdioClientTransport({
			command: config.command,
			args: config.args,
			env: {
				...(config.env ? await injectEnv(config.env) : {}),
				...(process.env.PATH ? { PATH: process.env.PATH } : {}),
			},
			stderr: "pipe",
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

		// transport.stderr is only available after the process has been started. However we can't start it separately from the .connect() call because it also starts the transport. And we can't place this after the connect call since we need to capture the stderr stream before the connection is established, in order to capture errors during the connection process.
		// As a workaround, we start the transport ourselves, and then monkey-patch the start method to no-op so that .connect() doesn't try to start it again.
		await transport.start()
		const stderrStream = transport.stderr
		if (stderrStream) {
			stderrStream.on("data", (data: Buffer) => {
				const output = data.toString()
				// Handle log or error output as needed
				if (/INFO/i.test(output)) {
					console.log(`Server "${name}" info:`, output)
				} else {
					console.error(`Server "${name}" stderr:`, output)
				}
			})
		} else {
			console.error(`No stderr stream for ${name}`)
		}
		// Prevent connect from starting the transport again
		transport.start = async () => {}

		// Setup error handling
		this.setupErrorHandling(connection, transport, onStatusChange)
		if (onStatusChange) onStatusChange(connection.server)

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
	 * @param transport Stdio transport
	 * @param onStatusChange
	 */
	protected setupErrorHandling(
		connection: McpConnection,
		transport: StdioClientTransport,
		onStatusChange?: (server: McpServer) => void,
	): void {
		// Handle stderr output
		const stderrStream = transport.stderr
		if (stderrStream) {
			stderrStream.on("data", (data: Buffer) => {
				const output = data.toString()
				console.log(`[${connection.server.name}] stderr:`, output)
			})
		}

		// Handle errors
		transport.onerror = (error: Error) => {
			console.error(`[${connection.server.name}] transport error:`, error)
			connection.server.status = "disconnected"
			connection.server.error = error.message
			if (onStatusChange) onStatusChange(connection.server)
		}

		// Handle close
		transport.onclose = (code?: number) => {
			console.log(`[${connection.server.name}] transport closed with code ${code}`)
			connection.server.status = "disconnected"
			if (code !== undefined && code !== 0) {
				connection.server.error = `Process exited with code ${code}`
			}
			if (onStatusChange) onStatusChange(connection.server)
		}
	}
}
