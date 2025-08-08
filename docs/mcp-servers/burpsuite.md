# BurpSuite MCP Server Integration

This guide explains how to integrate the [BurpSuite MCP Server](https://github.com/PortSwigger/mcp-server) with Roo-Code, allowing AI assistants to interact with Burp Suite for security testing and web application analysis.

## Overview

The BurpSuite MCP Server enables AI clients to interact with Burp Suite through the Model Context Protocol (MCP). This integration allows Roo-Code to:

- Analyze HTTP requests and responses captured by Burp Suite
- Perform security scans and vulnerability assessments
- Interact with Burp Suite's proxy, scanner, and other tools
- Automate security testing workflows

## Prerequisites

Before setting up the BurpSuite MCP server, ensure you have:

1. **Burp Suite Professional or Community Edition** installed and running
2. **Java** installed and available in your system's PATH
3. **The BurpSuite MCP Extension** installed in Burp Suite

## Installation Steps

### Step 1: Install the BurpSuite Extension

1. Clone the BurpSuite MCP repository:

    ```bash
    git clone https://github.com/PortSwigger/mcp-server.git
    cd mcp-server
    ```

2. Build the extension JAR file:

    ```bash
    ./gradlew embedProxyJar
    ```

3. Load the extension in Burp Suite:
    - Open Burp Suite
    - Navigate to the **Extensions** tab
    - Click **Add**
    - Set **Extension Type** to **Java**
    - Select the JAR file from `build/libs/burp-mcp-all.jar`
    - Click **Next** to load the extension

### Step 2: Configure the MCP Server in Burp Suite

1. In Burp Suite, navigate to the **MCP** tab
2. Enable the MCP server by checking the **Enabled** checkbox
3. Note the server URL (default: `http://127.0.0.1:9876`)
4. Optionally, enable **Enable tools that can edit your config** if you want the MCP server to modify Burp configuration

### Step 3: Configure Roo-Code

There are two ways to configure the BurpSuite MCP server in Roo-Code:

#### Option A: Project-Level Configuration (Recommended)

Create or edit `.roo/mcp.json` in your project root:

```json
{
	"mcpServers": {
		"burpsuite": {
			"command": "java",
			"args": ["-jar", "/path/to/mcp-server/build/libs/mcp-proxy-all.jar", "--sse-url", "http://127.0.0.1:9876"],
			"env": {},
			"disabled": false,
			"alwaysAllow": [],
			"disabledTools": []
		}
	}
}
```

#### Option B: Global Configuration

Edit the global MCP settings file:

- **Windows**: `%APPDATA%\Roo-Code\mcp-settings.json`
- **macOS**: `~/Library/Application Support/Roo-Code/mcp-settings.json`
- **Linux**: `~/.config/Roo-Code/mcp-settings.json`

Add the same configuration as shown above.

### Step 4: Verify the Connection

1. Restart Roo-Code or reload the window
2. Open the MCP tab in Roo-Code to verify the BurpSuite server is listed
3. The server status should show as "connected" when Burp Suite is running

## Configuration Options

### Environment Variables

If your Burp Suite installation requires specific environment variables, add them to the `env` object:

```json
{
	"mcpServers": {
		"burpsuite": {
			"command": "java",
			"args": ["-jar", "/path/to/mcp-proxy-all.jar", "--sse-url", "http://127.0.0.1:9876"],
			"env": {
				"JAVA_HOME": "/path/to/java",
				"BURP_LICENSE": "your-license-key"
			}
		}
	}
}
```

### Custom Port Configuration

If you've configured Burp Suite's MCP server to use a different port:

1. Update the port in Burp Suite's MCP tab
2. Update the `--sse-url` argument in your configuration to match

### Tool Permissions

Control which Burp Suite tools are available to the AI:

```json
{
	"mcpServers": {
		"burpsuite": {
			"command": "java",
			"args": ["..."],
			"alwaysAllow": ["scan", "proxy_history"],
			"disabledTools": ["config_edit", "active_scan"]
		}
	}
}
```

## Usage Examples

Once configured, you can ask Roo-Code to:

- "Analyze the HTTP requests in Burp Suite's proxy history"
- "Check for SQL injection vulnerabilities in the captured requests"
- "Export the scan results from Burp Suite"
- "Review the authentication flow captured in Burp"

## Troubleshooting

### Server Not Connecting

1. **Verify Burp Suite is running** and the MCP extension is enabled
2. **Check the server URL** matches between Burp Suite and your configuration
3. **Ensure Java is in PATH**: Run `java -version` to verify
4. **Check firewall settings** aren't blocking localhost connections

### Permission Errors

- Ensure the JAR file path is correct and accessible
- On macOS/Linux, ensure the JAR file has execute permissions: `chmod +x mcp-proxy-all.jar`

### Logs and Debugging

- Check Burp Suite's **Extender** tab for error messages
- Enable debug logging in Roo-Code's output panel
- Review the MCP server logs in Burp Suite's MCP tab

## Security Considerations

1. **Local Only**: The default configuration only allows connections from localhost
2. **Sensitive Data**: Be aware that the MCP server can access all data in Burp Suite
3. **Tool Permissions**: Use `disabledTools` to restrict access to sensitive operations
4. **Production Systems**: Avoid using this integration when testing production systems without proper authorization

## Additional Resources

- [BurpSuite MCP Server Repository](https://github.com/PortSwigger/mcp-server)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Burp Suite Documentation](https://portswigger.net/burp/documentation)
- [Roo-Code MCP Documentation](https://docs.roocode.com/advanced-usage/mcp)

## Support

For issues specific to:

- **BurpSuite MCP Server**: Open an issue on the [GitHub repository](https://github.com/PortSwigger/mcp-server/issues)
- **Roo-Code Integration**: Visit the [Roo-Code support](https://github.com/RooCodeInc/Roo-Code/issues)
