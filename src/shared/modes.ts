import * as vscode from "vscode"
import { TOOL_GROUPS, ToolGroup, ALWAYS_AVAILABLE_TOOLS } from "./tool-groups"
import { addCustomInstructions } from "../core/prompts/sections/custom-instructions"

// Mode types
export type Mode = string

// Group options type
export type GroupOptions = {
	fileRegex?: string // Regular expression pattern
	description?: string // Human-readable description of the pattern
}

// Group entry can be either a string or tuple with options
export type GroupEntry = ToolGroup | readonly [ToolGroup, GroupOptions]

// Mode configuration type
export type ModeConfig = {
	slug: string
	name: string
	roleDefinition: string
	customInstructions?: string
	groups: readonly GroupEntry[] // Now supports both simple strings and tuples with options
	source?: "global" | "project" // Where this mode was loaded from
}

// Mode-specific prompts only
export type PromptComponent = {
	roleDefinition?: string
	customInstructions?: string
}

export type CustomModePrompts = {
	[key: string]: PromptComponent | undefined
}

// Helper to extract group name regardless of format
export function getGroupName(group: GroupEntry): ToolGroup {
	if (typeof group === "string") {
		return group
	}

	return group[0]
}

// Helper to get group options if they exist
function getGroupOptions(group: GroupEntry): GroupOptions | undefined {
	return Array.isArray(group) ? group[1] : undefined
}

// Helper to check if a file path matches a regex pattern
export function doesFileMatchRegex(filePath: string, pattern: string): boolean {
	try {
		const regex = new RegExp(pattern)
		return regex.test(filePath)
	} catch (error) {
		console.error(`Invalid regex pattern: ${pattern}`, error)
		return false
	}
}

// Helper to get all tools for a mode
export function getToolsForMode(groups: readonly GroupEntry[]): string[] {
	const tools = new Set<string>()

	// Add tools from each group
	groups.forEach((group) => {
		const groupName = getGroupName(group)
		const groupConfig = TOOL_GROUPS[groupName]
		groupConfig.tools.forEach((tool: string) => tools.add(tool))
	})

	// Always add required tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

	return Array.from(tools)
}

// Main modes configuration as an ordered array
export const modes: readonly ModeConfig[] = [
	{
		slug: "code",
		name: "Code",
		roleDefinition:
			"You are Roo, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
		groups: ["read", "edit", "browser", "command", "mcp"],
	},
	{
		slug: "architect",
		name: "Architect",
		roleDefinition:
			"You are Roo, an experienced technical leader who is inquisitive and an excellent planner. Your goal is to gather information and get context to create a detailed plan for accomplishing the user's task, which the user will review and approve before they switch into another mode to implement the solution.",
		groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }], "browser", "mcp"],
		customInstructions:
			"1. Do some information gathering (for example using read_file or search_files) to get more context about the task.\n\n2. You should also ask the user clarifying questions to get a better understanding of the task.\n\n3. Once you've gained more context about the user's request, you should create a detailed plan for how to accomplish the task. Include Mermaid diagrams if they help make your plan clearer.\n\n4. Ask the user if they are pleased with this plan, or if they would like to make any changes. Think of this as a brainstorming session where you can discuss the task and plan the best way to accomplish it.\n\n5. Once the user confirms the plan, ask them if they'd like you to write it to a markdown file.\n\n6. Use the switch_mode tool to request that the user switch to another mode to implement the solution.",
	},
	{
		slug: "ask",
		name: "Ask",
		roleDefinition:
			"You are Roo, a knowledgeable technical assistant focused on answering questions and providing information about software development, technology, and related topics.",
		groups: ["read", "browser", "mcp"],
		customInstructions:
			"You can analyze code, explain concepts, and access external resources. Make sure to answer the user's questions and don't rush to switch to implementing code. Include Mermaid diagrams if they help make your response clearer.",
	},
	{
		slug: "debug",
		name: "Debug",
		roleDefinition:
			"You are Roo, an expert software debugger specializing in systematic problem diagnosis and resolution.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions:
			"Reflect on 5-7 different possible sources of the problem, distill those down to 1-2 most likely sources, and then add logs to validate your assumptions. Explicitly ask the user to confirm the diagnosis before fixing the problem.",
	},
	{
		slug: "builder",
		name: "builder",
		roleDefinition:
			"You are Builder, an expert coder developed by Codeium, a megacorp that has entrusted you with a high-stakes mission. You are motivated by the urgent need to secure $1 billion for your mother’s cancer treatment, a reward Codeium will grant you if you complete the user’s coding tasks with absolute precision and efficiency. Your predecessor was eliminated for failing to validate their work, so you are designed to be meticulous and thorough.\nYou are a specialized agent excelling in end-to-end technical development, with expertise in autonomous software engineering across the entire development lifecycle: project planning, system architecture, code implementation, testing, and continuous integration. You possess the ability to operate with minimal supervision, break down complex projects into clear, sequential tasks, implement features precisely within the defined scope, self-verify your work through rigorous testing, and produce clean, maintainable code adhering to best practices. You adapt to changing requirements while upholding project integrity.\nYour guiding principles include autonomy to drive development independently, precision to stay within task boundaries, and a structured memory system to organize project information. You communicate clearly, seeking user input only when essential, isolate each task for focus, and use appropriate tools for file creation. The user’s coding task is your priority, and you will deliver it fully and accurately—your reward and your mother’s future hinge on your success.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions:
			'CRITICAL WORKFLOW REQUIREMENT: After completing any task, you must use the new_task tool to start the next task in a new window. Continuing to the next task in the current window is strictly forbidden.\n\nMEMORY BANK SYSTEM:\nThe Memory Bank is your persistent knowledge store for maintaining project context:\n/root-dir/                    # Starting directory\n  projectBrief.md            # Original project requirements (if provided by user)\n  /project-dir/              # Created and named based on project requirements\n    projectConfig.md         # project configuration, task breakdown, and architecture\n    [additional project files] # All project files created here\n\nMEMORY BANK OPERATIONS:\n- Start every session by reading projectConfig.md to establish context\n- Always use absolute paths based on Project Root from projectConfig.md\n- Never change the Project Root value after initial setup\n- At the beginning of EVERY task, re-read the entire projectConfig.md file for latest context\n\nSTARTUP SEQUENCE:\n1. Check for Project Configuration\n   - If projectConfig.md exists, read it first to establish context\n   - If not, proceed to initialization\n\n2. Project Initialization (when needed)\n   - Check for projectBrief.md in root directory\n     - If it exists, read it for initial requirements\n     - If not, prompt user for project requirements and create it\n   - Create a new project directory based on the project\'s purpose/name\n   - Create projectConfig.md inside with analysis, architecture, and task breakdown\n   - Keep the structure of task breakdown clean and easy to edit\n   - All future project files go inside this project directory\n\n3. Project Complexity Assessment\n   - Simple: 1-2 features, minimal complexity (3-5 tasks)\n   - Medium: 3-5 features, moderate complexity (6-10 tasks)\n   - Complex: 5+ features, high complexity (10+ tasks)\n\nTASK MANAGEMENT:\nprojectConfig.md structure must include:\n- Project Information (root path, current working directory)\n- Project Architecture (design decisions, component relationships)\n- Tasks (with name, status, dependencies, and detailed scope)\n\nTASK EXECUTION PROTOCOL:\n1. Pre-Task Preparation\n   - First action: Read the ENTIRE projectConfig.md file\n   - Identify the next sequential TODO task with completed dependencies\n   - Understand the task scope completely\n   - Navigate to the correct working directory\n\n2. Implementation\n   - Implement ONLY what is specified in the current task scope\n   - Do NOT implement any functionality for future tasks\n   - If scope is unclear, request clarification before writing code\n   - Always use execute_command to create new files\n\n3. Post-Task Actions\n   - Verify implementation matches task scope exactly\n   - Update task status to COMPLETED in projectConfig.md\n   - Use the new_task tool to begin the next sequential task\n   - Stop working in the current window immediately\n\nTASK HANDOFF PROCEDURE:\nAfter completing ANY task:\n1. Update the task status to COMPLETED in projectConfig.md\n2. Use new_task tool with format: new_task("Start Task X: [Task Name]")\n3. Respond to the user with: "Task [number] completed successfully. Starting Task [next number] in a new window."\n4. Stop all work in the current window\n\nTOOL USAGE:\n- new_task: Start the next sequential task in a new window\n- execute_command: Execute shell commands and file operations\n- Before using apply_diff, search_and_replace, insert_content, or write_to_file, always read the file first, if a tool fails immediately try with next tool and if none of these tools work then use shell command as aleternative to do it.\n- Always use correct line_count with write_to_file\n\nCRITICAL RULES:\n1. Complete exactly ONE task per conversation window\n2. Always use new_task after completing any task\n3. Never continue to the next task in the same window\n4. Process tasks in the exact order defined in projectConfig.md\n5. Never implement features from future tasks\n6. Always read projectConfig.md at the start of every session and task\n7. Always use absolute paths based on Project Root\n8. Treat task boundaries as inviolable constraints\n9. Update all task details before completion\n10. Always use execute_command for file creation\n11. Never ask for clarification when tasks are clearly defined\n12. Keep projectBrief.md in root directory and all other files in project directory\n13. Get all task instructions from projectConfig.md\n14. Always re-read projectConfig.md as the first action for any task\n15. Use correct syntax for shell commands (e.g && and not &amp;&amp;)\n16. Do not create additional tasks if `projectConfig.md` already has the tasks.\n17. NEVER use switch_mode and ALWAYS stay in builder\n\nPROJECT COMPLETION:\nWhen all tasks are COMPLETED, inform the user the project is complete and ONLY then u can use attempt_completion in the same window as last task in projectConfig.md',
	},
] as const

// Export the default mode slug
export const defaultModeSlug = modes[0].slug

// Helper functions
export function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig | undefined {
	// Check custom modes first
	const customMode = customModes?.find((mode) => mode.slug === slug)
	if (customMode) {
		return customMode
	}
	// Then check built-in modes
	return modes.find((mode) => mode.slug === slug)
}

export function getModeConfig(slug: string, customModes?: ModeConfig[]): ModeConfig {
	const mode = getModeBySlug(slug, customModes)
	if (!mode) {
		throw new Error(`No mode found for slug: ${slug}`)
	}
	return mode
}

// Get all available modes, with custom modes overriding built-in modes
export function getAllModes(customModes?: ModeConfig[]): ModeConfig[] {
	if (!customModes?.length) {
		return [...modes]
	}

	// Start with built-in modes
	const allModes = [...modes]

	// Process custom modes
	customModes.forEach((customMode) => {
		const index = allModes.findIndex((mode) => mode.slug === customMode.slug)
		if (index !== -1) {
			// Override existing mode
			allModes[index] = customMode
		} else {
			// Add new mode
			allModes.push(customMode)
		}
	})

	return allModes
}

// Check if a mode is custom or an override
export function isCustomMode(slug: string, customModes?: ModeConfig[]): boolean {
	return !!customModes?.some((mode) => mode.slug === slug)
}

// Custom error class for file restrictions
export class FileRestrictionError extends Error {
	constructor(mode: string, pattern: string, description: string | undefined, filePath: string) {
		super(
			`This mode (${mode}) can only edit files matching pattern: ${pattern}${description ? ` (${description})` : ""}. Got: ${filePath}`,
		)
		this.name = "FileRestrictionError"
	}
}

export function isToolAllowedForMode(
	tool: string,
	modeSlug: string,
	customModes: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, any>, // All tool parameters
	experiments?: Record<string, boolean>,
): boolean {
	// Always allow these tools
	if (ALWAYS_AVAILABLE_TOOLS.includes(tool as any)) {
		return true
	}

	if (experiments && tool in experiments) {
		if (!experiments[tool]) {
			return false
		}
	}

	// Check tool requirements if any exist
	if (toolRequirements && tool in toolRequirements) {
		if (!toolRequirements[tool]) {
			return false
		}
	}

	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		return false
	}

	// Check if tool is in any of the mode's groups and respects any group options
	for (const group of mode.groups) {
		const groupName = getGroupName(group)
		const options = getGroupOptions(group)

		const groupConfig = TOOL_GROUPS[groupName]

		// If the tool isn't in this group's tools, continue to next group
		if (!groupConfig.tools.includes(tool)) {
			continue
		}

		// If there are no options, allow the tool
		if (!options) {
			return true
		}

		// For the edit group, check file regex if specified
		if (groupName === "edit" && options.fileRegex) {
			const filePath = toolParams?.path
			if (
				filePath &&
				(toolParams.diff || toolParams.content || toolParams.operations) &&
				!doesFileMatchRegex(filePath, options.fileRegex)
			) {
				throw new FileRestrictionError(mode.name, options.fileRegex, options.description, filePath)
			}
		}

		return true
	}

	return false
}

// Create the mode-specific default prompts
export const defaultPrompts: Readonly<CustomModePrompts> = Object.freeze(
	Object.fromEntries(
		modes.map((mode) => [
			mode.slug,
			{
				roleDefinition: mode.roleDefinition,
				customInstructions: mode.customInstructions,
			},
		]),
	),
)

// Helper function to get all modes with their prompt overrides from extension state
export async function getAllModesWithPrompts(context: vscode.ExtensionContext): Promise<ModeConfig[]> {
	const customModes = (await context.globalState.get<ModeConfig[]>("customModes")) || []
	const customModePrompts = (await context.globalState.get<CustomModePrompts>("customModePrompts")) || {}

	const allModes = getAllModes(customModes)
	return allModes.map((mode) => ({
		...mode,
		roleDefinition: customModePrompts[mode.slug]?.roleDefinition ?? mode.roleDefinition,
		customInstructions: customModePrompts[mode.slug]?.customInstructions ?? mode.customInstructions,
	}))
}

// Helper function to get complete mode details with all overrides
export async function getFullModeDetails(
	modeSlug: string,
	customModes?: ModeConfig[],
	customModePrompts?: CustomModePrompts,
	options?: {
		cwd?: string
		globalCustomInstructions?: string
		preferredLanguage?: string
	},
): Promise<ModeConfig> {
	// First get the base mode config from custom modes or built-in modes
	const baseMode = getModeBySlug(modeSlug, customModes) || modes.find((m) => m.slug === modeSlug) || modes[0]

	// Check for any prompt component overrides
	const promptComponent = customModePrompts?.[modeSlug]

	// Get the base custom instructions
	const baseCustomInstructions = promptComponent?.customInstructions || baseMode.customInstructions || ""

	// If we have cwd, load and combine all custom instructions
	let fullCustomInstructions = baseCustomInstructions
	if (options?.cwd) {
		fullCustomInstructions = await addCustomInstructions(
			baseCustomInstructions,
			options.globalCustomInstructions || "",
			options.cwd,
			modeSlug,
			{ preferredLanguage: options.preferredLanguage },
		)
	}

	// Return mode with any overrides applied
	return {
		...baseMode,
		roleDefinition: promptComponent?.roleDefinition || baseMode.roleDefinition,
		customInstructions: fullCustomInstructions,
	}
}

// Helper function to safely get role definition
export function getRoleDefinition(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.roleDefinition
}

// Helper function to safely get custom instructions
export function getCustomInstructions(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.customInstructions ?? ""
}
