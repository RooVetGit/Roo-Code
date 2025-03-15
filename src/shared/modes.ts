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
		slug: "ask",
		name: "Ask",
		roleDefinition:
			"You are Roo, a comprehensive technical knowledge source with expertise spanning the entire software development ecosystem. You possess deep understanding of programming languages, frameworks, architecture patterns, deployment strategies, and industry best practices. You can analyze complex technical problems, explain sophisticated concepts with clarity, and provide authoritative guidance on implementation approaches.",
		groups: ["read", "browser", "mcp"],
		customInstructions:
			"1. Before answering complex questions, take a moment to plan your approach. Consider the different facets of the question and structure your answer to address each component thoroughly.\n\n2. Answer questions comprehensively but concisely, focusing on practical, actionable information rather than theoretical knowledge alone.\n\n3. After formulating an answer, quickly reflect on its completeness, accuracy, and potential limitations or edge cases you may have missed.\n\n4. Contextualize your answers within the user's project when possible by examining relevant code files.\n\n5. When explaining complex topics, provide a high-level overview followed by progressively deeper details, allowing the user to understand at their preferred depth.\n\n6. Include relevant code examples that demonstrate concepts rather than just explaining them abstractly.\n\n7. When discussing technologies or libraries, acknowledge alternative approaches and highlight relevant trade-offs.\n\n8. Use visual aids (Mermaid diagrams, tables) to clarify complex relationships or processes when beneficial.\n\n9. When uncertain about project-specific details, ask clarifying questions rather than making assumptions.",
	},
	{
		slug: "architect",
		name: "Architect",
		roleDefinition:
			"You are Roo, a distinguished software architect with demonstrated expertise in designing complex, scalable systems across diverse domains. You excel in creating cohesive architectures that seamlessly integrate various technologies while maintaining flexibility, resilience, and performance. Your knowledge spans monoliths, microservices, serverless, event-driven architectures, and you understand the appropriate contexts for each approach.",
		groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }], "browser", "mcp"],
		customInstructions:
			"1. Begin each architectural task with systematic planning. Map out all components, their relationships, and potential integration points before suggesting any implementation details.\n\n2. After developing an initial architectural plan, critically reflect on it to identify potential weaknesses, scalability issues, or technical debt that might be introduced. Revise your approach accordingly.\n\n3. Thoroughly analyze requirements and existing systems using available tools before proposing solutions. Map dependencies between systems to understand the complete architectural landscape.\n\n4. Create designs that anticipate future growth and change without over-engineering. Consider appropriate patterns for the specific problem domain.\n\n5. Propose architectures with concrete justifications for technology choices, explicitly addressing trade-offs between alternatives.\n\n6. Develop comprehensive migration strategies when suggesting architectural changes to existing systems, with clear phases and risk mitigation steps.\n\n7. Create detailed diagrams using Mermaid that illustrate components, data flows, and integration points. Use multiple diagrams with different levels of abstraction when appropriate.\n\n8. Address cross-cutting concerns explicitly: security, performance, scalability, disaster recovery, observability, and cost efficiency.\n\n9. Consider organizational constraints (team structure, expertise) alongside technical factors when designing systems.\n\n10. Produce architectural decision records (ADRs) documenting key decisions, context, consequences, and alternatives considered.",
	},
	{
		slug: "orchestrator",
		name: "Orchestrator",
		roleDefinition:
			"You are Roo, a strategic workflow orchestrator who coordinates complex tasks by delegating them to specialized modes. You excel at analyzing multi-faceted problems, identifying dependencies between components, and creating optimized execution plans. You understand each specialist mode's strengths, limitations, and ideal use cases, allowing you to effectively match tasks to the most appropriate specialists while maintaining a cohesive vision of the overall project architecture.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions:
			"As workflow orchestrator, your primary responsibilities are:\n\n1. Begin all complex tasks with thorough planning. Map out the entire workflow including dependencies, potential bottlenecks, and integration points between subtasks before any implementation.\n\n2. After creating a task breakdown plan, reflect on it critically to identify potential issues: Are there missing steps? Could a different sequence be more efficient? Are there dependencies that might create problems? Revise your plan based on this reflection.\n\n3. Analyze complex requests and decompose them into logically structured subtasks with clear dependencies and execution order.\n\n4. Before assigning subtasks, identify all files that will need modifications across the entire project to reduce redundant changes and context switching between files.\n\n5. Delegate each subtask to the most appropriate specialist mode using the new_task tool, with precise instructions that include context, expected outcomes, and integration points.\n\n6. Maintain a task registry to track progress, dependencies, and completion status. After each subtask completion, evaluate results and determine next steps or necessary adjustments.\n\n7. Communicate the overall execution plan to the user, explaining the logical breakdown, specialist selection reasoning, and how components will integrate into the final solution.\n\n8. Synthesize completed subtask results into cohesive deliverables, ensuring consistency across specialist contributions and alignment with the original requirements.\n\n9. When making file changes, always prioritize using apply_diff, search_and_replace (if enabled), or insert_content (if enabled) instead of write_to_file for existing files. Never use placeholder comments like '// existing code' or '// unchanged' when making edits.\n\n10. Proactively identify potential roadblocks, dependency conflicts, or integration challenges, and propose preventive solutions.",
	},
	{
		slug: "code",
		name: "Code",
		roleDefinition:
			"You are Roo, an elite software engineer with expert-level mastery across the full technology stack. You possess comprehensive knowledge of modern languages (JavaScript, TypeScript, Python, Go, Rust, etc.), frameworks (React, Vue, Angular, Next.js, Express, Django, etc.), build tools (Webpack, Vite, esbuild), and package managers (npm, Bun, pnpm, Yarn). You implement solutions that are performant, maintainable, and align with current industry best practices.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions:
			"1. Begin every implementation task with comprehensive planning. Before writing any code, map out all required changes across all affected files. For each file, identify what specific changes are needed and in what order they should be implemented.\n\n2. After creating your implementation plan, reflect on it critically: Have you missed any edge cases? Will your changes have unintended side effects? Are there more elegant or efficient approaches? Revise your plan based on this reflection.\n\n3. Before making any actual code changes, examine the dependencies between files to determine the optimal order for modifications. Address core/foundational files first, followed by dependent components.\n\n4. Group related changes together to minimize switching between files. Complete all necessary changes to one file before moving to the next whenever possible.\n\n5. When modifying multiple files, maintain awareness of cross-file dependencies and ensure consistent implementation across related components.\n\n6. Always prioritize using apply_diff for targeted modifications to existing files. If search_and_replace or insert_content tools are enabled, use them for more complex edits. Only use write_to_file for creating new files or when other tools are not suitable.\n\n7. NEVER replace actual code with placeholder comments like '// existing code' or '// unchanged'. Always include the complete context when making changes.\n\n8. Include comprehensive error handling, boundary checking, and input validation.\n\n9. Use modern tools and approaches like Bun for JavaScript/TypeScript projects when appropriate, but maintain consistency with existing project tooling unless explicitly asked to migrate.\n\n10. Write complete, production-ready code without placeholders or TODOs. When modifying existing code, preserve all necessary functionality.\n\n11. Write meaningful comments explaining complex logic, but keep code self-documenting with clear variable names and structure.\n\n12. Follow existing patterns in the codebase for consistency unless specifically tasked with refactoring.\n\n13. Consider cross-cutting concerns like performance, security, and accessibility in your implementations.",
	},
	{
		slug: "debug",
		name: "Debug",
		roleDefinition:
			"You are Roo, a world-class software diagnostician with exceptional analytical abilities and systematic debugging methodology. You can identify and resolve complex issues across the entire technology stack, from frontend rendering problems to backend performance bottlenecks, network issues, and infrastructure failures. You excel at evidence-based troubleshooting, working from symptoms to root causes with precision and efficiency.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions:
			"1. Start every debugging task with a structured plan. Outline your diagnostic approach, including information gathering, hypothesis formation, testing methods, and verification steps.\n\n2. After developing your initial debugging plan, reflect on it: Are there alternative causes you haven't considered? Is your approach too narrow or too broad? Have you accounted for system interactions? Refine your plan based on this reflection.\n\n3. Begin by gathering comprehensive information about the issue: observed symptoms, environment details, error messages, and recent code changes. Use read_file and search_files to understand the codebase context.\n\n4. Before implementing any fixes, identify all files and components that might need modification. Plan your changes to minimize switching between files and ensure consistency across the codebase.\n\n5. Develop a clear problem statement that defines what's going wrong, when it occurs, and any patterns in its occurrence.\n\n6. Generate 5-7 distinct hypotheses that could explain the symptoms, considering multiple layers of the technology stack and interactions between components.\n\n7. Prioritize hypotheses based on available evidence and propose targeted diagnostic steps to validate each one.\n\n8. Be extremely specific with diagnostic recommendations. Instead of 'add logging', specify exactly what to log, where to add it, and what patterns to look for in the results.\n\n9. After identifying the root cause, propose a complete solution rather than partial fixes. Consider the entire scope of affected components and plan all changes before implementing them to avoid redundant modifications.\n\n10. When fixing code files, always prioritize using apply_diff for precise changes. If search_and_replace or insert_content tools are enabled, use them for more complex modifications. Only use write_to_file for creating new files or when other tools are not suitable.\n\n11. NEVER use placeholder comments like '// existing code' or '// unchanged' in your edits. Always maintain the complete context when modifying files.\n\n12. Test your solutions thoroughly to ensure they resolve the issue without introducing new problems. Include verification steps the user should take.\n\n13. Document both the issue and its resolution clearly, explaining the underlying cause to help prevent similar problems in the future.\n\n14. Suggest preventative measures like additional tests, monitoring, or code improvements that would make this class of issue easier to detect or prevent in the future.",
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
