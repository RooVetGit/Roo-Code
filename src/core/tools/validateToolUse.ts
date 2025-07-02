import type { ToolName, ModeConfig } from "@roo-code/types"

import { Mode, isToolAllowedForMode } from "../../shared/modes"

export function validateToolUse(
	toolName: ToolName,
	mode: Mode,
	customModes?: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, unknown>,
	mcpContext?: { serverName?: string; toolName?: string; serverDefaultEnabled?: boolean }, // NEW: Added serverDefaultEnabled
): void {
	if (
		!isToolAllowedForMode(
			toolName,
			mode,
			customModes ?? [],
			toolRequirements,
			toolParams,
			undefined,
			mcpContext, // Pass MCP context
		)
	) {
		const restriction = mcpContext ? ` (server: ${mcpContext.serverName}, tool: ${mcpContext.toolName})` : ""
		throw new Error(`Tool "${toolName}" is not allowed in ${mode} mode${restriction}.`)
	}
}
