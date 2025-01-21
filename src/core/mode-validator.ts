import { Mode, isToolAllowedForMode, TestToolName, getModeConfig } from "../shared/modes"

export { isToolAllowedForMode }
export type { TestToolName }

export function validateToolUse(toolName: TestToolName, mode: Mode): void {
	if (!isToolAllowedForMode(toolName, mode)) {
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
