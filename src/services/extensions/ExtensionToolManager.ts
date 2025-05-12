import * as vscode from "vscode"
import { EventEmitter } from "node:events"
import {
	ExtensionTool,
	ExtensionToolAPI,
	ExtensionToolEventName,
	ExtensionToolEvents,
	ExtensionToolResponse,
} from "../../exports/extensionTools"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { z } from "zod"

/**
 * Implementation of the Extension Tool API
 */
export class ExtensionToolManager extends EventEmitter<ExtensionToolEvents> implements ExtensionToolAPI {
	private tools: Map<string, Map<string, ExtensionTool>> = new Map()
	private static instance: ExtensionToolManager | null = null
	private static initializationPromise: Promise<ExtensionToolManager> | null = null
	private static providers = new Set<ClineProvider>()
	private static readonly GLOBAL_STATE_KEY = "extension-tool-manager-instance-id"

	/**
	 * Get the singleton ExtensionToolManager instance.
	 * Creates a new instance if one doesn't exist.
	 * Thread-safe implementation using a promise-based lock.
	 */
	public static async getInstance(
		context?: vscode.ExtensionContext,
		provider?: ClineProvider,
	): Promise<ExtensionToolManager> {
		// Register the provider if provided
		if (provider) {
			this.providers.add(provider)
		}

		// If we already have an instance, return it
		if (this.instance) {
			return this.instance
		}

		// If initialization is in progress, wait for it
		if (this.initializationPromise) {
			return this.initializationPromise
		}

		// Create a new initialization promise
		this.initializationPromise = (async () => {
			try {
				// Double-check instance in case it was created while we were waiting
				if (!this.instance) {
					this.instance = new ExtensionToolManager()
					// Store a unique identifier in global state to track the primary instance
					if (context) {
						await context.globalState.update(this.GLOBAL_STATE_KEY, Date.now().toString())
					}
				}
				return this.instance
			} finally {
				// Clear the initialization promise after completion or error
				this.initializationPromise = null
			}
		})()

		return this.initializationPromise
	}

	/**
	 * Unregister a provider from the ExtensionToolManager
	 */
	public static unregisterProvider(provider: ClineProvider): void {
		this.providers.delete(provider)
	}

	/**
	 * Private constructor to enforce singleton pattern
	 */
	private constructor() {
		super()
	}

	/**
	 * Register a tool with type-safe arguments using Zod
	 */
	public registerTool<T extends z.ZodTypeAny>(
		extensionId: string,
		options: {
			name: string
			description: string
			inputSchema?: T
		},
		fn: (args: z.infer<T>) => Promise<ExtensionToolResponse>,
	): void {
		const { name, description, inputSchema } = options

		if (!this.tools.has(extensionId)) {
			this.tools.set(extensionId, new Map())
		}

		const extensionTools = this.tools.get(extensionId)!

		const tool: ExtensionTool = {
			name,
			description,
			inputSchema,
			execute: async (args?: Record<string, unknown>) => {
				try {
					const parsedArgs = inputSchema ? await inputSchema.parseAsync(args) : ({} as z.infer<T>)
					return await fn(parsedArgs)
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
						isError: true,
					}
				}
			},
		}

		extensionTools.set(name, tool)

		// Emit event
		this.emit(ExtensionToolEventName.ToolRegistered, extensionId, name)

		console.log(`Registered tool '${name}' from extension '${extensionId}'`)
	}

	/**
	 * Unregister a tool
	 */
	public unregisterTool(extensionId: string, toolName: string): void {
		const extensionTools = this.tools.get(extensionId)
		if (extensionTools && extensionTools.has(toolName)) {
			extensionTools.delete(toolName)

			// Emit event
			this.emit(ExtensionToolEventName.ToolUnregistered, extensionId, toolName)

			console.log(`Unregistered tool '${toolName}' from extension '${extensionId}'`)
		}
	}

	/**
	 * Unregister all tools from an extension
	 */
	public unregisterAllTools(extensionId: string): void {
		const extensionTools = this.tools.get(extensionId)
		if (extensionTools) {
			// Create a copy of the keys to avoid issues during iteration
			const toolNames = [...extensionTools.keys()]

			toolNames.forEach((toolName) => {
				this.unregisterTool(extensionId, toolName)
			})

			// Clean up the map
			this.tools.delete(extensionId)

			console.log(`Unregistered all tools from extension '${extensionId}'`)
		}
	}

	/**
	 * Get all tools registered by an extension
	 */
	public getRegisteredTools(extensionId: string): string[] {
		const extensionTools = this.tools.get(extensionId)
		if (!extensionTools) {
			return []
		}
		return [...extensionTools.keys()]
	}

	/**
	 * Check if a tool is registered
	 */
	public isToolRegistered(extensionId: string, toolName: string): boolean {
		const extensionTools = this.tools.get(extensionId)
		return !!extensionTools && extensionTools.has(toolName)
	}

	/**
	 * Execute a tool by extension ID and tool name
	 * @param extensionId ID of the extension that registered the tool
	 * @param toolName Name of the tool to execute
	 * @param args Arguments to pass to the tool
	 * @returns Tool execution result
	 */
	public async executeExtensionTool(extensionId: string, toolName: string, args?: Record<string, unknown>) {
		const extensionTools = this.tools.get(extensionId)
		if (!extensionTools) {
			throw new Error(`No tools registered for extension '${extensionId}'`)
		}

		const tool = extensionTools.get(toolName)
		if (!tool) {
			throw new Error(`Tool '${toolName}' not found for extension '${extensionId}'`)
		}

		try {
			return await tool.execute(args)
		} catch (error) {
			console.error(`Error executing tool '${toolName}' from extension '${extensionId}':`, error)
			return {
				content: [
					{
						type: "text",
						text: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	}

	/**
	 * Get all registered tools as a flat array
	 */
	public getAllTools(): { extensionId: string; tool: ExtensionTool }[] {
		const allTools: { extensionId: string; tool: ExtensionTool }[] = []

		for (const [extensionId, toolMap] of this.tools.entries()) {
			for (const [_, tool] of toolMap.entries()) {
				allTools.push({ extensionId, tool })
			}
		}

		return allTools
	}
}
