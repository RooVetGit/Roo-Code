import { createMCPServerInstructions } from "./create-mcp-server"
import { createModeInstructions } from "./create-mode"
import { McpHub } from "../../../services/mcp/McpHub"
import { DiffStrategy } from "../../diff/DiffStrategy"

interface InstructionsDetail {
	mcpHub?: McpHub
	diffStrategy?: DiffStrategy
}

export async function fetchInstructions(text: string, detail: InstructionsDetail): Promise<string> {
	switch (text) {
		case "create_mcp_server": {
			return await createMCPServerInstructions(detail.mcpHub, detail.diffStrategy)
		}
		case "create_mode": {
			return await createModeInstructions()
		}
		default: {
			return ""
		}
	}
}
