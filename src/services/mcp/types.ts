import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { McpServer } from "../../shared/mcp"

/**
 * Server configuration type.
 */
export type ServerConfig = {
	type: "stdio" | "sse" | string // string allows for extensibility
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
}

/**
 * MCP connection interface.
 */
export interface McpConnection {
	server: McpServer
	client: Client
	transport: StdioClientTransport | SSEClientTransport
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
				type: "audio"
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
