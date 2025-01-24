import { Mode, isToolAllowedForMode, getModeConfig, ModeConfig, FileRestrictionError } from "../shared/modes"
import { ToolName } from "../shared/tool-groups"

export { isToolAllowedForMode }
export type { ToolName }

export function validateToolUse(
	toolName: ToolName,
	mode: Mode,
	customModes?: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, unknown>,
): void {
	if (!isToolAllowedForMode(toolName, mode, customModes ?? [], toolRequirements, toolParams)) {
		throw new Error(`Tool "${toolName}" is not allowed in ${mode} mode.`)
	}
}

export type ToolName =
	| "execute_command"
	| "read_file"
	| "write_to_file"
	| "apply_diff"
	| "search_files"
	| "list_files"
	| "list_code_definition_names"
	| "browser_action"
	| "use_mcp_tool"
	| "access_mcp_resource"
	| "ask_followup_question"
	| "attempt_completion"
	| "semantic_search"
