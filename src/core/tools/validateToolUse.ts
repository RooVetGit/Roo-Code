import type { ToolName, ModeConfig } from "@roo-code/types"

import { Agent, isToolAllowedForAgent } from "../../shared/agents"

export function validateToolUse(
	toolName: ToolName,
	agent: Agent,
	customAgents?: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, unknown>,
): void {
	if (!isToolAllowedForAgent(toolName, agent, customAgents ?? [], toolRequirements, toolParams)) {
		throw new Error(`Tool "${toolName}" is not allowed in ${agent} mode.`)
	}
}
