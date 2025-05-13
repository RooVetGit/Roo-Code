import { createMCPServerInstructions } from "./create-mcp-server"
import { createModeInstructions } from "./create-mode"
import { McpHub } from "../../../services/mcp/McpHub"
import { DiffStrategy } from "../../../shared/tools"
import * as vscode from "vscode"

/**
 * Context and dependencies required for generating instructions
 */
interface InstructionsDetail {
	/** MCP Hub instance for server-related instructions */
	mcpHub?: McpHub
	/** Diff strategy for file modifications */
	diffStrategy?: DiffStrategy
	/** VSCode extension context */
	context?: vscode.ExtensionContext
}

/**
 * Fetch specific instruction content based on the requested task
 * @param text - Task identifier (e.g., "create_mcp_server")
 * @param detail - Context and dependencies for instruction generation
 * @returns Formatted instruction content for the requested task
 */
export async function fetchInstructions(text: string, detail: InstructionsDetail): Promise<string> {
	switch (text) {
		case "create_mcp_server":
			return await createMCPServerInstructions(detail.mcpHub, detail.diffStrategy)

		case "create_mode":
			return await createModeInstructions(detail.context)

		default:
			return ""
	}
}
