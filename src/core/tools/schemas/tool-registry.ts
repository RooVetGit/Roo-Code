import { BaseToolSchema, generateFunctionCallSchema, generateAnthropicToolSchema } from "./base-tool-schema"
import { accessMcpResourceSchema } from "./access-mcp-resource-schema"
import { applyDiffSchema } from "./apply-diff-schema"
import { codebaseSearchSchema } from "./codebase-search-schema"
import { executeCommandSchema } from "./execute-command-schema"
import { insertContentSchema } from "./insert-content-schema"
import { listCodeDefinitionNamesSchema } from "./list-code-definition-names-schema"
import { listFilesSchema } from "./list-files-schema"
import { readFileSchema } from "./read-file-schema"
import { searchAndReplaceSchema } from "./search-and-replace-schema"
import { searchFilesSchema } from "./search-files-schema"
import { switchModeSchema } from "./switch-mode-schema"
import { writeToFileSchema } from "./write-to-file-schema"
import { ToolArgs } from "../../prompts/tools/types"

/**
 * Registry of tools that support native function calling
 */
export class ToolRegistry {
	private static instance: ToolRegistry
	private tools: Map<string, BaseToolSchema> = new Map()

	private constructor() {
		// Register supported tools
		this.registerTool(accessMcpResourceSchema)
		this.registerTool(applyDiffSchema)
		this.registerTool(codebaseSearchSchema)
		this.registerTool(executeCommandSchema)
		this.registerTool(insertContentSchema)
		this.registerTool(listCodeDefinitionNamesSchema)
		this.registerTool(listFilesSchema)
		this.registerTool(readFileSchema)
		this.registerTool(searchAndReplaceSchema)
		this.registerTool(searchFilesSchema)
		this.registerTool(switchModeSchema)
		this.registerTool(writeToFileSchema)
	}

	public static getInstance(): ToolRegistry {
		if (!ToolRegistry.instance) {
			ToolRegistry.instance = new ToolRegistry()
		}
		return ToolRegistry.instance
	}

	/**
	 * Register a tool schema
	 */
	public registerTool(schema: BaseToolSchema): void {
		this.tools.set(schema.name, schema)
	}

	/**
	 * Get all registered tool names
	 */
	public getToolNames(): string[] {
		return Array.from(this.tools.keys())
	}

	/**
	 * Check if a tool supports function calling
	 */
	public isToolSupported(toolName: string): boolean {
		return this.tools.has(toolName)
	}

	/**
	 * Get tool schema by name
	 */
	public getToolSchema(toolName: string): BaseToolSchema | undefined {
		return this.tools.get(toolName)
	}

	/**
	 * Generate OpenAI function call schemas for all supported tools
	 */
	public generateFunctionCallSchemas(toolNames: string[], toolArgs?: ToolArgs): any[] {
		const schemas: any[] = []

		for (const toolName of toolNames) {
			const baseSchema = this.tools.get(toolName)
			if (baseSchema) {
				const schema = baseSchema.customDescription
					? baseSchema.customDescription(toolArgs || ({} as ToolArgs))
					: baseSchema
				if (schema) {
					schemas.push(generateFunctionCallSchema(schema))
				}
			}
		}

		return schemas
	}

	/**
	 * Generate Anthropic tool schemas for all supported tools
	 */
	public generateAnthropicToolSchemas(toolNames: string[]): any[] {
		const schemas: any[] = []

		for (const toolName of toolNames) {
			const schema = this.tools.get(toolName)
			if (schema) {
				schemas.push(generateAnthropicToolSchema(schema))
			}
		}

		return schemas
	}

	/**
	 * Get supported tools from a list of tool names
	 */
	public getSupportedTools(toolNames: string[]): string[] {
		return toolNames.filter((toolName) => this.tools.has(toolName))
	}

	/**
	 * Get unsupported tools from a list of tool names
	 */
	public getUnsupportedTools(toolNames: string[]): string[] {
		return toolNames.filter((toolName) => !this.tools.has(toolName))
	}
}

/**
 * Get the global tool registry instance
 */
export function getToolRegistry(): ToolRegistry {
	return ToolRegistry.getInstance()
}
