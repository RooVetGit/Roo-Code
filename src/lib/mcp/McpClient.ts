import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
    CallToolResultSchema,
    ListResourcesResultSchema,
    ListResourceTemplatesResultSchema,
    ListToolsResultSchema,
    ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

interface McpServer {
    command: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
    disabled?: boolean;
    alwaysAllow?: string[];
    restartId?: string;
}

interface McpSettings {
    mcpServers: Record<string, McpServer>;
}

interface McpServerState {
    name: string;
    config: string;
    status: 'connecting' | 'connected' | 'disconnected';
    disabled: boolean;
    error?: string;
    tools?: any[];
    resources?: any[];
    resourceTemplates?: any[];
}

interface McpConnection {
    server: McpServerState;
    client: Client;
    transport: StdioClientTransport;
}

export class McpClient {
    private settingsPath: string;
    private connections: McpConnection[] = [];
    private initialized: boolean = false;

    constructor() {
        this.settingsPath = path.join(os.homedir(), '.cline', 'cline_mcp_settings.json');
    }

    async readSettings(): Promise<McpSettings> {
        try {
            await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
            const content = await fs.readFile(this.settingsPath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return { mcpServers: {} };
        }
    }

    private async connectToServer(name: string, config: McpServer): Promise<void> {
        // Remove existing connection if it exists
        this.connections = this.connections.filter((conn) => conn.server.name !== name);

        try {
            const client = new Client(
                {
                    name: "Cline",
                    version: "1.0.0",
                },
                {
                    capabilities: {},
                }
            );

            const transport = new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: {
                    ...config.env,
                    ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
                },
                stderr: "pipe",
            });

            const connection: McpConnection = {
                server: {
                    name,
                    config: JSON.stringify(config),
                    status: "connecting",
                    disabled: config.disabled === true,
                },
                client,
                transport,
            };
            this.connections.push(connection);

            // Set up stderr handling before connecting
            const stderrStream = transport.stderr;
            if (stderrStream) {
                stderrStream.on("data", (data: Buffer) => {
                    const errorOutput = data.toString();
                    if (connection.server.error) {
                        connection.server.error += '\n' + errorOutput;
                    } else {
                        connection.server.error = errorOutput;
                    }
                });
            }

            // Connect to the server - this will start the transport
            await client.connect(transport);
            connection.server.status = "connected";
            connection.server.error = "";

            // Initial fetch of tools and resources
            connection.server.tools = await this.fetchToolsList(name);
            connection.server.resources = await this.fetchResourcesList(name);
            connection.server.resourceTemplates = await this.fetchResourceTemplatesList(name);
        } catch (error) {
            const connection = this.connections.find((conn) => conn.server.name === name);
            if (connection) {
                connection.server.status = "disconnected";
                connection.server.error = error instanceof Error ? error.message : String(error);
            }
            throw error;
        }
    }

    private async fetchToolsList(serverName: string): Promise<any[]> {
        try {
            const response = await this.connections
                .find((conn) => conn.server.name === serverName)
                ?.client.request({ method: "tools/list" }, ListToolsResultSchema);

            const settings = await this.readSettings();
            const alwaysAllowConfig = settings.mcpServers[serverName]?.alwaysAllow || [];

            const tools = (response?.tools || []).map(tool => ({
                ...tool,
                alwaysAllow: alwaysAllowConfig.includes(tool.name)
            }));

            return tools;
        } catch (error) {
            return [];
        }
    }

    private async fetchResourcesList(serverName: string): Promise<any[]> {
        try {
            const response = await this.connections
                .find((conn) => conn.server.name === serverName)
                ?.client.request({ method: "resources/list" }, ListResourcesResultSchema);
            return response?.resources || [];
        } catch (error) {
            return [];
        }
    }

    private async fetchResourceTemplatesList(serverName: string): Promise<any[]> {
        try {
            const response = await this.connections
                .find((conn) => conn.server.name === serverName)
                ?.client.request({ method: "resources/templates/list" }, ListResourceTemplatesResultSchema);
            return response?.resourceTemplates || [];
        } catch (error) {
            return [];
        }
    }

    async initializeServers(): Promise<void> {
        if (this.initialized) {
            return;
        }

        const settings = await this.readSettings();
        for (const [name, config] of Object.entries(settings.mcpServers)) {
            if (config.disabled !== true) {
                try {
                    await this.connectToServer(name, config);
                } catch (error) {
                    console.error(`Failed to connect to MCP server ${name}:`, error);
                }
            }
        }
        this.initialized = true;
    }

    async callTool(serverName: string, toolName: string, args: Record<string, unknown>) {
        if (!this.initialized) {
            throw new Error('MCP servers have not been initialized. Call initializeServers() first.');
        }

        // First check if we have any connections
        if (this.connections.length === 0) {
            throw new Error('No MCP servers are connected. Make sure servers are properly configured and enabled.');
        }

        // List available servers for better error messages
        const availableServers = this.connections
            .filter(conn => !conn.server.disabled)
            .map(conn => conn.server.name);

        if (!serverName) {
            throw new Error(`Server name is required. Available servers: ${availableServers.join(', ') || 'None'}`);
        }

        const connection = this.connections.find((conn) => conn.server.name === serverName);
        if (!connection) {
            throw new Error(`Server "${serverName}" not found. Available servers: ${availableServers.join(', ') || 'None'}`);
        }

        if (connection.server.disabled) {
            throw new Error(`Server "${serverName}" is disabled`);
        }

        if (connection.server.status !== 'connected') {
            throw new Error(`Server "${serverName}" is not connected (status: ${connection.server.status})`);
        }

        // List available tools for better error messages
        const availableTools = connection.server.tools?.map(t => t.name) || [];
        if (!toolName) {
            throw new Error(`Tool name is required. Available tools for ${serverName}: ${availableTools.join(', ') || 'None'}`);
        }

        if (availableTools.length > 0 && !availableTools.includes(toolName)) {
            throw new Error(`Tool "${toolName}" not found in server "${serverName}". Available tools: ${availableTools.join(', ')}`);
        }

        return await connection.client.request(
            {
                method: "tools/call",
                params: {
                    name: toolName,
                    arguments: args,
                },
            },
            CallToolResultSchema
        );
    }

    async readResource(serverName: string, uri: string) {
        if (!this.initialized) {
            throw new Error('MCP servers have not been initialized. Call initializeServers() first.');
        }

        const connection = this.connections.find((conn) => conn.server.name === serverName);
        if (!connection) {
            throw new Error(`No connection found for server: ${serverName}`);
        }
        if (connection.server.disabled) {
            throw new Error(`Server "${serverName}" is disabled`);
        }

        return await connection.client.request(
            {
                method: "resources/read",
                params: {
                    uri,
                },
            },
            ReadResourceResultSchema
        );
    }

    getAvailableServers(): string[] {
        return this.connections
            .filter(conn => !conn.server.disabled && conn.server.status === 'connected')
            .map(conn => conn.server.name);
    }

    async getServerTools(): Promise<string[]> {
        if (!this.initialized) {
            throw new Error('MCP servers have not been initialized. Call initializeServers() first.');
        }

        const tools: string[] = [];
        for (const connection of this.connections) {
            if (!connection.server.disabled && connection.server.status === 'connected') {
                const serverTools = await this.fetchToolsList(connection.server.name);
                if (serverTools.length > 0) {
                    tools.push(`\n## ${connection.server.name} (${connection.server.config})\n`);
                    tools.push(`### Available Tools`);
                    for (const tool of serverTools) {
                        tools.push(`- ${tool.name}: ${tool.description}`);
                        tools.push(`    Input Schema:`);
                        tools.push(`    ${JSON.stringify(tool.inputSchema, null, 2)}`);
                        tools.push(``);
                    }
                }
            }
        }
        return tools;
    }
}