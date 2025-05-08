import {
	Mode,
	modes,
	CustomModePrompts,
	PromptComponent,
	defaultModeSlug,
	ModeConfig,
	getModeBySlug,
	getGroupName,
} from "../../shared/modes"
import { PromptVariables } from "./sections/custom-system-prompt"
import { DiffStrategy } from "../../shared/tools"
import { McpHub } from "../../services/mcp/McpHub"
import { getToolDescriptionsForMode } from "./tools"
import * as vscode from "vscode"
import * as os from "os"
import {
	getRulesSection,
	getSystemInfoSection,
	getObjectiveSection,
	getSharedToolUseSection,
	getMcpServersSection,
	getToolUseGuidelinesSection,
	getCapabilitiesSection,
	getModesSection,
	addCustomInstructions,
	markdownFormattingSection,
} from "./sections"
import { loadSystemPromptFile } from "./sections/custom-system-prompt"
import { formatLanguage } from "../../shared/language"

/**
 * Generate the complete system prompt by assembling all sections
 * @param context - VSCode extension context
 * @param cwd - Current workspace directory
 * @param supportsComputerUse - Whether computer use is supported
 * @param mode - Current mode identifier
 * @param mcpHub - MCP Hub instance
 * @param diffStrategy - Diff strategy for file modifications
 * @param browserViewportSize - Browser viewport size
 * @param promptComponent - Custom prompt component
 * @param customModeConfigs - Custom mode configurations
 * @param globalCustomInstructions - Global custom instructions
 * @param diffEnabled - Whether diff is enabled
 * @param experiments - Experiment flags
 * @param enableMcpServerCreation - Whether MCP server creation is enabled
 * @param language - Language preference
 * @param rooIgnoreInstructions - RooIgnore instructions
 * @returns Complete system prompt
 */
async function generatePrompt(
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mode: Mode,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	promptComponent?: PromptComponent,
	customModeConfigs?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
): Promise<string> {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// Apply diff strategy only when diffing is enabled
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	// Retrieve complete mode configuration
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	const roleDefinition = promptComponent?.roleDefinition || modeConfig.roleDefinition

	// Load sections that require async operations in parallel
	const [modesSection, mcpServersSection] = await Promise.all([
		getModesSection(context),
		modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
			? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)
			: Promise.resolve(""),
	])

	// Process custom instructions with language preference
	const customInstructions = await addCustomInstructions(
		promptComponent?.customInstructions || modeConfig.customInstructions || "",
		globalCustomInstructions || "",
		cwd,
		mode,
		{
			language: language ?? formatLanguage(vscode.env.language),
			rooIgnoreInstructions,
		},
	)

	// Assemble complete prompt from all sections
	return `${roleDefinition}

${markdownFormattingSection()}

${getSharedToolUseSection()}

${getToolDescriptionsForMode(
	mode,
	cwd,
	supportsComputerUse,
	effectiveDiffStrategy,
	browserViewportSize,
	mcpHub,
	customModeConfigs,
	experiments,
)}

${getToolUseGuidelinesSection()}

${mcpServersSection}

${getCapabilitiesSection(cwd, supportsComputerUse, mcpHub, effectiveDiffStrategy)}

${modesSection}

${getRulesSection(cwd, supportsComputerUse, effectiveDiffStrategy)}

${getSystemInfoSection(cwd, mode, customModeConfigs)}

${getObjectiveSection()}

${customInstructions}`
}

/**
 * Main entry point for generating system prompts
 * Uses either file-based custom prompt or generates from components
 *
 * @param context - VSCode extension context
 * @param cwd - Current workspace directory
 * @param supportsComputerUse - Whether computer use is supported
 * @param mcpHub - MCP Hub instance
 * @param diffStrategy - Diff strategy for file modifications
 * @param browserViewportSize - Browser viewport size
 * @param mode - Current mode identifier
 * @param customModePrompts - Custom mode prompt overrides
 * @param customModes - Custom mode configurations
 * @param globalCustomInstructions - Global custom instructions
 * @param diffEnabled - Whether diff is enabled
 * @param experiments - Experiment flags
 * @param enableMcpServerCreation - Whether MCP server creation is enabled
 * @param language - Language preference
 * @param rooIgnoreInstructions - RooIgnore instructions
 * @returns Complete system prompt
 */
export const SYSTEM_PROMPT = async (
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mode: Mode = defaultModeSlug,
	customModePrompts?: CustomModePrompts,
	customModes?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
): Promise<string> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// Extract prompt component from custom mode prompts
	const getPromptComponent = (value: unknown): PromptComponent | undefined =>
		typeof value === "object" && value !== null ? (value as PromptComponent) : undefined

	// Prepare variables for prompt interpolation
	const variablesForPrompt: PromptVariables = {
		workspace: cwd,
		mode: mode,
		language: language ?? formatLanguage(vscode.env.language),
		shell: vscode.env.shell,
		operatingSystem: os.type(),
	}

	// Try to load custom system prompt from file
	const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode, variablesForPrompt)
	const promptComponent = getPromptComponent(customModePrompts?.[mode])
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

	// Use file-based custom prompt if available
	if (fileCustomSystemPrompt) {
		const roleDefinition = promptComponent?.roleDefinition || currentMode.roleDefinition
		const customInstructions = await addCustomInstructions(
			promptComponent?.customInstructions || currentMode.customInstructions || "",
			globalCustomInstructions || "",
			cwd,
			mode,
			{ language: language ?? formatLanguage(vscode.env.language), rooIgnoreInstructions },
		)

		// For file-based prompts, use simplified structure without tool sections
		return `${roleDefinition}

${fileCustomSystemPrompt}

${customInstructions}`
	}

	// Generate complete prompt from components
	return generatePrompt(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		diffEnabled ? diffStrategy : undefined,
		browserViewportSize,
		promptComponent,
		customModes,
		globalCustomInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
	)
}
