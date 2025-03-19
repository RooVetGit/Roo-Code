import { createMCPServerInstructions } from "./create-mcp-server"
import { createModeInstructions } from "./create-mode"

export function fetchInstructions(text: string): string {
	switch (text) {
		case "create_mcp": {
			return createMCPServerInstructions()
		}
		case "create_mode": {
			return createModeInstructions()
		}
		default: {
			return ""
		}
	}
}
