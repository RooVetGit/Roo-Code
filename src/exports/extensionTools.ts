import { McpToolCallResponse } from "../shared/mcp"
import { EventEmitter } from "node:events"
import { z } from "zod"

/**
 * Interface for extension-provided tool
 */
export interface ExtensionTool {
	/**
	 * The name of the tool that will be used in prompt and code
	 */
	name: string

	/**
	 * Description of what the tool does for LLM and user information
	 */
	description: string

	/**
	 * Optional JSON schema for tool arguments
	 */
	inputSchema?: object

	/**
	 * Method that will be called when the tool is executed
	 * @param args Arguments passed to the tool
	 * @returns Response in the same format as MCP tool responses
	 */
	execute(args?: Record<string, unknown>): Promise<ExtensionToolResponse>
}

/**
 * Response format for extension tools
 * Uses the same format as MCP tool responses for consistency
 */
export type ExtensionToolResponse = McpToolCallResponse

/**
 * Events emitted by the Extension Tool API
 */
export enum ExtensionToolEventName {
	/**
	 * Emitted when a tool is registered
	 */
	ToolRegistered = "toolRegistered",

	/**
	 * Emitted when a tool is unregistered
	 */
	ToolUnregistered = "toolUnregistered",
}

/**
 * Event types for Extension Tool API
 */
export type ExtensionToolEvents = {
	[ExtensionToolEventName.ToolRegistered]: [extensionId: string, toolName: string]
	[ExtensionToolEventName.ToolUnregistered]: [extensionId: string, toolName: string]
}

/**
 * API for extensions to register and manage tools
 */
export interface ExtensionToolAPI extends EventEmitter<ExtensionToolEvents> {
	/**
	 * Register a tool from an extension with type-safe arguments using Zod
	 * @param extensionId ID of the VSCode extension registering the tool
	 * @param options Tool configuration with name, description, and optional Zod schema
	 * @param fn Function that implements the tool with typed arguments
	 */
	registerTool<T extends z.ZodTypeAny>(
		extensionId: string,
		options: {
			name: string
			description: string
			inputSchema?: T
		},
		fn: (args: z.infer<T>) => Promise<ExtensionToolResponse>,
	): void

	/**
	 * Unregister a tool
	 * @param extensionId ID of the VSCode extension that registered the tool
	 * @param toolName Name of the tool to unregister
	 */
	unregisterTool(extensionId: string, toolName: string): void

	/**
	 * Unregister all tools from an extension
	 * @param extensionId ID of the VSCode extension
	 */
	unregisterAllTools(extensionId: string): void

	/**
	 * Get all tools registered by an extension
	 * @param extensionId ID of the VSCode extension
	 * @returns Array of tool names registered by the extension
	 */
	getRegisteredTools(extensionId: string): string[]

	/**
	 * Check if a tool is registered
	 * @param extensionId ID of the VSCode extension
	 * @param toolName Name of the tool
	 * @returns True if the tool is registered, false otherwise
	 */
	isToolRegistered(extensionId: string, toolName: string): boolean
}
