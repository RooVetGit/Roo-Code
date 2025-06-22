import type { ToolName, ModeConfig } from "@roo-code/types"

import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS, DiffStrategy } from "../../../shared/tools"
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
import { dispatchTaskToolDefinition } from "./dispatchTask"
import { getTaskStatusToolDefinition } from "./getTaskStatus"
import { consolidateResultsToolDefinition } from "./consolidateResults"
import { cancelTaskToolDefinition } from "./cancelTask"
import { releaseTasksToolDefinition } from "./releaseTasks"
import { resumeParentTaskToolDefinition } from "./resumeParentTask"
import { startConversationToolDefinition } from "./startConversation" // Import new definition
import { getCodebaseSearchDescription } from "./codebase-search"
import { CodeIndexManager } from "../../../services/code-index/manager"

// Function for the new tool's description
function getDispatchTaskDescription(): string {
	return `<tool_description>
	<tool_name>${dispatchTaskToolDefinition.name}</tool_name>
	<description>${dispatchTaskToolDefinition.description}</description>
	<parameters>
		${dispatchTaskToolDefinition.parameters
			.map(
				(param) =>
					`<parameter>\n<name>${param.name}</name>\n<type>${param.type}</type>\n<description>${param.description}</description>\n</parameter>`,
			)
			.join("\n\t\t")}
	</parameters>
</tool_description>`
}

// Function for get_task_status tool's description
function getGetTaskStatusDescription(): string {
	return `<tool_description>
	<tool_name>${getTaskStatusToolDefinition.name}</tool_name>
	<description>${getTaskStatusToolDefinition.description}</description>
	<parameters>
		${getTaskStatusToolDefinition.parameters
			.map(
				(param) =>
					`<parameter>\n<name>${param.name}</name>\n<type>${param.type}</type>\n<description>${param.description}</description>\n</parameter>`,
			)
			.join("\n\t\t")}
	</parameters>
</tool_description>`
}

// Function for consolidate_results tool's description
function getConsolidateResultsDescription(): string {
	return `<tool_description>
	<tool_name>${consolidateResultsToolDefinition.name}</tool_name>
	<description>${consolidateResultsToolDefinition.description}</description>
	<parameters>
		${consolidateResultsToolDefinition.parameters
			.map(
				(param) =>
					`<parameter>\n<name>${param.name}</name>\n<type>${param.type}</type>\n<description>${param.description}</description>\n</parameter>`,
			)
			.join("\n\t\t")}
	</parameters>
</tool_description>`
}

// Function for cancel_task tool's description
function getCancelTaskDescription(): string {
	return `<tool_description>
	<tool_name>${cancelTaskToolDefinition.name}</tool_name>
	<description>${cancelTaskToolDefinition.description}</description>
	<parameters>
		${cancelTaskToolDefinition.parameters
			.map(
				(param) =>
					`<parameter>\n<name>${param.name}</name>\n<type>${param.type}</type>\n<description>${param.description}</description>\n</parameter>`,
			)
			.join("\n\t\t")}
	</parameters>
</tool_description>`
}

// Function for release_tasks tool's description
function getReleaseTasksDescription(): string {
	return `<tool_description>
	<tool_name>${releaseTasksToolDefinition.name}</tool_name>
	<description>${releaseTasksToolDefinition.description}</description>
	<parameters>
		${releaseTasksToolDefinition.parameters
			.map(
				(param) =>
					`<parameter>\n<name>${param.name}</name>\n<type>${param.type}</type>\n<description>${param.description}</description>\n</parameter>`,
			)
			.join("\n\t\t")}
	</parameters>
</tool_description>`
}

// Function for resume_parent_task tool's description
function getResumeParentTaskDescription(): string {
	return `<tool_description>
	<tool_name>${resumeParentTaskToolDefinition.name}</tool_name>
	<description>${resumeParentTaskToolDefinition.description}</description>
	<parameters>
		${resumeParentTaskToolDefinition.parameters
			.map(
				(param) =>
					`<parameter>\n<name>${param.name}</name>\n<type>${param.type}</type>\n<description>${param.description}</description>\n</parameter>`,
			)
			.join("\n\t\t")}
	</parameters>
</tool_description>`
}

// Function for start_conversation tool's description
function getStartConversationDescription(): string {
	return `<tool_description>
	<tool_name>${startConversationToolDefinition.name}</tool_name>
	<description>${startConversationToolDefinition.description}</description>
	<parameters>
		${startConversationToolDefinition.parameters
			.map(
				(param) =>
					`<parameter>\n<name>${param.name}</name>\n<type>${param.type}</type>\n<description>${param.description}</description>\n</parameter>`,
			)
			.join("\n\t\t")}
	</parameters>
</tool_description>`
}

// Map of tool names to their description functions
const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
	execute_command: (args) => getExecuteCommandDescription(args),
	read_file: (args) => getReadFileDescription(args),
	fetch_instructions: () => getFetchInstructionsDescription(),
	write_to_file: (args) => getWriteToFileDescription(args),
	search_files: (args) => getSearchFilesDescription(args),
	list_files: (args) => getListFilesDescription(args),
	list_code_definition_names: (args) => getListCodeDefinitionNamesDescription(args),
	browser_action: (args) => getBrowserActionDescription(args),
	ask_followup_question: () => getAskFollowupQuestionDescription(),
	attempt_completion: (args) => getAttemptCompletionDescription(args),
	use_mcp_tool: (args) => getUseMcpToolDescription(args),
	access_mcp_resource: (args) => getAccessMcpResourceDescription(args),
	codebase_search: () => getCodebaseSearchDescription(),
	switch_mode: () => getSwitchModeDescription(),
	new_task: (args) => getNewTaskDescription(args),
	dispatch_task: () => getDispatchTaskDescription(),
	get_task_status: () => getGetTaskStatusDescription(),
	consolidate_results: () => getConsolidateResultsDescription(),
	cancel_task: () => getCancelTaskDescription(),
	release_tasks: () => getReleaseTasksDescription(),
	resume_parent_task: () => getResumeParentTaskDescription(),
	start_conversation: () => getStartConversationDescription(), // Added start_conversation
	insert_content: (args) => getInsertContentDescription(args),
	search_and_replace: (args) => getSearchAndReplaceDescription(args),
	apply_diff: (args) =>
		args.diffStrategy ? args.diffStrategy.getToolDescription({ cwd: args.cwd, toolOptions: args.toolOptions }) : "",
}

export function getToolDescriptionsForMode(
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
): string {
	const config = getModeConfig(mode, customModes)
	const args: ToolArgs = {
		cwd,
		supportsComputerUse,
		diffStrategy,
		browserViewportSize,
		mcpHub,
		partialReadsEnabled,
		settings,
		experiments,
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
	const descriptions = Array.from(tools).map((toolName) => {
		const descriptionFn = toolDescriptionMap[toolName]
		if (!descriptionFn) {
			return undefined
		}

		return descriptionFn({
			...args,
			toolOptions: undefined, // No tool options in group-based approach
		})
	})

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
