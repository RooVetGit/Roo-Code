export type McpErrorEntry = {
	message: string
	timestamp: number
	level: "error" | "warn" | "info"
}

export type ConfigSource = "global" | "project"

export type McpServer = {
	name: string
	config: string
	status: "connected" | "connecting" | "disconnected"
	error?: string
	errorHistory?: McpErrorEntry[]
	tools?: McpTool[]
	resources?: McpResource[]
	resourceTemplates?: McpResourceTemplate[]
	disabled?: boolean
	timeout?: number
	source?: ConfigSource
	projectPath?: string
}

export type McpTool = {
	name: string
	description?: string
	inputSchema?: object
	alwaysAllow?: boolean
}

export type McpResource = {
	uri: string
	name: string
	mimeType?: string
	description?: string
}

export type McpResourceTemplate = {
	uriTemplate: string
	name: string
	description?: string
	mimeType?: string
}
