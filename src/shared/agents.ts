import * as vscode from "vscode"

import {
	type GroupOptions,
	type GroupEntry,
	type AgentConfig,
	type ModeConfig,
	type CustomAgentPrompts,
	type CustomModePrompts,
	type ExperimentId,
	type ToolGroup,
	type PromptComponent,
	DEFAULT_AGENTS,
	DEFAULT_MODES,
} from "@roo-code/types"

import { addCustomInstructions } from "../core/prompts/sections/custom-instructions"

import { EXPERIMENT_IDS } from "./experiments"
import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "./tools"

export type Agent = string
export type Mode = Agent // Keep Mode as an alias for backward compatibility

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

// Main agents configuration as an ordered array
export const agents = DEFAULT_AGENTS
export const modes = agents // Keep modes as an alias for backward compatibility

// Export the default agent slug
export const defaultAgentSlug = agents[0].slug
export const defaultModeSlug = defaultAgentSlug // Keep defaultModeSlug as an alias for backward compatibility

// Helper functions
export function getAgentBySlug(slug: string, customAgents?: AgentConfig[]): AgentConfig | undefined {
	// Check custom agents first
	const customAgent = customAgents?.find((agent) => agent.slug === slug)
	if (customAgent) {
		return customAgent
	}
	// Then check built-in agents
	return agents.find((agent) => agent.slug === slug)
}

// Keep getModeBySlug as an alias for backward compatibility
export function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig | undefined {
	return getAgentBySlug(slug, customModes)
}

export function getAgentConfig(slug: string, customAgents?: AgentConfig[]): AgentConfig {
	const agent = getAgentBySlug(slug, customAgents)
	if (!agent) {
		throw new Error(`No agent found for slug: ${slug}`)
	}
	return agent
}

// Keep getModeConfig as an alias for backward compatibility
export function getModeConfig(slug: string, customModes?: ModeConfig[]): ModeConfig {
	return getAgentConfig(slug, customModes)
}

// Get all available agents, with custom agents overriding built-in agents
export function getAllAgents(customAgents?: AgentConfig[]): AgentConfig[] {
	if (!customAgents?.length) {
		return [...agents]
	}

	// Start with built-in agents
	const allAgents = [...agents]

	// Process custom agents
	customAgents.forEach((customAgent) => {
		const index = allAgents.findIndex((agent) => agent.slug === customAgent.slug)
		if (index !== -1) {
			// Override existing agent
			allAgents[index] = customAgent
		} else {
			// Add new agent
			allAgents.push(customAgent)
		}
	})

	return allAgents
}

// Keep getAllModes as an alias for backward compatibility
export function getAllModes(customModes?: ModeConfig[]): ModeConfig[] {
	return getAllAgents(customModes)
}

// Check if an agent is custom or an override
export function isCustomAgent(slug: string, customAgents?: AgentConfig[]): boolean {
	return !!customAgents?.some((agent) => agent.slug === slug)
}

// Keep isCustomMode as an alias for backward compatibility
export function isCustomMode(slug: string, customModes?: ModeConfig[]): boolean {
	return isCustomAgent(slug, customModes)
}

/**
 * Find an agent by its slug, don't fall back to built-in agents
 */
export function findAgentBySlug(slug: string, agents: readonly AgentConfig[] | undefined): AgentConfig | undefined {
	return agents?.find((agent) => agent.slug === slug)
}

// Keep findModeBySlug as an alias for backward compatibility
export function findModeBySlug(slug: string, modes: readonly ModeConfig[] | undefined): ModeConfig | undefined {
	return findAgentBySlug(slug, modes)
}

/**
 * Get the agent selection based on the provided agent slug, prompt component, and custom agents.
 * If a custom agent is found, it takes precedence over the built-in agents.
 * If no custom agent is found, the built-in agent is used with partial merging from promptComponent.
 * If neither is found, the default agent is used.
 */
export function getAgentSelection(agent: string, promptComponent?: PromptComponent, customAgents?: AgentConfig[]) {
	const customAgent = findAgentBySlug(agent, customAgents)
	const builtInAgent = findAgentBySlug(agent, agents)

	// If we have a custom agent, use it entirely
	if (customAgent) {
		return {
			roleDefinition: customAgent.roleDefinition || "",
			baseInstructions: customAgent.customInstructions || "",
			description: customAgent.description || "",
		}
	}

	// Otherwise, use built-in agent as base and merge with promptComponent
	const baseAgent = builtInAgent || agents[0] // fallback to default agent

	return {
		roleDefinition: promptComponent?.roleDefinition || baseAgent.roleDefinition || "",
		baseInstructions: promptComponent?.customInstructions || baseAgent.customInstructions || "",
		description: baseAgent.description || "",
	}
}

// Keep getModeSelection as an alias for backward compatibility
export function getModeSelection(mode: string, promptComponent?: PromptComponent, customModes?: ModeConfig[]) {
	return getAgentSelection(mode, promptComponent, customModes)
}

// Edit operation parameters that indicate an actual edit operation
const EDIT_OPERATION_PARAMS = ["diff", "content", "operations", "search", "replace", "args", "line"] as const

// Custom error class for file restrictions
export class FileRestrictionError extends Error {
	constructor(mode: string, pattern: string, description: string | undefined, filePath: string, tool?: string) {
		const toolInfo = tool ? `Tool '${tool}' in mode '${mode}'` : `This mode (${mode})`
		super(
			`${toolInfo} can only edit files matching pattern: ${pattern}${description ? ` (${description})` : ""}. Got: ${filePath}`,
		)
		this.name = "FileRestrictionError"
	}
}

export function isToolAllowedForAgent(
	tool: string,
	agentSlug: string,
	customAgents: AgentConfig[],
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

	const agent = getAgentBySlug(agentSlug, customAgents)
	if (!agent) {
		return false
	}

	// Check if tool is in any of the agent's groups and respects any group options
	for (const group of agent.groups) {
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
			// Check if this is an actual edit operation (not just path-only for streaming)
			const isEditOperation = EDIT_OPERATION_PARAMS.some((param) => toolParams?.[param])

			// Handle single file path validation
			if (filePath && isEditOperation && !doesFileMatchRegex(filePath, options.fileRegex)) {
				throw new FileRestrictionError(agent.name, options.fileRegex, options.description, filePath, tool)
			}

			// Handle XML args parameter (used by MULTI_FILE_APPLY_DIFF experiment)
			if (toolParams?.args && typeof toolParams.args === "string") {
				// Extract file paths from XML args with improved validation
				try {
					const filePathMatches = toolParams.args.match(/<path>([^<]+)<\/path>/g)
					if (filePathMatches) {
						for (const match of filePathMatches) {
							// More robust path extraction with validation
							const pathMatch = match.match(/<path>([^<]+)<\/path>/)
							if (pathMatch && pathMatch[1]) {
								const extractedPath = pathMatch[1].trim()
								// Validate that the path is not empty and doesn't contain invalid characters
								if (extractedPath && !extractedPath.includes("<") && !extractedPath.includes(">")) {
									if (!doesFileMatchRegex(extractedPath, options.fileRegex)) {
										throw new FileRestrictionError(
											agent.name,
											options.fileRegex,
											options.description,
											extractedPath,
											tool,
										)
									}
								}
							}
						}
					}
				} catch (error) {
					// Re-throw FileRestrictionError as it's an expected validation error
					if (error instanceof FileRestrictionError) {
						throw error
					}
					// If XML parsing fails, log the error but don't block the operation
					console.warn(`Failed to parse XML args for file restriction validation: ${error}`)
				}
			}
		}

		return true
	}

	return false
}

// Keep isToolAllowedForMode as an alias for backward compatibility
export function isToolAllowedForMode(
	tool: string,
	modeSlug: string,
	customModes: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, any>,
	experiments?: Record<string, boolean>,
): boolean {
	return isToolAllowedForAgent(tool, modeSlug, customModes, toolRequirements, toolParams, experiments)
}

// Create the agent-specific default prompts
export const defaultPrompts: Readonly<CustomAgentPrompts> = Object.freeze(
	Object.fromEntries(
		agents.map((agent) => [
			agent.slug,
			{
				roleDefinition: agent.roleDefinition,
				whenToUse: agent.whenToUse,
				customInstructions: agent.customInstructions,
				description: agent.description,
			},
		]),
	),
)

// Helper function to get all agents with their prompt overrides from extension state
export async function getAllAgentsWithPrompts(context: vscode.ExtensionContext): Promise<AgentConfig[]> {
	const customAgents = (await context.globalState.get<AgentConfig[]>("customModes")) || []
	const customAgentPrompts = (await context.globalState.get<CustomAgentPrompts>("customModePrompts")) || {}

	const allAgents = getAllAgents(customAgents)
	return allAgents.map((agent) => ({
		...agent,
		roleDefinition: customAgentPrompts[agent.slug]?.roleDefinition ?? agent.roleDefinition,
		whenToUse: customAgentPrompts[agent.slug]?.whenToUse ?? agent.whenToUse,
		customInstructions: customAgentPrompts[agent.slug]?.customInstructions ?? agent.customInstructions,
		// description is not overridable via customAgentPrompts, so we keep the original
	}))
}

// Keep getAllModesWithPrompts as an alias for backward compatibility
export async function getAllModesWithPrompts(context: vscode.ExtensionContext): Promise<ModeConfig[]> {
	return getAllAgentsWithPrompts(context)
}

// Helper function to get complete agent details with all overrides
export async function getFullAgentDetails(
	agentSlug: string,
	customAgents?: AgentConfig[],
	customAgentPrompts?: CustomAgentPrompts,
	options?: {
		cwd?: string
		globalCustomInstructions?: string
		language?: string
	},
): Promise<AgentConfig> {
	// First get the base agent config from custom agents or built-in agents
	const baseAgent = getAgentBySlug(agentSlug, customAgents) || agents.find((a) => a.slug === agentSlug) || agents[0]

	// Check for any prompt component overrides
	const promptComponent = customAgentPrompts?.[agentSlug]

	// Get the base custom instructions
	const baseCustomInstructions = promptComponent?.customInstructions || baseAgent.customInstructions || ""
	const baseWhenToUse = promptComponent?.whenToUse || baseAgent.whenToUse || ""
	const baseDescription = promptComponent?.description || baseAgent.description || ""

	// If we have cwd, load and combine all custom instructions
	let fullCustomInstructions = baseCustomInstructions
	if (options?.cwd) {
		fullCustomInstructions = await addCustomInstructions(
			baseCustomInstructions,
			options.globalCustomInstructions || "",
			options.cwd,
			agentSlug,
			{ language: options.language },
		)
	}

	// Return agent with any overrides applied
	return {
		...baseAgent,
		roleDefinition: promptComponent?.roleDefinition || baseAgent.roleDefinition,
		whenToUse: baseWhenToUse,
		description: baseDescription,
		customInstructions: fullCustomInstructions,
	}
}

// Keep getFullModeDetails as an alias for backward compatibility
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
	return getFullAgentDetails(modeSlug, customModes, customModePrompts, options)
}

// Helper function to safely get role definition
export function getRoleDefinition(agentSlug: string, customAgents?: AgentConfig[]): string {
	const agent = getAgentBySlug(agentSlug, customAgents)
	if (!agent) {
		console.warn(`No agent found for slug: ${agentSlug}`)
		return ""
	}
	return agent.roleDefinition
}

// Helper function to safely get description
export function getDescription(agentSlug: string, customAgents?: AgentConfig[]): string {
	const agent = getAgentBySlug(agentSlug, customAgents)
	if (!agent) {
		console.warn(`No agent found for slug: ${agentSlug}`)
		return ""
	}
	return agent.description ?? ""
}

// Helper function to safely get whenToUse
export function getWhenToUse(agentSlug: string, customAgents?: AgentConfig[]): string {
	const agent = getAgentBySlug(agentSlug, customAgents)
	if (!agent) {
		console.warn(`No agent found for slug: ${agentSlug}`)
		return ""
	}
	return agent.whenToUse ?? ""
}

// Helper function to safely get custom instructions
export function getCustomInstructions(agentSlug: string, customAgents?: AgentConfig[]): string {
	const agent = getAgentBySlug(agentSlug, customAgents)
	if (!agent) {
		console.warn(`No agent found for slug: ${agentSlug}`)
		return ""
	}
	return agent.customInstructions ?? ""
}
