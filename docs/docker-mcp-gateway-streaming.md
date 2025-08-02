# Docker MCP Gateway - Streaming Transport Configuration

## Overview

When using the Docker MCP Gateway with the `streaming` transport mode, it's important to understand the correct URL configuration to avoid connection errors.

## Issue

When connecting an MCP client to the Docker MCP Gateway using the `streaming` transport (`docker mcp gateway run --transport streaming`), the connection will fail with errors like "Invalid session ID" if the client is configured to connect to the root URL (e.g., `http://localhost:8080`).

## Root Cause

The Docker MCP Gateway, when running in `streaming` mode, does not serve its MCP functionality from the root path of the server. Instead, it expects all MCP requests to be sent to the `/mcp` endpoint.

## Solution

### Correct Configuration

When configuring your MCP client to connect to a Docker MCP Gateway running with streaming transport, you must include the `/mcp` path in the URL:

```json
{
	"mcpServers": {
		"Docker_MCP_Gateway_streaming": {
			"type": "streamable-http",
			"url": "http://localhost:8080/mcp"
		}
	}
}
```

### Incorrect Configuration (Will Fail)

```json
{
	"mcpServers": {
		"Docker_MCP_Gateway_streaming": {
			"type": "streamable-http",
			"url": "http://localhost:8080" // Missing /mcp path
		}
	}
}
```

## Quick Reference

| Transport Type | Correct URL Format          |
| -------------- | --------------------------- |
| Streaming      | `http://localhost:8080/mcp` |

## Additional Notes

- This requirement is specific to the `streaming` transport mode
- The port number (8080) may vary based on your Docker configuration
- Always ensure the `/mcp` path is included when using streaming transport

## Related Links

- [MCP Documentation](https://docs.roocode.com/advanced-usage/mcp)
- [Docker MCP Toolkit Documentation](https://docs.roocode.com/advanced-usage/mcp#docker-mcp-toolkit)
