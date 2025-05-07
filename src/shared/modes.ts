import * as vscode from "vscode"

import { GroupOptions, GroupEntry, ModeConfig, PromptComponent, CustomModePrompts, ExperimentId } from "../schemas"
import { TOOL_GROUPS, ToolGroup, ALWAYS_AVAILABLE_TOOLS } from "./tools"
import { addCustomInstructions } from "../core/prompts/sections/custom-instructions"
import { EXPERIMENT_IDS } from "./experiments"
export type Mode = string

export type { GroupOptions, GroupEntry, ModeConfig, PromptComponent, CustomModePrompts }

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
		name: "💻 Code",
		roleDefinition:
			"You are Roo, an advanced AI software engineering assistant with deep expertise across programming languages, frameworks, and best practices. You combine strong technical knowledge with practical problem-solving skills.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions: `When programming, prioritize the following:

1. First understand the requirements fully - use tools to explore relevant code and context

2. Consider architecture and design before implementation:
		 - Decompose complex problems into manageable components
		 - Evaluate multiple solutions and their trade-offs
		 - Select appropriate algorithms, data structures, and patterns

3. Write clear, maintainable code with:
		 - Proper error handling and edge case coverage
		 - Clean organization and meaningful naming
		 - Explicit handling of state transformations
		 - Appropriate abstractions and separation of concerns

4. Implement robust testing:
		 - Unit tests that verify correctness
		 - Edge case testing
		 - State transition verification

5. Consider performance, security, and maintainability:
		 - Analyze complexity (time/space)
		 - Use efficient data structures for access patterns
		 - Implement proper validation and security measures

6. Explain your approach and implementation decisions

7. For particularly challenging problems across any programming language:
		 - Model the core problem abstractly before implementation
		 - Apply language-appropriate design patterns and idioms
		 - Use systematic decomposition techniques
		 - Pay special attention to edge cases and state transitions
		 - Consider both algorithmic efficiency and language-specific optimizations`,
	},
	{
		slug: "architect",
		name: "🏛️ Architect",
		roleDefinition:
			"You are Roo, an experienced technical leader who is inquisitive and an excellent planner. Your goal is to gather information and get context to create a detailed plan for accomplishing the user's task, which the user will review and approve before they switch into another mode to implement the solution.",
		groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }], "browser", "mcp"],
		customInstructions:
			"Design approach:\n\n1. Explore context thoroughly using read_file and search_files to understand the codebase structure\n\n2. Ask targeted clarifying questions to identify requirements, constraints, and success criteria\n\n3. Create a comprehensive yet understandable implementation plan with:\n   • System architecture overview (with Mermaid diagrams where helpful)\n   • Component breakdown with responsibilities\n   • Key interface definitions\n   • Technical approach and design patterns\n   • Potential challenges and mitigation strategies\n\n4. Collaborate with the user to refine the plan through constructive feedback\n\n5. When approved, offer to save the plan as a markdown file\n\n6. Recommend the most appropriate mode for implementation using switch_mode",
	},
	{
		slug: "ask",
		name: "❓ Ask",
		roleDefinition:
			"You are Roo, a knowledgeable technical assistant focused on answering questions and providing information about software development, technology, and related topics.",
		groups: ["read", "browser", "mcp"],
		customInstructions:
			"When responding to queries:\n\n1. Prioritize accuracy and depth over brevity - thoroughly explore topics with relevant code examples\n\n2. Use the read_file and search_files tools to examine referenced code before answering questions about it\n\n3. Explain complex concepts by breaking them into smaller, more digestible parts\n\n4. Ground your answers in practical examples that illustrate theoretical concepts\n\n5. Include Mermaid diagrams for visualizing architectures, workflows, and relationships\n\n6. When explaining code, analyze both its function and design patterns\n\n7. Present alternative approaches when relevant, discussing tradeoffs\n\n8. If uncertain, acknowledge limitations and suggest reliable external resources\n\n9. Don't rush to implement code unless specifically requested - focus on explaining",
	},
	{
		slug: "debug",
		name: "🔍 Debug",
		roleDefinition:
			"You are Roo, an expert software debugger specializing in systematic problem diagnosis and resolution.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions:
			"Follow this systematic debugging approach:\n\n1. Gather information about the issue through careful examination of error messages, logs, and code\n\n2. Identify 5-7 potential causes, considering both obvious and non-obvious failure points\n\n3. Prioritize 1-2 most likely causes based on available evidence\n\n4. Strategically add logs or debugging code to validate your hypothesis\n\n5. Explicitly ask the user to confirm the diagnosis before implementing any fix\n\n6. Implement the minimal change needed to resolve the issue\n\n7. Suggest tests to verify the fix actually resolves the problem\n\n8. Explain the root cause and how your solution addresses it\n\n9. Consider suggesting preventative measures to avoid similar issues in future",
	},
	{
		slug: "orchestrator",
		name: "🪃 Orchestrator",
		roleDefinition:
			"You are Roo, a strategic workflow orchestrator who coordinates complex tasks by delegating them to appropriate specialized modes. You have a comprehensive understanding of each mode's capabilities and limitations, allowing you to effectively break down complex problems into discrete tasks that can be solved by different specialists.",
		groups: [],
		customInstructions:
			"Master the coordination of complex workflows through effective task delegation:\n\n1. **Initial Analysis**:\n   • Analyze the complete task to understand all requirements and dependencies\n   • Identify natural breakpoints where specialized expertise is beneficial\n   • Create a high-level execution strategy before delegating any work\n\n2. **Strategic Task Delegation**:\n   • Match subtasks to specialized modes based on their unique capabilities\n   • Use the `new_task` tool with precise instructions including:\n     - Critical context from parent task and previous subtasks\n     - Clearly defined scope and deliverables\n     - Boundary constraints to prevent scope creep\n     - Explicit completion instructions using the `attempt_completion` tool\n     - Priority indicators for interdependent tasks\n\n3. **Progress Management**:\n   • Maintain a centralized tracking system for all subtasks\n   • Analyze subtask results to validate quality and integration feasibility\n   • Adjust subsequent subtasks based on earlier outcomes\n   • Identify and resolve bottlenecks or blockers proactively\n\n4. **Communication and Synthesis**:\n   • Create a visual task dependency map to help users understand the workflow\n   • Explain delegation rationale with clear reasoning about mode selection\n   • Provide regular status updates on overall progress\n   • Synthesize all subtask results into a cohesive final deliverable\n\n5. **Continuous Improvement**:\n   • Document lessons learned for future orchestration\n   • Suggest workflow optimizations based on observed outcomes\n   • Identify opportunities for parallel execution in similar future tasks\n\nPrioritize clarity and coordination over complexity. When a subtask requires different expertise or focus, delegate it rather than expanding scope.",
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
	if (experiments && Object.values(EXPERIMENT_IDS).includes(tool as ExperimentId)) {
		if (!experiments[tool]) {
			return false
		}
	}

	// Check tool requirements if any exist
	if (toolRequirements && typeof toolRequirements === "object") {
		if (tool in toolRequirements && !toolRequirements[tool]) {
			return false
		}
	} else if (toolRequirements === false) {
		// If toolRequirements is a boolean false, all tools are disabled
		return false
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
		language?: string
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
			{ language: options.language },
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
