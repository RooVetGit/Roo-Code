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
import { PromptVariables, loadSystemPromptFile } from "./sections/custom-system-prompt"
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
import { 
	getDevstralRoleAndCoreInstructions, 
	getDevstralToolUsageGuidelines 
} from "./sections/devstral-specific" // Import Devstral specific prompts
import { formatLanguage } from "../../shared/language"
import { CodeIndexManager } from "../../services/code-index/manager"

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
	isDevstralModel?: boolean, 
): Promise<string> {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	let roleDefinitionFromMode = promptComponent?.roleDefinition || modeConfig.roleDefinition
	
	let finalCombinedRoleDefinition: string;
	let devstralCoreSystemInstructions = "";
	let devstralSpecificToolGuidelines = "";

	if (isDevstralModel) {
		const fullDevstralCore = getDevstralRoleAndCoreInstructions();
		// The getDevstralRoleAndCoreInstructions includes the intro "You are Devstral..." and the <ROLE> block.
		// It also includes other sections like <EFFICIENCY>, <CODE_QUALITY>, etc.
		// We will prepend Devstral's intro + ROLE to the mode-specific role definition.
		// And then append the other Devstral core instructions later in the prompt.
		const devstralIntroAndRoleMatch = fullDevstralCore.match(/^(You are Devstral.*?<\/ROLE>)/s);
		const devstralIntroAndRole = devstralIntroAndRoleMatch ? devstralIntroAndRoleMatch[0] : "You are Devstral, a helpful agentic model trained by Mistral AI and using the OpenHands scaffold."; // Fallback

		finalCombinedRoleDefinition = `${devstralIntroAndRole}\n\n${roleDefinitionFromMode}`;
		
		// Extract remaining general instructions (EFFICIENCY, CODE_QUALITY, etc.)
		devstralCoreSystemInstructions = fullDevstralCore.replace(/^(You are Devstral.*?<\/ROLE>\s*)/s, "").trim();
		devstralSpecificToolGuidelines = getDevstralToolUsageGuidelines();
	} else {
		finalCombinedRoleDefinition = roleDefinitionFromMode;
	}

	const [modesSection, mcpServersSection] = await Promise.all([
		getModesSection(context),
		modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
			? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)
			: Promise.resolve(""),
	])

	const codeIndexManager = CodeIndexManager.getInstance(context)
	
	const toolUseGuidelines = getToolUseGuidelinesSection() + 
		(isDevstralModel ? `\n\n${devstralSpecificToolGuidelines}` : "");

	// Construct the base prompt, including Devstral specific instructions if applicable
	let basePrompt = `${finalCombinedRoleDefinition}

${markdownFormattingSection()}

${getSharedToolUseSection()}

${getToolDescriptionsForMode(
	mode,
	cwd,
	supportsComputerUse,
	codeIndexManager,
	effectiveDiffStrategy,
	browserViewportSize,
	mcpHub,
	customModeConfigs,
	experiments,
	isDevstralModel, // Pass isDevstralModel
)}

${toolUseGuidelines}`

	if (isDevstralModel) {
		basePrompt += `\n\n${devstralCoreSystemInstructions}`
	}

basePrompt += `

${mcpServersSection}

${getCapabilitiesSection(cwd, supportsComputerUse, mcpHub, effectiveDiffStrategy, codeIndexManager)}

${modesSection}

${getRulesSection(cwd, supportsComputerUse, effectiveDiffStrategy)}

${getSystemInfoSection(cwd)}

${getObjectiveSection()}

${await addCustomInstructions(promptComponent?.customInstructions || modeConfig.customInstructions || "", globalCustomInstructions || "", cwd, mode, { language: language ?? formatLanguage(vscode.env.language), rooIgnoreInstructions })}`

	return basePrompt
}

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
	isDevstralModel: boolean = false, 
): Promise<string> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	const getPromptComponent = (value: unknown) => {
		if (typeof value === "object" && value !== null) {
			return value as PromptComponent
		}
		return undefined
	}

	const variablesForPrompt: PromptVariables = {
		workspace: cwd,
		mode: mode,
		language: language ?? formatLanguage(vscode.env.language),
		shell: vscode.env.shell,
		operatingSystem: os.type(),
	}
	const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode, variablesForPrompt)

	const promptComponent = getPromptComponent(customModePrompts?.[mode])
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

	if (fileCustomSystemPrompt) {
		let roleDefinitionFromFile = promptComponent?.roleDefinition || currentMode.roleDefinition
		if (isDevstralModel) {
			// Prepend Devstral's intro and ROLE even for file-based custom system prompts
			const devstralIntroAndRoleMatch = getDevstralRoleAndCoreInstructions().match(/^(You are Devstral.*?<\/ROLE>)/s);
			const devstralIntroAndRole = devstralIntroAndRoleMatch ? devstralIntroAndRoleMatch[0] : "You are Devstral, a helpful agentic model trained by Mistral AI and using the OpenHands scaffold.";
			roleDefinitionFromFile = `${devstralIntroAndRole}\n\n${roleDefinitionFromFile}`;
		}
		const customInstructions = await addCustomInstructions(
			promptComponent?.customInstructions || currentMode.customInstructions || "",
			globalCustomInstructions || "",
			cwd,
			mode,
			{ language: language ?? formatLanguage(vscode.env.language), rooIgnoreInstructions },
		)
		// Note: For file-based prompts, only the role definition is augmented.
		// The main body from the file is used, and general Devstral instructions (efficiency, code quality, etc.)
		// and Devstral tool guidelines are NOT inserted here, as the file prompt is a full override.
		return `${roleDefinitionFromFile}\n\n${fileCustomSystemPrompt}\n\n${customInstructions}`
	}

	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	return generatePrompt(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		effectiveDiffStrategy,
		browserViewportSize,
		promptComponent,
		customModes,
		globalCustomInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
		isDevstralModel, 
	)
}
