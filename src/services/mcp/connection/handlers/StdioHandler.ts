import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
const packageJson = require("../../../../../package.json")
const version: string = packageJson.version ?? "1.0.0"
import {
	ListToolsResultSchema,
	ListResourcesResultSchema,
	ListResourceTemplatesResultSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { ConnectionHandler } from "../ConnectionHandler"
import {
	ServerConfig,
	McpConnection,
	ConfigSource,
	McpTool,
	McpResource,
	McpResourceTemplate,
	McpServer,
} from "../../types"

/**
 * Stdio connection handler
 * Responsible for creating and managing MCP connections based on stdio
 */
export class StdioHandler implements ConnectionHandler {
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
		const client = new Client(
			{
				name: "Roo Code",
				version,
			},
			{
				capabilities: {},
			},
		)

		// Create transport
		const transport = new StdioClientTransport({
			command: config.command,
			args: config.args,
			env: {
				...config.env,
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
			connection.server.error = error instanceof Error ? error.message : `${error}`
			if (onStatusChange) onStatusChange(connection.server)
		}

		return connection
	}

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
	 * Setup error handling
	 * @param connection MCP connection
	 * @param transport Stdio transport
	 * @param onStatusChange
	 */
	private setupErrorHandling(
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

	/**
	 * Fetch tool list
	 * @param connection MCP connection
	 * @returns Tool list
	 */
	private async fetchToolsList(connection: McpConnection): Promise<McpTool[]> {
		try {
			const result = await connection.client.listTools()
			const parsed = ListToolsResultSchema.parse(result)

			return parsed.tools.map((tool: any) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.input_schema as object | undefined,
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
	private async fetchResourcesList(connection: McpConnection): Promise<McpResource[]> {
		try {
			const result = await connection.client.listResources()
			const parsed = ListResourcesResultSchema.parse(result)

			return parsed.resources.map((resource: any) => ({
				uri: resource.uri,
				name: resource.name,
				mimeType: resource.mime_type as string | undefined,
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
	private async fetchResourceTemplatesList(connection: McpConnection): Promise<McpResourceTemplate[]> {
		try {
			const result = await connection.client.listResourceTemplates()
			const parsed = ListResourceTemplatesResultSchema.parse(result)

			return (parsed as any).templates.map((template: any) => ({
				uri: template.uri,
				name: template.name,
				description: template.description,
				inputSchema: template.input_schema as object | undefined,
			}))
		} catch (error) {
			// console.error(`Failed to fetch resource templates list for ${connection.server.name}:`, error)
			return []
		}
	}
}
