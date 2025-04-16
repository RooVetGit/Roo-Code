/**
 * Tool categories for permission management
 * These categories are used to group tools for permission management
 */

/**
 * Tool categories enum
 * Each tool belongs to one of these categories
 */
export enum ToolCategory {
	READ_ONLY = "readOnly",
	WRITE = "write",
	EXECUTE = "execute",
	BROWSER = "browser",
	MCP = "mcp",
	MODE_SWITCH = "modeSwitch",
	SUBTASK = "subtask",
}

/**
 * Interface for tool information
 */
export interface ToolInfo {
	name: string
	category: ToolCategory
	description: string
}

/**
 * Map of tool names to their categories
 * This is used to determine which permission applies to a given tool
 */
export const toolCategories: Record<string, ToolCategory> = {
	// Read-only tools
	readFile: ToolCategory.READ_ONLY,
	fetchInstructions: ToolCategory.READ_ONLY,
	listFilesTopLevel: ToolCategory.READ_ONLY,
	listFilesRecursive: ToolCategory.READ_ONLY,
	listCodeDefinitionNames: ToolCategory.READ_ONLY,
	searchFiles: ToolCategory.READ_ONLY,

	// Write tools
	editedExistingFile: ToolCategory.WRITE,
	appliedDiff: ToolCategory.WRITE,
	newFileCreated: ToolCategory.WRITE,
	search_and_replace: ToolCategory.WRITE,

	// Execute tools
	execute_command: ToolCategory.EXECUTE,

	// Browser tools
	browser_action_launch: ToolCategory.BROWSER,

	// MCP tools
	use_mcp_tool: ToolCategory.MCP,
	access_mcp_resource: ToolCategory.MCP,

	// Mode switch tools
	switchMode: ToolCategory.MODE_SWITCH,

	// Subtask tools
	newTask: ToolCategory.SUBTASK,
	finishTask: ToolCategory.SUBTASK,
}

/**
 * Get the category for a given tool
 * @param toolName The name of the tool
 * @returns The category of the tool, or undefined if the tool is not categorized
 */
export function getToolCategory(toolName: string): ToolCategory | undefined {
	return toolCategories[toolName]
}

/**
 * Check if a tool is in a specific category
 * @param toolName The name of the tool
 * @param category The category to check
 * @returns True if the tool is in the specified category, false otherwise
 */
export function isToolInCategory(toolName: string, category: ToolCategory): boolean {
	return toolCategories[toolName] === category
}

/**
 * Get all tools in a specific category
 * @param category The category to get tools for
 * @returns An array of tool names in the specified category
 */
export function getToolsInCategory(category: ToolCategory): string[] {
	return Object.entries(toolCategories)
		.filter(([_, toolCategory]) => toolCategory === category)
		.map(([toolName, _]) => toolName)
}
