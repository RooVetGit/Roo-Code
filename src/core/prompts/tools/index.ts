import type { ToolName, ModeConfig } from "@roo-code/types"

import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS, DiffStrategy, readToolOverrideWithArgs } from "../../../shared/tools"
import { McpHub } from "../../../services/mcp/McpHub"
import { Mode, getModeConfig, isToolAllowedForMode, getGroupName } from "../../../shared/modes"

import { ToolArgs } from "./types"
import { getExecuteCommandDescription } from "./execute-command"
import { getReadFileDescription } from "./read-file"
import { getFetchInstructionsDescription } from "./fetch-instructions"
import { getWriteToFileDescription } from "./write-to-file"
import { getSearchFilesDescription } from "./search-files"
import { getListFilesDescription } from "./list-files"
import { getInsertContentDescription } from "./insert-content"
import { getSearchAndReplaceDescription } from "./search-and-replace"
import { getListCodeDefinitionNamesDescription } from "./list-code-definition-names"
import { getBrowserActionDescription } from "./browser-action"
import { getAskFollowupQuestionDescription } from "./ask-followup-question"
import { getAttemptCompletionDescription } from "./attempt-completion"
import { getUseMcpToolDescription } from "./use-mcp-tool"
import { getAccessMcpResourceDescription } from "./access-mcp-resource"
import { getSwitchModeDescription } from "./switch-mode"
import { getNewTaskDescription } from "./new-task"
import { getCodebaseSearchDescription } from "./codebase-search"
import { CodeIndexManager } from "../../../services/code-index/manager"

// Map of tool names to their description functions
const toolDescriptionMap: Record<string, (args: ToolArgs) => Promise<string | undefined>> = {
	execute_command: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "execute_command", args)
		return overrideContent || getExecuteCommandDescription(args)
	},
	read_file: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "read_file", args)
		return overrideContent || getReadFileDescription(args)
	},
	fetch_instructions: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "fetch_instructions", args)
		return overrideContent || getFetchInstructionsDescription()
	},
	write_to_file: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "write_to_file", args)
		return overrideContent || getWriteToFileDescription(args)
	},
	search_files: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "search_files", args)
		return overrideContent || getSearchFilesDescription(args)
	},
	list_files: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "list_files", args)
		return overrideContent || getListFilesDescription(args)
	},
	list_code_definition_names: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "list_code_definition_names", args)
		return overrideContent || getListCodeDefinitionNamesDescription(args)
	},
	browser_action: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "browser_action", args)
		return overrideContent || getBrowserActionDescription(args)
	},
	ask_followup_question: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "ask_followup_question", args)
		return overrideContent || getAskFollowupQuestionDescription()
	},
	attempt_completion: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "attempt_completion", args)
		return overrideContent || getAttemptCompletionDescription()
	},
	use_mcp_tool: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "use_mcp_tool", args)
		return overrideContent || getUseMcpToolDescription(args)
	},
	access_mcp_resource: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "access_mcp_resource", args)
		return overrideContent || getAccessMcpResourceDescription(args)
	},
	codebase_search: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "codebase_search", args)
		return overrideContent || getCodebaseSearchDescription()
	},
	switch_mode: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "switch_mode", args)
		return overrideContent || getSwitchModeDescription()
	},
	new_task: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "new_task", args)
		return overrideContent || getNewTaskDescription(args)
	},
	insert_content: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "insert_content", args)
		return overrideContent || getInsertContentDescription(args)
	},
	search_and_replace: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(args.cwd, "search_and_replace", args)
		return overrideContent || getSearchAndReplaceDescription(args)
	},
	apply_diff: async (args) => {
		const overrideContent = await readToolOverrideWithArgs(
			args.cwd,
			`apply_diff${args.diffStrategy?.getName()}`,
			args,
		)
		return (
			overrideContent ||
			(args.diffStrategy
				? args.diffStrategy.getToolDescription({ cwd: args.cwd, toolOptions: args.toolOptions })
				: "")
		)
	},
}

export async function getToolDescriptionsForMode(
	mode: Mode,
	cwd: string,
	supportsComputerUse: boolean,
	codeIndexManager?: CodeIndexManager,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mcpHub?: McpHub,
	customModes?: ModeConfig[],
	experiments?: Record<string, boolean>,
	partialReadsEnabled?: boolean,
	settings?: Record<string, any>,
): Promise<string> {
	const config = getModeConfig(mode, customModes)
	const args: ToolArgs = {
		cwd,
		supportsComputerUse,
		diffStrategy,
		browserViewportSize,
		mcpHub,
		partialReadsEnabled,
		settings,
	}

	const tools = new Set<string>()

	// Add tools from mode's groups
	config.groups.forEach((groupEntry) => {
		const groupName = getGroupName(groupEntry)
		const toolGroup = TOOL_GROUPS[groupName]
		if (toolGroup) {
			toolGroup.tools.forEach((tool) => {
				if (
					isToolAllowedForMode(
						tool as ToolName,
						mode,
						customModes ?? [],
						undefined,
						undefined,
						experiments ?? {},
					)
				) {
					tools.add(tool)
				}
			})
		}
	})

	// Add always available tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

	// Conditionally exclude codebase_search if feature is disabled or not configured
	if (
		!codeIndexManager ||
		!(codeIndexManager.isFeatureEnabled && codeIndexManager.isFeatureConfigured && codeIndexManager.isInitialized)
	) {
		tools.delete("codebase_search")
	}

	// Map tool descriptions for allowed tools
	const descriptionPromises = Array.from(tools).map(async (toolName) => {
		const descriptionFn = toolDescriptionMap[toolName]
		if (!descriptionFn) {
			return undefined
		}

		return await descriptionFn({
			...args,
			toolOptions: undefined, // No tool options in group-based approach
		})
	})

	const descriptions = await Promise.all(descriptionPromises)
	return `# Tools\n\n${descriptions.filter(Boolean).join("\n\n")}`
}

// Export individual description functions for backward compatibility
export {
	getExecuteCommandDescription,
	getReadFileDescription,
	getFetchInstructionsDescription,
	getWriteToFileDescription,
	getSearchFilesDescription,
	getListFilesDescription,
	getListCodeDefinitionNamesDescription,
	getBrowserActionDescription,
	getAskFollowupQuestionDescription,
	getAttemptCompletionDescription,
	getUseMcpToolDescription,
	getAccessMcpResourceDescription,
	getSwitchModeDescription,
	getInsertContentDescription,
	getSearchAndReplaceDescription,
	getCodebaseSearchDescription,
}
