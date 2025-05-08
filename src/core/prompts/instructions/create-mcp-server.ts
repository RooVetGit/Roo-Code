import { McpHub } from "../../../services/mcp/McpHub"
import { DiffStrategy } from "../../../shared/tools"

/**
 * Generate comprehensive instructions for creating MCP servers
 * @param mcpHub - MCP Hub instance to retrieve server paths and settings
 * @param diffStrategy - Diff strategy for file modifications
 * @returns Formatted MCP server creation instructions
 * @throws Error if required dependencies are missing
 */
export async function createMCPServerInstructions(
	mcpHub: McpHub | undefined,
	diffStrategy: DiffStrategy | undefined,
): Promise<string> {
	if (!diffStrategy || !mcpHub) throw new Error("Missing MCP Hub or Diff Strategy")

	// Pre-calculate paths and values to avoid await in template literals
	const mcpServersPath = await mcpHub.getMcpServersPath()
	const mcpSettingsFilePath = await mcpHub.getMcpSettingsFilePath()
	const connectedServers =
		mcpHub
			.getServers()
			.map((server) => server.name)
			.join(", ") || "(None running currently)"
	const diffOption = diffStrategy ? " or `apply_diff`" : ""

	// Configuration examples
	const localServerConfig = `{
  "mcpServers": {
    "local-weather": {
      "command": "node",
      "args": ["/path/to/weather-server/build/index.js"],
      "env": {
        "OPENWEATHER_API_KEY": "your-api-key"
      }
    }
  }
}`

	const remoteServerConfig = `{
  "mcpServers": {
    "remote-weather": {
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}`

	// Project structure
	const projectStructure = `weather-server/
  ├── package.json        # Uses ES modules (type: "module")
  ├── tsconfig.json
  └── src/
      └── index.ts        # Main server implementation`

	// Bootstrap commands
	const bootstrapCommands = `cd ${mcpServersPath}
npx @modelcontextprotocol/create-server weather-server
cd weather-server
npm install axios`

	// Server implementation (abbreviated for readability)
	const serverImplementation = `#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// API key from environment variables
const API_KEY = process.env.OPENWEATHER_API_KEY;
if (!API_KEY) {
  throw new Error('OPENWEATHER_API_KEY environment variable is required');
}

// Server implementation with tool and resource handlers
class WeatherServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    // Server configuration and initialization
    // API client setup
    // Handler registration
  }

  // Resource and tool handler implementations
  
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Weather MCP server running on stdio');
  }
}

const server = new WeatherServer();
server.run().catch(console.error);`

	// MCP settings configuration
	const mcpSettingsConfig = `{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["${mcpServersPath}/weather-server/build/index.js"],
      "env": {
        "OPENWEATHER_API_KEY": "user-provided-api-key"
      }
    }
  }
}`

	// Main instructions
	return `# CREATING MCP SERVERS

MCP servers expose custom tools and resources that you can access with \`use_mcp_tool\` and \`access_mcp_resource\`.

## Important Considerations

MCP servers operate in a **non-interactive environment** with these limitations:
- Cannot initiate OAuth flows or open browser windows
- Cannot prompt for user input during runtime
- All credentials must be provided upfront via environment variables

> **Authentication Note:** For services requiring OAuth (like Spotify), create a separate one-time setup script that handles the authentication flow and captures the refresh token.

## Default Server Location

Unless specified otherwise, create local MCP servers in:
\`${mcpServersPath}\`

## Configuration Types

### 1. Local (Stdio) Server

Local servers run on the user's machine with stdio communication:

\`\`\`
${localServerConfig}
\`\`\`

### 2. Remote (SSE) Server

Remote servers communicate over HTTP/HTTPS:

\`\`\`
${remoteServerConfig}
\`\`\`

### Common Configuration Options

- \`disabled\`: (boolean) Temporarily disable the server
- \`timeout\`: (number) Maximum seconds to wait for responses (default: 60)
- \`alwaysAllow\`: (string[]) Tool names that don't require confirmation

## Example Implementation: Weather Server

This example demonstrates a local MCP server that provides weather data using the OpenWeather API.

> **Note:** In practice, prefer using tools over resources/templates as they're more flexible with dynamic parameters.

### Step 1: Bootstrap the Project

Create a new MCP server project:

\`\`\`
${bootstrapCommands}
\`\`\`

This creates:
\`\`\`
${projectStructure}
\`\`\`

### Step 2: Create the Server Implementation

Implement the weather server in src/index.ts:

\`\`\`
${serverImplementation}
\`\`\`

### Step 3: Build and Install

1. **Build the server**
   \`npm run build\`

2. **Obtain API credentials**
   - Guide the user through obtaining any API keys
   - Use \`ask_followup_question\` to request the key

3. **Install the server** in \`${mcpSettingsFilePath}\`

   \`\`\`
   ${mcpSettingsConfig}
   \`\`\`

   > **IMPORTANT**: Always set new servers with defaults \`disabled=false\` and \`alwaysAllow=[]\`

4. **For Claude Desktop**: On macOS, modify \`~/Library/Application Support/Claude/claude_desktop_config.json\` instead

## Modifying Existing Servers

You can extend existing MCP servers (currently connected: ${connectedServers}) if:

1. You can locate the server's repository by examining its file paths
2. The server uses the same API as the functionality you want to add

Steps:
1. Use \`list_files\` and \`read_file\` to explore the repository
2. Use \`write_to_file\`${diffOption} to modify the code
3. Build and restart the server

> **Note:** If the server runs from an installed package rather than a local repository, creating a new server may be better.

## Best Practices

1. Only create MCP servers when explicitly requested by the user
2. MCP servers are specialized tools - use existing tools when possible
3. After configuring a server, verify it appears in the "Connected MCP Servers" section
4. Suggest usage examples like "what's the weather in San Francisco?"
5. Consider maintenance and debugging needs when designing server architecture`
}
