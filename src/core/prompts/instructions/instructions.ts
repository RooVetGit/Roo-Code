import { createMCPServerInstructions } from "./create-mcp-server"
import { createModeInstructions } from "./create-mode"
import { McpHub } from "../../../services/mcp/McpHub"
import { DiffStrategy } from "../../../shared/tools"
import * as vscode from "vscode"
import { createMermaidFixInstructions } from "./fix-mermaid"

interface InstructionsDetail {
	mcpHub?: McpHub
	diffStrategy?: DiffStrategy
	context?: vscode.ExtensionContext
	error?: string
	code?: string
}

export async function fetchInstructions(text: string, detail: InstructionsDetail): Promise<string> {
	switch (text) {
		case "create_mcp_server": {
			return await createMCPServerInstructions(detail.mcpHub, detail.diffStrategy)
		}
		case "create_mode": {
			return await createModeInstructions(detail.context)
		}
		case "fix_mermaid": {
			return await createMermaidFixInstructions(detail.error, detail.code)
		}
		default: {
			return ""
		}
	}
}
