import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

/**
 * The source of the configuration: global or project.
 */
export type ConfigSource = "global" | "project"

/**
 * Server configuration type.
 */
export type ServerConfig = {
	type: "stdio" | "sse" | "streamable-http" | string // string allows for extensibility
	command?: string
	args?: string[]
	env?: Record<string, string>
	cwd?: string
	url?: string
	headers?: Record<string, string>
	disabled?: boolean
	timeout?: number
	alwaysAllow?: string[]
	watchPaths?: string[]
	sessionId?: string // Added for streamable-http support
}

/**
 * MCP connection interface.
 */
export interface McpConnection {
	server: McpServer
	client: Client
	transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport
}

/**
 * MCP server interface.
 */
export interface McpServer {
	name: string
	config: string
	status: "connected" | "connecting" | "disconnected"
	disabled?: boolean
	source?: ConfigSource
	error?: string
	tools?: McpTool[]
	resources?: McpResource[]
	resourceTemplates?: McpResourceTemplate[]
	projectPath?: string
}

/**
 * MCP tool type.
 */
export type McpTool = {
	name: string
	description?: string
	inputSchema?: object
	alwaysAllow?: boolean
}

/**
 * MCP resource type.
 */
export type McpResource = {
	uri: string
	name: string
	mimeType?: string
	description?: string
}

/**
 * MCP resource template type.
 */
export type McpResourceTemplate = {
	uriTemplate: string
	name: string
	description?: string
	mimeType?: string
}

/**
 * MCP resource response type.
 */
export type McpResourceResponse = {
	_meta?: Record<string, any>
	contents: Array<{
		uri: string
		mimeType?: string
		text?: string
		blob?: string
	}>
}

/**
 * MCP tool call response type.
 */
export type McpToolCallResponse = {
	_meta?: Record<string, any>
	content: Array<
		| {
				type: "text"
				text: string
		  }
		| {
				type: "image"
				data: string
				mimeType: string
		  }
		| {
				type: "resource"
				resource: {
					uri: string
					mimeType?: string
					text?: string
					blob?: string
				}
		  }
	>
	isError?: boolean
}
